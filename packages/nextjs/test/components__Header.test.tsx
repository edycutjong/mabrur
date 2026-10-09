import { usePathname } from "next/navigation";
import { render, screen } from "@testing-library/react";
import { hardhat } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { Header, menuLinks } from "~~/components/Header";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock scaffold-eth hooks
vi.mock("~~/hooks/scaffold-eth", () => ({
  useTargetNetwork: vi.fn(),
}));

// Mock scaffold-eth components
vi.mock("~~/components/scaffold-eth", () => ({
  FaucetButton: () => <div data-testid="faucet-button">Faucet Button</div>,
  RainbowKitCustomConnectButton: () => <div data-testid="rainbow-button">Connect</div>,
}));

// Mock next/link to render normally (per instructions)
vi.mock("next/link", async () => {
  const actual = await vi.importActual("next/link");
  return actual;
});

describe("Header component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering structure", () => {
    it("renders header element with correct styling classes", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      const { container } = render(<Header />);
      const header = container.querySelector("header");

      expect(header).toBeInTheDocument();
      expect(header).toHaveClass("sticky", "top-0", "z-20", "border-b");
    });

    it("renders logo link to /app", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const logoLink = screen.getByRole("link", { name: /Mabrur — beranda aplikasi/i });

      expect(logoLink).toBeInTheDocument();
      expect(logoLink).toHaveAttribute("href", "/app");
    });

    it("renders Mabrur wordmark with correct styling", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const wordmark = screen.getByText("Mabrur");

      expect(wordmark).toBeInTheDocument();
      expect(wordmark).toHaveStyle({ fontWeight: "700", fontSize: "26px" });
    });

    it("renders the Mabrur brand icon (kuitansi + stamp), not a placeholder mark", () => {
      const { container } = render(<Header />);
      const icon = container.querySelector('img[src*="icon.svg"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("width", "32");
      expect(icon).toHaveAttribute("height", "32");
      expect(icon).toHaveAttribute("alt", "");
      expect(container.querySelectorAll("circle")).toHaveLength(0);
    });
  });

  describe("navigation links", () => {
    it("renders all menu links with correct labels and hrefs", () => {
      (usePathname as any).mockReturnValue("/");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);

      for (const link of menuLinks) {
        const navLink = screen.getByRole("link", { name: link.label });
        expect(navLink).toBeInTheDocument();
        expect(navLink).toHaveAttribute("href", link.href);
      }
    });

    it("sets aria-current=page on active Jamaah link when pathname starts with /app/jamaah", () => {
      (usePathname as any).mockReturnValue("/app/jamaah");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const jamaahLink = screen.getByRole("link", { name: "Jamaah" });

      expect(jamaahLink).toHaveAttribute("aria-current", "page");
    });

    it("sets aria-current=page on active Agen link when pathname starts with /app/agen", () => {
      (usePathname as any).mockReturnValue("/app/agen");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const agenLink = screen.getByRole("link", { name: "Agen" });

      expect(agenLink).toHaveAttribute("aria-current", "page");
    });

    it("sets aria-current=page on active Vendor link when pathname starts with /app/vendor", () => {
      (usePathname as any).mockReturnValue("/app/vendor");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const vendorLink = screen.getByRole("link", { name: "Vendor" });

      expect(vendorLink).toHaveAttribute("aria-current", "page");
    });

    it("does not set aria-current on inactive links", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const jamaahLink = screen.getByRole("link", { name: "Jamaah" });
      const agenLink = screen.getByRole("link", { name: "Agen" });
      const vendorLink = screen.getByRole("link", { name: "Vendor" });

      expect(jamaahLink).not.toHaveAttribute("aria-current");
      expect(agenLink).not.toHaveAttribute("aria-current");
      expect(vendorLink).not.toHaveAttribute("aria-current");
    });

    it("handles nested paths correctly for aria-current", () => {
      (usePathname as any).mockReturnValue("/app/jamaah/details/123");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const jamaahLink = screen.getByRole("link", { name: "Jamaah" });

      expect(jamaahLink).toHaveAttribute("aria-current", "page");
    });
  });

  describe("judge link", () => {
    it("renders judge link with correct href", () => {
      (usePathname as any).mockReturnValue("/");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const judgeLink = screen.getByRole("link", { name: /Untuk juri/i });

      expect(judgeLink).toBeInTheDocument();
      expect(judgeLink).toHaveAttribute("href", "/judge");
    });

    it("sets aria-current=page on judge link when pathname is /judge", () => {
      (usePathname as any).mockReturnValue("/judge");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const judgeLink = screen.getByRole("link", { name: /Untuk juri/i });

      expect(judgeLink).toHaveAttribute("aria-current", "page");
    });

    it("does not set aria-current on judge link when pathname is not /judge", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const judgeLink = screen.getByRole("link", { name: /Untuk juri/i });

      expect(judgeLink).not.toHaveAttribute("aria-current");
    });
  });

  describe("network information", () => {
    it("displays network name and tIDR information for non-local network", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 11155111, name: "Sepolia" },
      });

      render(<Header />);

      expect(document.querySelector(".mb-chip")).toHaveTextContent(/Sepolia · tIDR tanpa nilai/);
    });

    it("displays hardhat network name when on local network", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: hardhat,
      });

      render(<Header />);

      expect(document.querySelector(".mb-chip")).toHaveTextContent(/Hardhat · tIDR tanpa nilai/);
    });

    it("displays network info with title attribute", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Mainnet" },
      });

      const { container } = render(<Header />);
      const chip = container.querySelector(".mb-chip");

      expect(chip).toHaveAttribute("title", "tIDR adalah token uji tanpa nilai");
    });
  });

  describe("wallet and faucet buttons", () => {
    it("always renders RainbowKitCustomConnectButton", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const rainbowButton = screen.getByTestId("rainbow-button");

      expect(rainbowButton).toBeInTheDocument();
    });

    it("renders FaucetButton when on local (hardhat) network", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: hardhat,
      });

      render(<Header />);
      const faucetButton = screen.getByTestId("faucet-button");

      expect(faucetButton).toBeInTheDocument();
    });

    it("does not render FaucetButton when not on local network", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 11155111, name: "Sepolia" },
      });

      render(<Header />);
      const faucetButton = screen.queryByTestId("faucet-button");

      expect(faucetButton).not.toBeInTheDocument();
    });

    it("renders both buttons on local network", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: hardhat,
      });

      render(<Header />);

      expect(screen.getByTestId("rainbow-button")).toBeInTheDocument();
      expect(screen.getByTestId("faucet-button")).toBeInTheDocument();
    });

    it("renders only RainbowKitCustomConnectButton on non-local network", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Mainnet" },
      });

      render(<Header />);

      expect(screen.getByTestId("rainbow-button")).toBeInTheDocument();
      expect(screen.queryByTestId("faucet-button")).not.toBeInTheDocument();
    });
  });

  describe("semantic HTML and accessibility", () => {
    it("has proper nav element with aria-label", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      render(<Header />);
      const nav = screen.getByRole("navigation", { name: /Peran/i });

      expect(nav).toBeInTheDocument();
    });

    it("exports menuLinks array with correct structure", () => {
      expect(menuLinks).toBeInstanceOf(Array);
      expect(menuLinks).toHaveLength(3);

      for (const link of menuLinks) {
        expect(link).toHaveProperty("label");
        expect(link).toHaveProperty("href");
        expect(typeof link.label).toBe("string");
        expect(typeof link.href).toBe("string");
      }
    });

    it("menuLinks contains Jamaah, Agen, Vendor in order", () => {
      expect(menuLinks[0].label).toBe("Jamaah");
      expect(menuLinks[0].href).toBe("/app/jamaah");

      expect(menuLinks[1].label).toBe("Agen");
      expect(menuLinks[1].href).toBe("/app/agen");

      expect(menuLinks[2].label).toBe("Vendor");
      expect(menuLinks[2].href).toBe("/app/vendor");
    });
  });

  describe("layout and responsive classes", () => {
    it("applies responsive layout classes to container", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      const { container } = render(<Header />);
      const mainDiv = container.querySelector(".max-w-\\[1600px\\], .mx-auto, .flex");

      expect(mainDiv).toBeInTheDocument();
    });

    it("applies flex-wrap for responsive behavior", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 1, name: "Sepolia" },
      });

      const { container } = render(<Header />);
      const mainDiv = container.querySelector("div.flex");

      expect(mainDiv).toHaveClass("flex-wrap");
    });
  });

  describe("integration - all features together", () => {
    it("renders complete header with all elements for hardhat network on root path", () => {
      (usePathname as any).mockReturnValue("/");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: hardhat,
      });

      render(<Header />);

      // Check header structure
      expect(screen.getByRole("link", { name: /Mabrur — beranda aplikasi/i })).toBeInTheDocument();

      // Check navigation
      expect(screen.getByRole("link", { name: "Jamaah" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Agen" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Vendor" })).toBeInTheDocument();

      // Check judge link
      expect(screen.getByRole("link", { name: /Untuk juri/i })).toBeInTheDocument();

      // Check network info
      expect(document.querySelector(".mb-chip")).toHaveTextContent(/Hardhat · tIDR tanpa nilai/);

      // Check buttons
      expect(screen.getByTestId("rainbow-button")).toBeInTheDocument();
      expect(screen.getByTestId("faucet-button")).toBeInTheDocument();
    });

    it("renders complete header with all elements for sepolia network on jamaah path", () => {
      (usePathname as any).mockReturnValue("/app/jamaah/list");
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 11155111, name: "Sepolia" },
      });

      render(<Header />);

      // Check active link
      const jamaahLink = screen.getByRole("link", { name: "Jamaah" });
      expect(jamaahLink).toHaveAttribute("aria-current", "page");

      // Check other links not active
      expect(screen.getByRole("link", { name: "Agen" })).not.toHaveAttribute("aria-current");
      expect(screen.getByRole("link", { name: "Vendor" })).not.toHaveAttribute("aria-current");

      // Check judge link not active
      expect(screen.getByRole("link", { name: /Untuk juri/i })).not.toHaveAttribute("aria-current");

      // Check network info
      expect(document.querySelector(".mb-chip")).toHaveTextContent(/Sepolia · tIDR tanpa nilai/);

      // Check buttons - only wallet, no faucet
      expect(screen.getByTestId("rainbow-button")).toBeInTheDocument();
      expect(screen.queryByTestId("faucet-button")).not.toBeInTheDocument();
    });
  });

  describe("ID/EN switch", () => {
    it("renders the shared ID | EN toggle, Indonesian by default", () => {
      (usePathname as any).mockReturnValue("/app");
      (useTargetNetwork as any).mockReturnValue({ targetNetwork: { id: 1, name: "Sepolia" } });
      render(<Header />);
      const toggle = screen.getByRole("button", { name: /Ganti bahasa/ });
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      expect(toggle).toHaveTextContent("ID EN");
    });

    it("shows English labels, names and titles in EN mode", () => {
      document.documentElement.classList.add("lang-en");
      (usePathname as any).mockReturnValue("/judge");
      (useTargetNetwork as any).mockReturnValue({ targetNetwork: { id: 1, name: "Sepolia" } });
      render(<Header />);
      expect(screen.getByRole("navigation", { name: "Roles" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Mabrur — app home" })).toHaveAttribute("href", "/app");
      for (const l of menuLinks) expect(screen.getByRole("link", { name: l.en })).toHaveAttribute("href", l.href);
      expect(screen.getByRole("link", { name: "For judges" })).toHaveAttribute("aria-current", "page");
      expect(screen.queryByRole("link", { name: /Untuk juri/ })).not.toBeInTheDocument();
      expect(document.querySelector(".mb-chip")).toHaveAttribute("title", "tIDR is a test token with no value");
      expect(screen.getByRole("button", { name: /switch language/ })).toHaveAttribute("aria-pressed", "true");
    });
  });
});
