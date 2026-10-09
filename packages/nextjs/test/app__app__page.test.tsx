import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AppHome, { metadata } from "~~/app/app/page";

vi.mock("~~/utils/scaffold-eth/getMetadata", () => ({
  getMetadata: vi.fn(config => ({
    title: config.title,
    description: config.description,
  })),
}));

describe("app/app/page", () => {
  describe("metadata export", () => {
    it("exports metadata with correct title", () => {
      expect(metadata).toBeDefined();
      expect(metadata.title).toBe("Pilih peran");
    });

    it("exports metadata with correct description", () => {
      expect(metadata.description).toContain("Mabrur: a pilgrim's umrah prepayment");
      expect(metadata.description).toContain("Arbitrum One");
    });

    it("exports metadata as an object with title and description", () => {
      expect(metadata).toEqual(
        expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
        }),
      );
    });
  });

  describe("AppHome component", () => {
    it("renders the main heading", () => {
      render(<AppHome />);
      expect(screen.getByText(/Dana umrah Anda hanya bisa dipakai untuk umrah Anda/)).toBeInTheDocument();
    });

    it("renders the component label", () => {
      render(<AppHome />);
      expect(screen.getByText(/Mabrur · purpose-bound umrah prepayment/)).toBeInTheDocument();
    });

    it("renders the description paragraph with Indonesian text", () => {
      render(<AppHome />);
      expect(screen.getByText(/Uang muka jamaah dikunci per pos di kontrak/)).toBeInTheDocument();
    });

    it("renders the description paragraph with English translation", () => {
      render(<AppHome />);
      expect(screen.getByText(/A pilgrim's prepayment is earmarked line by line on-chain/)).toBeInTheDocument();
    });

    it("renders all three role links with correct hrefs", () => {
      render(<AppHome />);

      const jamaahLink = screen.getByRole("link", { name: /Jamaah · pilgrim/ });
      expect(jamaahLink).toHaveAttribute("href", "/app/jamaah");

      const agenLink = screen.getByRole("link", { name: /Agen · agency/ });
      expect(agenLink).toHaveAttribute("href", "/app/agen");

      const vendorLink = screen.getByRole("link", { name: /Vendor · licensed vendor/ });
      expect(vendorLink).toHaveAttribute("href", "/app/vendor");
    });

    it("renders jamaah (pilgrim) role link text", () => {
      render(<AppHome />);
      expect(screen.getByText("Pesan & buku amanah")).toBeInTheDocument();
      expect(screen.getByText(/Bayar paket umrah dengan satu tanda tangan/)).toBeInTheDocument();
      expect(screen.getByText(/Book with one signature/)).toBeInTheDocument();
    });

    it("renders agen (agency) role link text", () => {
      render(<AppHome />);
      expect(screen.getByText("Konsol agen")).toBeInTheDocument();
      expect(
        screen.getByText(/Agen hanya bisa membayar faktur yang ditandatangani vendor berlisensi/),
      ).toBeInTheDocument();
      expect(screen.getByText(/The agency can only pay a licensed vendor/)).toBeInTheDocument();
    });

    it("renders vendor role link text", () => {
      render(<AppHome />);
      expect(screen.getByText("Tanda tangani faktur")).toBeInTheDocument();
      expect(screen.getByText(/Vendor menandatangani faktur dengan kuncinya sendiri/)).toBeInTheDocument();
      expect(screen.getByText(/Vendors sign invoices with their own key/)).toBeInTheDocument();
    });

    it("renders the footer disclaimer with Indonesian text", () => {
      render(<AppHome />);
      expect(screen.getByText(/tIDR adalah token uji tanpa nilai/)).toBeInTheDocument();
      expect(screen.getByText(/Semua nama agen dan vendor fiktif/)).toBeInTheDocument();
    });

    it("renders the footer disclaimer with English translation", () => {
      render(<AppHome />);
      expect(screen.getByText(/tIDR is a test token with no value/)).toBeInTheDocument();
      expect(screen.getByText(/All agency and vendor names are fictional/)).toBeInTheDocument();
    });

    it("renders the call-to-action text for each role", () => {
      render(<AppHome />);
      const buttons = screen.getAllByText("Buka →");
      expect(buttons).toHaveLength(3);
    });

    it("renders with correct structure and classes", () => {
      const { container } = render(<AppHome />);

      // Main container structure
      const mainDiv = container.querySelector(".w-full.max-w-6xl");
      expect(mainDiv).toBeInTheDocument();

      // Grid structure for roles
      const grid = container.querySelector(".grid.gap-5");
      expect(grid).toBeInTheDocument();

      // Verify grid has 3 children (the links)
      const links = container.querySelectorAll("a.mb-sheet");
      expect(links).toHaveLength(3);
    });

    it("renders links as flex containers with gap", () => {
      const { container } = render(<AppHome />);
      const links = container.querySelectorAll("a.mb-sheet.flex");
      expect(links).toHaveLength(3);

      links.forEach(link => {
        expect(link).toHaveClass("flex-col", "gap-2", "hover:-translate-y-0.5", "transition-transform");
      });
    });

    it("renders all role eyebrows (role labels)", () => {
      render(<AppHome />);
      expect(screen.getByText("Jamaah · pilgrim")).toBeInTheDocument();
      expect(screen.getByText("Agen · agency")).toBeInTheDocument();
      expect(screen.getByText("Vendor · licensed vendor")).toBeInTheDocument();
    });

    it("renders all role titles", () => {
      render(<AppHome />);
      expect(screen.getByText("Pesan & buku amanah")).toBeInTheDocument();
      expect(screen.getByText("Konsol agen")).toBeInTheDocument();
      expect(screen.getByText("Tanda tangani faktur")).toBeInTheDocument();
    });

    it("component returns JSX.Element", () => {
      const result = <AppHome />;
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });

    it("renders footer link contains demo key message", () => {
      render(<AppHome />);
      expect(screen.getByText(/Penerbit klaim adalah kunci demo/)).toBeInTheDocument();
      expect(screen.getByText(/The claim issuer is a demo key/)).toBeInTheDocument();
    });

    it("verifies all links have proper anchor structure", () => {
      const { container } = render(<AppHome />);
      const links = container.querySelectorAll("a[href^='/app/']");
      expect(links).toHaveLength(3);

      const hrefs = Array.from(links).map(link => link.getAttribute("href"));
      expect(hrefs).toContain("/app/jamaah");
      expect(hrefs).toContain("/app/agen");
      expect(hrefs).toContain("/app/vendor");
    });

    it("renders component without errors", () => {
      expect(() => {
        render(<AppHome />);
      }).not.toThrow();
    });
  });

  describe("Component exports", () => {
    it("exports AppHome as default export", () => {
      expect(AppHome).toBeDefined();
      expect(typeof AppHome).toBe("function");
    });

    it("metadata is exported as named export", () => {
      expect(metadata).toBeDefined();
    });
  });
});
