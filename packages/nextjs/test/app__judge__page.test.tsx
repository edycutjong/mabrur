import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import JudgePage, { metadata } from "~~/app/judge/page";

// Mock next/link to render normally
vi.mock("next/link", async () => {
  const actual = await vi.importActual("next/link");
  return actual;
});

// Mock the metadata utility
vi.mock("~~/utils/scaffold-eth/getMetadata", () => ({
  getMetadata: vi.fn(opts => ({
    title: opts.title,
    description: opts.description,
  })),
}));

describe("app/judge/page", () => {
  describe("metadata export", () => {
    it("exports metadata with correct title", () => {
      expect(metadata).toBeDefined();
      expect(metadata.title).toBe("For judges");
    });

    it("exports metadata with correct description", () => {
      expect(metadata.description).toContain("Mabrur in 30 seconds");
      expect(metadata.description).toContain("on-chain receipts");
      expect(metadata.description).toContain("honest limits");
    });
  });

  describe("JudgePage component structure", () => {
    it("renders main container with correct classes", () => {
      const { container } = render(<JudgePage />);
      const mainDiv = container.querySelector(".w-full.max-w-4xl");

      expect(mainDiv).toBeInTheDocument();
      expect(mainDiv).toHaveClass("mx-auto", "px-4", "lg:px-8", "py-8", "lg:py-12");
      expect(mainDiv).toHaveClass("flex", "flex-col", "gap-8");
    });

    it("renders header section", () => {
      render(<JudgePage />);
      const header = screen.getByRole("heading", { level: 1 });

      expect(header).toBeInTheDocument();
      expect(header.textContent).toContain("A pilgrim's prepayment can only be spent on her own trip");
    });

    it("renders header subtitle", () => {
      render(<JudgePage />);
      const subtitle = screen.getByText(/For judges · 30 seconds/i);

      expect(subtitle).toBeInTheDocument();
    });

    it("renders header description paragraph", () => {
      render(<JudgePage />);
      const description = screen.getByText(/Mabrur earmarks each pilgrim's rupiah per line/i);

      expect(description).toBeInTheDocument();
      expect(description.textContent).toContain("non-transferable token on Arbitrum One");
      expect(description.textContent).toContain("claim-verified vendor");
      expect(description.textContent).toContain("refund the rest");
    });
  });

  describe("30-second path section", () => {
    it("renders section heading", () => {
      render(<JudgePage />);
      const heading = screen.getByText(/The 30-second path/i);

      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe("H2");
    });

    it("renders ordered list with four items", () => {
      const { container } = render(<JudgePage />);
      const list = container.querySelector("ol.list-decimal");

      expect(list).toBeInTheDocument();
      const items = list?.querySelectorAll("li");
      expect(items).toHaveLength(4);
    });

    it("renders Pak Ahmad link with correct ID", () => {
      render(<JudgePage />);
      const links = screen.getAllByRole("link", { name: "/app/jamaah" });
      const ahmadLink = links[0];

      expect(ahmadLink).toBeInTheDocument();
      expect(ahmadLink).toHaveAttribute(
        "href",
        "/app/jamaah?id=93071288952676167289577516806255635492368093588595261547394544652192346034554",
      );
    });

    it("renders Ibu Siti link with correct ID", () => {
      render(<JudgePage />);
      const links = screen.getAllByRole("link", { name: "/app/jamaah" });
      const sitiLink = links[1];

      expect(sitiLink).toHaveAttribute(
        "href",
        "/app/jamaah?id=38303033312745746094663211795656914215448779063347601464497604008460359611737",
      );
    });

    it("renders vendor page link", () => {
      render(<JudgePage />);
      const vendorLink = screen.getByRole("link", { name: /vendor page/i });

      expect(vendorLink).toBeInTheDocument();
      expect(vendorLink).toHaveAttribute("href", "/app/vendor");
    });

    it("renders agency console link", () => {
      render(<JudgePage />);
      const agencyLink = screen.getByRole("link", { name: /agency console/i });

      expect(agencyLink).toBeInTheDocument();
      expect(agencyLink).toHaveAttribute("href", "/app/agen");
    });

    it("renders list item with Indonesian action instructions", () => {
      render(<JudgePage />);
      const tempelText = screen.getByText(/Tempel faktur/i);
      const bacaText = screen.getByText(/Baca faktur/i);
      const simulasiText = screen.getByText(/Simulasi saja/i);

      expect(tempelText).toBeInTheDocument();
      expect(bacaText).toBeInTheDocument();
      expect(simulasiText).toBeInTheDocument();
    });
  });

  describe("receipts table section", () => {
    it("renders receipts section heading", () => {
      render(<JudgePage />);
      const heading = screen.getByText("Receipts");

      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe("H2");
    });

    it("renders table with correct data-testid", () => {
      render(<JudgePage />);
      const table = screen.getByTestId("receipts");

      expect(table).toBeInTheDocument();
      expect(table.tagName).toBe("TABLE");
    });

    it("renders table headers", () => {
      render(<JudgePage />);
      const headerCells = screen.getAllByRole("columnheader");

      expect(headerCells).toHaveLength(3);
      expect(headerCells[0]).toHaveTextContent("Rejected attempt");
      expect(headerCells[1]).toHaveTextContent("What the agency tried");
      expect(headerCells[2]).toHaveTextContent("Mined tx");
    });

    it("renders all four revert error rows", () => {
      render(<JudgePage />);
      const rows = screen.getAllByRole("row");

      // Header row + 4 data rows = 5 total
      expect(rows).toHaveLength(5);
    });

    it("renders EarmarkMismatch error", () => {
      render(<JudgePage />);
      const error = screen.getByText("EarmarkMismatch");

      expect(error).toBeInTheDocument();
      expect(error).toHaveClass("mb-receipt-err");
    });

    it("renders EarmarkMismatch description", () => {
      render(<JudgePage />);
      const description = screen.getByText(/Siti's hotel invoice used on another pilgrim's booking/i);

      expect(description).toBeInTheDocument();
    });

    it("renders VendorClaimMissing error", () => {
      render(<JudgePage />);
      const error = screen.getByText("VendorClaimMissing");

      expect(error).toBeInTheDocument();
    });

    it("renders VendorClaimMissing description", () => {
      render(<JudgePage />);
      const description = screen.getByText(/Invoice signed by the agency director/i);

      expect(description).toBeInTheDocument();
    });

    it("renders InvoiceReplayed error", () => {
      render(<JudgePage />);
      const error = screen.getByText("InvoiceReplayed");

      expect(error).toBeInTheDocument();
    });

    it("renders InvoiceReplayed description", () => {
      render(<JudgePage />);
      const description = screen.getByText(/An already-paid invoice submitted again/i);

      expect(description).toBeInTheDocument();
    });

    it("renders NotDeparted error", () => {
      render(<JudgePage />);
      const error = screen.getByText("NotDeparted");

      expect(error).toBeInTheDocument();
    });

    it("renders NotDeparted description", () => {
      render(<JudgePage />);
      const description = screen.getByText(/Agency signs its own 'departure' to take its fee/i);

      expect(description).toBeInTheDocument();
    });

    it("renders all four transaction links with abbreviated hashes", () => {
      render(<JudgePage />);
      const txLinks = screen.getAllByRole("link", { name: /transaction/i });

      expect(txLinks).toHaveLength(4);
      // Check that abbreviated hashes are displayed
      txLinks.forEach(link => {
        const text = link.textContent;
        // Pattern: 0x + 8 chars + … + 6 chars
        expect(text).toMatch(/^0x[0-9a-f]{8}…[0-9a-f]{6}$/);
      });
    });

    it("renders transaction links to Arbiscan with correct target", () => {
      render(<JudgePage />);
      const txLinks = screen.getAllByRole("link", { name: /transaction/i });

      txLinks.forEach(link => {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer");
        expect(link).toHaveAttribute("href", expect.stringMatching(/^https:\/\/arbiscan\.io\/tx\//));
      });
    });

    it("renders EarmarkMismatch tx link with full hash in title", () => {
      render(<JudgePage />);
      const txLink = screen.getByTitle("0x9ed30e3802f988fb2219a08c9d184ab779da13d2afbc7f9314d0ab3fa0bbc316");

      expect(txLink).toBeInTheDocument();
      expect(txLink).toHaveAttribute(
        "href",
        "https://arbiscan.io/tx/0x9ed30e3802f988fb2219a08c9d184ab779da13d2afbc7f9314d0ab3fa0bbc316",
      );
    });

    it("renders VendorClaimMissing tx link with full hash in title", () => {
      render(<JudgePage />);
      const txLink = screen.getByTitle("0x887d6b86d4361666b883edb9624efbd9bef0cdc6e4b0244149433d964beffa61");

      expect(txLink).toBeInTheDocument();
      expect(txLink).toHaveAttribute(
        "href",
        "https://arbiscan.io/tx/0x887d6b86d4361666b883edb9624efbd9bef0cdc6e4b0244149433d964beffa61",
      );
    });

    it("renders InvoiceReplayed tx link with full hash in title", () => {
      render(<JudgePage />);
      const txLink = screen.getByTitle("0x952f30adf9d7cc08982d8128c5e0de85a241d92a2d0e099799df6c7a75b9619a");

      expect(txLink).toBeInTheDocument();
      expect(txLink).toHaveAttribute(
        "href",
        "https://arbiscan.io/tx/0x952f30adf9d7cc08982d8128c5e0de85a241d92a2d0e099799df6c7a75b9619a",
      );
    });

    it("renders NotDeparted tx link with full hash in title", () => {
      render(<JudgePage />);
      const txLink = screen.getByTitle("0xe4855ebd72f05a8756a814cc8fbfb963b18f70bdd16856130cff391e1df5291b");

      expect(txLink).toBeInTheDocument();
      expect(txLink).toHaveAttribute(
        "href",
        "https://arbiscan.io/tx/0xe4855ebd72f05a8756a814cc8fbfb963b18f70bdd16856130cff391e1df5291b",
      );
    });

    it("renders receipts info list items", () => {
      render(<JudgePage />);
      const infoItems = screen.getAllByText(/87 tests/);

      expect(infoItems.length).toBeGreaterThan(0);
    });

    it("renders test coverage info", () => {
      render(<JudgePage />);
      const testInfo = screen.getByText(/87 tests/);

      expect(testInfo).toBeInTheDocument();
      const parentLi = testInfo.closest("li");
      expect(parentLi?.textContent).toContain("100% line, branch and function coverage");
    });

    it("renders gas cost info", () => {
      render(<JudgePage />);
      const costInfo = screen.getByText(/907,185 gas/);

      expect(costInfo).toBeInTheDocument();
      expect(costInfo.textContent).toContain("Rp 809");
      expect(costInfo.textContent).toContain("582,938 gas");
    });

    it("renders Arbiscan contract verification links", () => {
      render(<JudgePage />);
      const pbmLink = screen.getByRole("link", { name: /MabrurPBM/i });
      const registryLink = screen.getByRole("link", { name: /ClaimRegistry/i });
      const tidrLink = screen.getByRole("link", { name: /TIDR/i });

      expect(pbmLink).toBeInTheDocument();
      expect(registryLink).toBeInTheDocument();
      expect(tidrLink).toBeInTheDocument();

      expect(pbmLink).toHaveAttribute(
        "href",
        "https://arbiscan.io/address/0x36f1d899d9d4411b2DdfB60Dbbe989220336d2D5#code",
      );
      expect(registryLink).toHaveAttribute(
        "href",
        "https://arbiscan.io/address/0xd5B731CD0f2c91D5D64b59d9E4a2A4E4b6315ADb#code",
      );
      expect(tidrLink).toHaveAttribute(
        "href",
        "https://arbiscan.io/address/0x66F838be32A624f4C797483a151C7f6209A43448#code",
      );
    });

    it("renders contract links to open in new tab", () => {
      render(<JudgePage />);
      const pbmLink = screen.getByRole("link", { name: /MabrurPBM/i });
      const registryLink = screen.getByRole("link", { name: /ClaimRegistry/i });
      const tidrLink = screen.getByRole("link", { name: /TIDR/i });

      [pbmLink, registryLink, tidrLink].forEach(link => {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer");
      });
    });
  });

  describe("reproduce section", () => {
    it("renders reproduce section heading", () => {
      render(<JudgePage />);
      const heading = screen.getByText("Reproduce");

      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe("H2");
    });

    it("renders code block with git clone command", () => {
      render(<JudgePage />);
      const codeBlock = screen.getByRole("region", {
        name: /Reproduce commands/i,
      });

      expect(codeBlock).toBeInTheDocument();
      expect(codeBlock).toHaveClass("mb-pre");
      expect(codeBlock).toHaveAttribute("tabIndex", "0");
      expect(codeBlock.textContent).toContain("git clone --recursive");
      expect(codeBlock.textContent).toContain("mabrur.git");
    });

    it("renders code block with forge test command", () => {
      render(<JudgePage />);
      const codeBlock = screen.getByRole("region", {
        name: /Reproduce commands/i,
      });

      expect(codeBlock.textContent).toContain("forge test");
    });

    it("renders code block with cast run command", () => {
      render(<JudgePage />);
      const codeBlock = screen.getByRole("region", {
        name: /Reproduce commands/i,
      });

      expect(codeBlock.textContent).toContain("cast run");
      expect(codeBlock.textContent).toContain("arb1.arbitrum.io/rpc");
    });

    it("renders reproduce disclaimer text", () => {
      render(<JudgePage />);
      const disclaimer = screen.getByText(/Every demo script broadcasts to Arbitrum One/i);

      expect(disclaimer).toBeInTheDocument();
      expect(disclaimer.textContent).toContain("no mock, offline or dry-run mode");
    });
  });

  describe("honest limits section", () => {
    it("renders honest limits section heading", () => {
      render(<JudgePage />);
      const heading = screen.getByText("Honest limits");

      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe("H2");
    });

    it("renders tidr token limit info", () => {
      render(<JudgePage />);
      const limitText = screen.getByText(/tIDR is a test token with no value/i);

      expect(limitText).toBeInTheDocument();
      expect(limitText.textContent).toContain("no licensed rupiah token");
      expect(limitText.textContent).toContain("Arbitrum One");
    });

    it("renders claim issuer limit info", () => {
      render(<JudgePage />);
      const limitText = screen.getByText(/The claim issuer is a demo key/i);

      expect(limitText).toBeInTheDocument();
      expect(limitText.textContent).toContain("Kemenag");
      expect(limitText.textContent).toContain("IATA");
    });

    it("renders seat guarantee limit info", () => {
      render(<JudgePage />);
      const limitText = screen.getByText(/Mabrur cannot guarantee a seat/i);

      expect(limitText).toBeInTheDocument();
      expect(limitText.textContent).toContain("paid ticket");
      expect(limitText.textContent).toContain("unspent rupiah back");
    });
  });

  describe("action buttons section", () => {
    it("renders GitHub repo button", () => {
      render(<JudgePage />);
      const githubBtn = screen.getByRole("link", { name: /GitHub repo/i });

      expect(githubBtn).toBeInTheDocument();
      expect(githubBtn).toHaveAttribute("href", "https://github.com/edycutjong/mabrur");
      expect(githubBtn).toHaveAttribute("target", "_blank");
      expect(githubBtn).toHaveClass("mb-btn");
    });

    it("renders DEMO.md button", () => {
      render(<JudgePage />);
      const demoBtn = screen.getByRole("link", { name: /DEMO.md ledger/i });

      expect(demoBtn).toBeInTheDocument();
      expect(demoBtn).toHaveAttribute("href", "https://github.com/edycutjong/mabrur/blob/main/DEMO.md");
      expect(demoBtn).toHaveAttribute("target", "_blank");
      expect(demoBtn).toHaveClass("mb-btn", "mb-btn-ghost");
    });

    it("renders Open the app button", () => {
      render(<JudgePage />);
      const appBtn = screen.getByRole("link", { name: /Open the app/i });

      expect(appBtn).toBeInTheDocument();
      expect(appBtn).toHaveAttribute("href", "/app");
      expect(appBtn).toHaveClass("mb-btn", "mb-btn-ghost");
    });

    it("renders all three action buttons", () => {
      render(<JudgePage />);
      const buttons = screen.getAllByRole("link", {
        name: /GitHub repo|DEMO.md ledger|Open the app/i,
      });

      expect(buttons).toHaveLength(3);
    });
  });

  describe("link class names", () => {
    it("applies link class to internal navigation links", () => {
      render(<JudgePage />);
      const links = screen.getAllByRole("link", { name: "/app/jamaah" });
      const ahmadLink = links[0];

      expect(ahmadLink).toHaveClass("link");
    });

    it("applies link class to vendor and agen links", () => {
      render(<JudgePage />);
      const vendorLink = screen.getByRole("link", { name: /vendor page/i });
      const agenLink = screen.getByRole("link", { name: /agency console/i });

      expect(vendorLink).toHaveClass("link");
      expect(agenLink).toHaveClass("link");
    });

    it("applies link class to contract verification links", () => {
      render(<JudgePage />);
      const pbmLink = screen.getByRole("link", { name: /MabrurPBM/i });

      expect(pbmLink).toHaveClass("link");
    });

    it("applies link class to transaction links", () => {
      render(<JudgePage />);
      const txLinks = screen.getAllByRole("link", { name: /transaction/i });

      txLinks.forEach(link => {
        expect(link).toHaveClass("link");
        expect(link).toHaveClass("mb-receipt-tx");
      });
    });
  });

  describe("semantic HTML and accessibility", () => {
    it("uses semantic header element", () => {
      const { container } = render(<JudgePage />);
      const header = container.querySelector("header");

      expect(header).toBeInTheDocument();
    });

    it("uses semantic section elements", () => {
      const { container } = render(<JudgePage />);
      const sections = container.querySelectorAll("section");

      expect(sections.length).toBeGreaterThanOrEqual(4);
    });

    it("uses proper heading hierarchy", () => {
      render(<JudgePage />);
      const h1 = screen.getByRole("heading", { level: 1 });
      const h2s = screen.getAllByRole("heading", { level: 2 });

      expect(h1).toBeInTheDocument();
      expect(h2s.length).toBeGreaterThanOrEqual(4);
    });

    it("renders transaction link with aria-label", () => {
      render(<JudgePage />);
      const txLinks = screen.getAllByRole("link", { name: /transaction/i });

      txLinks.forEach(link => {
        expect(link).toHaveAttribute("aria-label");
        expect(link.getAttribute("aria-label")).toContain("transaction");
        expect(link.getAttribute("aria-label")).toContain("Arbiscan");
      });
    });

    it("renders code region with proper aria-label", () => {
      render(<JudgePage />);
      const codeRegion = screen.getByRole("region", {
        name: /Reproduce commands/i,
      });

      expect(codeRegion).toHaveAttribute("aria-label");
      expect(codeRegion.getAttribute("aria-label")).toContain("clone");
      expect(codeRegion.getAttribute("aria-label")).toContain("Foundry tests");
    });

    it("table data cells have data-label attributes for responsive design", () => {
      render(<JudgePage />);
      const dataCells = screen.getAllByText(/EarmarkMismatch|Siti's hotel invoice/).slice(0, 2);

      dataCells.forEach(cell => {
        const row = cell.closest("td");
        expect(row).toHaveAttribute("data-label");
      });
    });
  });

  describe("table data cell attributes", () => {
    it("renders all table data cells with correct data-label values", () => {
      const { container } = render(<JudgePage />);
      const dataCells = container.querySelectorAll("td[data-label]");

      const labels = Array.from(dataCells).map(cell => cell.getAttribute("data-label"));

      expect(labels).toContain("Rejected attempt");
      expect(labels).toContain("What the agency tried");
      expect(labels).toContain("Mined tx");
    });

    it("renders error cells with mb-receipt-err class", () => {
      const { container } = render(<JudgePage />);
      const errorCells = container.querySelectorAll(".mb-receipt-err");

      expect(errorCells).toHaveLength(4);
      expect(errorCells[0]).toHaveTextContent("EarmarkMismatch");
      expect(errorCells[1]).toHaveTextContent("VendorClaimMissing");
      expect(errorCells[2]).toHaveTextContent("InvoiceReplayed");
      expect(errorCells[3]).toHaveTextContent("NotDeparted");
    });
  });

  describe("layout and responsive classes", () => {
    it("applies correct padding classes to main container", () => {
      const { container } = render(<JudgePage />);
      const mainDiv = container.querySelector(".w-full.max-w-4xl");

      expect(mainDiv).toHaveClass("px-4", "lg:px-8", "py-8", "lg:py-12");
    });

    it("applies list styling to numbered list", () => {
      const { container } = render(<JudgePage />);
      const ol = container.querySelector("ol.list-decimal");

      expect(ol).toHaveClass("pl-5", "flex", "flex-col", "gap-2");
    });

    it("applies list styling to bullet lists", () => {
      const { container } = render(<JudgePage />);
      const uls = container.querySelectorAll("ul.list-disc");

      expect(uls.length).toBeGreaterThan(0);
      uls.forEach(ul => {
        expect(ul).toHaveClass("pl-5", "flex", "flex-col", "gap-1");
      });
    });

    it("applies section styling classes", () => {
      const { container } = render(<JudgePage />);
      const sheets = container.querySelectorAll(".mb-sheet");

      expect(sheets.length).toBeGreaterThan(0);
      sheets.forEach(sheet => {
        expect(sheet).toHaveClass("flex", "flex-col", "gap-3");
      });
    });

    it("renders button section with flex wrap", () => {
      const { container } = render(<JudgePage />);
      const buttonSection = container.querySelector("section.flex.flex-wrap");

      expect(buttonSection).toBeInTheDocument();
      expect(buttonSection).toHaveClass("gap-3");
    });
  });

  describe("constants validation", () => {
    it("renders all four revert error names in correct order", () => {
      render(<JudgePage />);
      const errors = [
        screen.getByText("EarmarkMismatch"),
        screen.getByText("VendorClaimMissing"),
        screen.getByText("InvoiceReplayed"),
        screen.getByText("NotDeparted"),
      ];

      expect(errors).toHaveLength(4);
    });

    it("Ahmad ID renders in correct link", () => {
      render(<JudgePage />);
      const links = screen.getAllByRole("link", { name: "/app/jamaah" });
      const ahmadLink = links[0];

      expect(ahmadLink.getAttribute("href")).toContain(
        "93071288952676167289577516806255635492368093588595261547394544652192346034554",
      );
    });

    it("Siti ID renders in correct link", () => {
      render(<JudgePage />);
      const links = screen.getAllByRole("link", { name: "/app/jamaah" });
      const sitiLink = links[1];

      expect(sitiLink.getAttribute("href")).toContain(
        "38303033312745746094663211795656914215448779063347601464497604008460359611737",
      );
    });

    it("displays abbreviated transaction hashes correctly", () => {
      render(<JudgePage />);
      const txLink = screen.getByRole("link", {
        name: /EarmarkMismatch transaction/i,
      });

      expect(txLink).toBeInTheDocument();
      expect(txLink.textContent).toMatch(/^0x[0-9a-f]{8}…[0-9a-f]{6}$/);
    });
  });

  describe("integration - full page render", () => {
    it("renders complete judge page with all major sections", () => {
      const { container } = render(<JudgePage />);

      // Main container
      expect(container.querySelector(".w-full.max-w-4xl")).toBeInTheDocument();

      // Header with main title
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toContain("A pilgrim's prepayment");

      // All main sections
      expect(screen.getByText(/The 30-second path/i)).toBeInTheDocument();
      const receiptsHeading = screen.getAllByRole("heading", { level: 2 }).find(h => h.textContent === "Receipts");
      expect(receiptsHeading).toBeInTheDocument();
      expect(screen.getByText(/Reproduce/i)).toBeInTheDocument();
      expect(screen.getByText(/Honest limits/i)).toBeInTheDocument();

      // Navigation elements
      expect(screen.getByTestId("receipts")).toBeInTheDocument();

      // Action buttons
      expect(screen.getByRole("link", { name: /GitHub repo/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Open the app/i })).toBeInTheDocument();
    });

    it("renders all transaction links to Arbiscan", () => {
      render(<JudgePage />);
      const txLinks = screen.getAllByRole("link", { name: /transaction/i });

      expect(txLinks).toHaveLength(4);
      txLinks.forEach(link => {
        expect(link).toHaveAttribute("href", expect.stringMatching(/arbiscan\.io\/tx\/0x/));
      });
    });

    it("all external links have target blank and noreferrer", () => {
      render(<JudgePage />);
      const externalLinks = screen.getAllByRole("link", {
        name: /GitHub|Arbiscan|MabrurPBM|ClaimRegistry|TIDR|DEMO.md/i,
      });

      externalLinks.forEach(link => {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer");
      });
    });
  });

  describe("content accuracy", () => {
    it("renders correct gas cost value for departed pilgrim", () => {
      render(<JudgePage />);
      expect(screen.getByText(/907,185 gas/)).toBeInTheDocument();
    });

    it("renders correct rupiah equivalent for departed pilgrim", () => {
      render(<JudgePage />);
      expect(screen.getByText(/Rp 809/)).toBeInTheDocument();
    });

    it("renders correct gas cost for refunded pilgrim", () => {
      render(<JudgePage />);
      expect(screen.getByText(/582,938 gas/)).toBeInTheDocument();
    });

    it("renders correct rupiah equivalent for refunded pilgrim", () => {
      render(<JudgePage />);
      expect(screen.getByText(/Rp 520/)).toBeInTheDocument();
    });

    it("renders ETH/IDR exchange rate date", () => {
      render(<JudgePage />);
      expect(screen.getByText(/CoinGecko, 9 Oct 2026/)).toBeInTheDocument();
    });
  });
});
