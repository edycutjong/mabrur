import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "~~/components/Footer";

// Mock next/link to render a simple anchor element
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("Footer component", () => {
  beforeEach(() => {
    // Ensure clean render state
  });

  it("renders the footer element with correct structure", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass("border-t", "border-[var(--rule)]", "mt-10");
  });

  it("renders the container div with correct classes", () => {
    render(<Footer />);
    const container = screen.getByRole("contentinfo").querySelector(".max-w-\\[1600px\\]");
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass("mx-auto", "px-4", "lg:px-8", "py-5", "text-sm", "flex", "flex-col", "gap-3");
  });

  it("renders the navigation with correct aria-label", () => {
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: "Tautan" });
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass("flex", "flex-wrap", "gap-x-5", "gap-y-1", "font-bold");
  });

  it("renders the judge link with correct href and text", () => {
    render(<Footer />);
    const judgeLink = screen.getByRole("link", { name: /Untuk juri · For judges/i });
    expect(judgeLink).toBeInTheDocument();
    expect(judgeLink).toHaveAttribute("href", "/judge");
    expect(judgeLink).toHaveClass("mb-link");
  });

  it("renders the GitHub external link with correct attributes", () => {
    render(<Footer />);
    const githubLink = screen.getByRole("link", { name: /GitHub: edycutjong\/mabrur/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute("href", "https://github.com/edycutjong/mabrur");
    expect(githubLink).toHaveAttribute("target", "_blank");
    expect(githubLink).toHaveAttribute("rel", "noreferrer");
    expect(githubLink).toHaveClass("mb-link");
  });

  it("renders the debug/contracts link with correct href and text", () => {
    render(<Footer />);
    const debugLink = screen.getByRole("link", { name: /Contracts \(debug\)/i });
    expect(debugLink).toBeInTheDocument();
    expect(debugLink).toHaveAttribute("href", "/debug");
    expect(debugLink).toHaveClass("mb-link", "mb-muted");
  });

  it("renders the disclaimer section with correct classes", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    const disclaimerDiv = footer.querySelector(".mb-muted.flex");
    expect(disclaimerDiv).toBeInTheDocument();
    expect(disclaimerDiv).toHaveClass("flex", "flex-wrap", "gap-x-6", "gap-y-1");
  });

  it("renders the first disclaimer span", () => {
    render(<Footer />);
    expect(screen.getByText(/tIDR = token uji tanpa nilai · test token, no value/i)).toBeInTheDocument();
  });

  it("renders the second disclaimer span", () => {
    render(<Footer />);
    expect(screen.getByText(/Nama agen & vendor fiktif · fictional names/i)).toBeInTheDocument();
  });

  it("renders the third disclaimer span", () => {
    render(<Footer />);
    expect(screen.getByText(/Penerbit klaim = kunci demo · demo claim issuer/i)).toBeInTheDocument();
  });

  it("renders all three disclaimer spans", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    const disclaimerDiv = footer.querySelector(".mb-muted.flex");
    const spans = disclaimerDiv?.querySelectorAll("span");
    expect(spans).toHaveLength(3);
  });

  it("renders all navigation links", () => {
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: "Tautan" });
    const links = nav.querySelectorAll("a");
    expect(links).toHaveLength(3);
  });

  it("renders complete footer with all content", () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector("footer");
    expect(footer).toBeInTheDocument();
    expect(footer?.textContent).toContain("Untuk juri");
    expect(footer?.textContent).toContain("edycutjong/mabrur");
    expect(footer?.textContent).toContain("Contracts");
    expect(footer?.textContent).toContain("tIDR");
    expect(footer?.textContent).toContain("fictional names");
    expect(footer?.textContent).toContain("demo claim issuer");
  });

  it("verifies footer is rendered as a semantic footer element", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(footer.tagName).toBe("FOOTER");
  });

  it("verifies navigation links have correct order", () => {
    render(<Footer />);
    const nav = screen.getByRole("navigation", { name: "Tautan" });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links[0]).toHaveAttribute("href", "/judge");
    expect(links[1]).toHaveAttribute("href", "https://github.com/edycutjong/mabrur");
    expect(links[2]).toHaveAttribute("href", "/debug");
  });

  it("verifies the GitHub link opens in a new tab with security attributes", () => {
    render(<Footer />);
    const githubLink = screen.getByRole("link", { name: /GitHub: edycutjong\/mabrur/i });
    expect(githubLink.getAttribute("target")).toBe("_blank");
    expect(githubLink.getAttribute("rel")).toBe("noreferrer");
  });

  it("verifies footer layout structure with nested divs", () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector("footer");
    const firstDiv = footer?.firstElementChild as HTMLElement;
    expect(firstDiv).toHaveClass("max-w-[1600px]");
    expect(firstDiv.children.length).toBe(2); // nav and disclaimer div
  });

  it("verifies disclaimer spans contain exact HTML entity", () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector("footer");
    const disclaimerText = footer?.textContent;
    expect(disclaimerText).toContain("&");
  });
});
