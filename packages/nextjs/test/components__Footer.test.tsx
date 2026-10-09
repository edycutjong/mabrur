import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "~~/components/Footer";

describe("Footer component", () => {
  it("renders a contentinfo landmark with the links nav", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("border-t", "mt-10");
    expect(within(footer).getByRole("navigation", { name: "Tautan" })).toBeInTheDocument();
  });

  it("links the judge path, the repo and the verified contract in Indonesian by default", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Untuk juri" })).toHaveAttribute("href", "/judge");
    const gh = screen.getByRole("link", { name: "GitHub: edycutjong/mabrur" });
    expect(gh).toHaveAttribute("href", "https://github.com/edycutjong/mabrur");
    expect(gh).toHaveAttribute("target", "_blank");
    expect(gh).toHaveAttribute("rel", "noreferrer");
    const pbm = screen.getByRole("link", { name: "Kontrak terverifikasi (Arbiscan)" });
    expect(pbm).toHaveAttribute("href", expect.stringContaining("0x36f1d899d9d4411b2DdfB60Dbbe989220336d2D5#code"));
    expect(screen.getAllByRole("link").map(a => a.getAttribute("href"))).toEqual([
      "/judge",
      "https://github.com/edycutjong/mabrur",
      "https://arbiscan.io/address/0x36f1d899d9d4411b2DdfB60Dbbe989220336d2D5#code",
    ]);
  });

  it("always carries the honesty line (ID)", () => {
    render(<Footer />);
    expect(screen.getByText("tIDR = token uji tanpa nilai")).toBeVisible();
    expect(screen.getByText("Nama agen & vendor fiktif")).toBeVisible();
    expect(screen.getByText("Penerbit klaim = kunci demo")).toBeVisible();
    expect(screen.getByText("tIDR = test token, no value")).not.toBeVisible();
  });

  it("switches every string to English in EN mode", () => {
    document.documentElement.classList.add("lang-en");
    render(<Footer />);
    expect(screen.getByRole("navigation", { name: "Links" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "For judges" })).toHaveAttribute("href", "/judge");
    expect(screen.getByRole("link", { name: "Verified contract (Arbiscan)" })).toBeInTheDocument();
    expect(screen.getByText("tIDR = test token, no value")).toBeVisible();
    expect(screen.getByText("Agency & vendor names are fictional")).toBeVisible();
    expect(screen.getByText("Claim issuer = a demo key")).toBeVisible();
    expect(screen.getByText("tIDR = token uji tanpa nilai")).not.toBeVisible();
  });
});
