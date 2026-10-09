import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LangToggle } from "~~/components/mabrur/LangToggle";
import { T } from "~~/components/mabrur/T";
import { useLang, useLangToggle, useT } from "~~/hooks/mabrur/useLang";
import { LANG_BOOT_SCRIPT, LANG_CLASS, LANG_KEY, applyLang, currentLang, pick } from "~~/utils/mabrur/i18n";

const root = () => document.documentElement;

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("utils/mabrur/i18n — shared with the landing", () => {
  it("uses the landing's key, class and default", () => {
    expect(LANG_KEY).toBe("mabrur-lang");
    expect(LANG_CLASS).toBe("lang-en");
    expect(currentLang()).toBe("id");
  });

  it("applyLang sets the class, <html lang> and the stored choice, both ways", () => {
    applyLang("en");
    expect(root().classList.contains("lang-en")).toBe(true);
    expect(root().getAttribute("lang")).toBe("en");
    expect(localStorage.getItem("mabrur-lang")).toBe("en");
    expect(currentLang()).toBe("en");
    applyLang("id");
    expect(root().classList.contains("lang-en")).toBe(false);
    expect(root().getAttribute("lang")).toBe("id");
    expect(localStorage.getItem("mabrur-lang")).toBe("id");
  });

  it("applyLang still switches the page when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    applyLang("en");
    expect(currentLang()).toBe("en");
  });

  it("currentLang is 'id' without a document (server)", () => {
    vi.stubGlobal("document", undefined);
    try {
      expect(currentLang()).toBe("id");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("the boot script applies a stored 'en' before paint and leaves everything else Indonesian", () => {
    new Function(LANG_BOOT_SCRIPT)();
    expect(root().classList.contains("lang-en")).toBe(false);
    localStorage.setItem("mabrur-lang", "en");
    new Function(LANG_BOOT_SCRIPT)();
    expect(root().classList.contains("lang-en")).toBe(true);
    expect(root().getAttribute("lang")).toBe("en");
  });

  it("the boot script literal stays in sync with LANG_KEY and LANG_CLASS", () => {
    expect(LANG_BOOT_SCRIPT).toContain(`localStorage.getItem("${LANG_KEY}")`);
    expect(LANG_BOOT_SCRIPT).toContain(`classList.add("${LANG_CLASS}")`);
  });

  it("the boot script never throws when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => new Function(LANG_BOOT_SCRIPT)()).not.toThrow();
    expect(currentLang()).toBe("id");
  });

  it("pick returns the string for a language", () => {
    expect(pick("id", { id: "Salin", en: "Copy" })).toBe("Salin");
    expect(pick("en", { id: "Salin", en: "Copy" })).toBe("Copy");
  });
});

describe("<T/>", () => {
  it("renders both variants; CSS shows the active one", () => {
    render(<T id="Batal" en="Cancel" />);
    expect(screen.getByText("Batal")).toHaveClass("t-id");
    expect(screen.getByText("Cancel")).toHaveClass("t-en");
    expect(screen.getByText("Cancel")).toHaveAttribute("lang", "en");
    expect(screen.getByText("Batal")).toBeVisible();
    expect(screen.getByText("Cancel")).not.toBeVisible();
    act(() => root().classList.add("lang-en"));
    expect(screen.getByText("Cancel")).toBeVisible();
    expect(screen.getByText("Batal")).not.toBeVisible();
  });

  it("renders an identical string once", () => {
    const { container } = render(<T id="Hotel" en="Hotel" />);
    expect(container.innerHTML).toBe("Hotel");
  });

  it("server-renders both variants (no dependence on the viewer's choice)", () => {
    const html = renderToString(<T id="Lihat" en="View" />);
    expect(html).toContain('<span class="t-id">Lihat</span>');
    expect(html).toContain('<span class="t-en" lang="en">View</span>');
  });
});

describe("hooks/mabrur/useLang", () => {
  it("follows the <html> class", async () => {
    const { result } = renderHook(() => ({ lang: useLang(), t: useT() }));
    expect(result.current.lang).toBe("id");
    expect(result.current.t("Salin", "Copy")).toBe("Salin");
    await act(async () => root().classList.add("lang-en"));
    expect(result.current.lang).toBe("en");
    expect(result.current.t("Salin", "Copy")).toBe("Copy");
  });

  it("reads 'id' on the server", () => {
    root().classList.add("lang-en");
    const Probe = () => <i>{useLang()}</i>;
    expect(renderToString(<Probe />)).toBe("<i>id</i>");
  });

  it("toggle flips the page and remembers it", async () => {
    const { result, unmount } = renderHook(() => useLangToggle());
    await act(async () => result.current.toggle());
    expect(result.current.lang).toBe("en");
    expect(localStorage.getItem("mabrur-lang")).toBe("en");
    await act(async () => result.current.toggle());
    expect(result.current.lang).toBe("id");
    expect(localStorage.getItem("mabrur-lang")).toBe("id");
    unmount();
  });
});

describe("<LangToggle/>", () => {
  it("is the landing's ID | EN button: accessible name, aria-pressed, both halves", async () => {
    render(<LangToggle />);
    const btn = screen.getByRole("button", { name: "ID EN · Ganti bahasa / switch language" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).toHaveClass("mb-lang");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn.querySelector('[data-l="id"]')).toHaveTextContent("ID");
    expect(btn.querySelector('[data-l="en"]')).toHaveTextContent("EN");

    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(root()).toHaveClass("lang-en");
    expect(root()).toHaveAttribute("lang", "en");
    expect(localStorage.getItem("mabrur-lang")).toBe("en");

    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(root()).not.toHaveClass("lang-en");
    expect(root()).toHaveAttribute("lang", "id");
  });

  it("starts pressed when the page is already English (set by the boot script)", () => {
    root().classList.add("lang-en");
    render(<LangToggle />);
    expect(screen.getByRole("button", { name: /switch language/ })).toHaveAttribute("aria-pressed", "true");
  });
});
