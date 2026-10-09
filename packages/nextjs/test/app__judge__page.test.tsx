import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import JudgePage, { metadata } from "~~/app/judge/page";

vi.mock("~~/utils/scaffold-eth/getMetadata", () => ({
  getMetadata: vi.fn(opts => ({ title: opts.title, description: opts.description })),
}));

const en = () => document.documentElement.classList.add("lang-en");
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const TXS = [
  ["EarmarkMismatch", "0x9ed30e3802f988fb2219a08c9d184ab779da13d2afbc7f9314d0ab3fa0bbc316"],
  ["VendorClaimMissing", "0x887d6b86d4361666b883edb9624efbd9bef0cdc6e4b0244149433d964beffa61"],
  ["InvoiceReplayed", "0x952f30adf9d7cc08982d8128c5e0de85a241d92a2d0e099799df6c7a75b9619a"],
  ["NotDeparted", "0xe4855ebd72f05a8756a814cc8fbfb963b18f70bdd16856130cff391e1df5291b"],
].map(([err, tx]) => [err, tx, short(tx)]);

describe("app/judge/page", () => {
  it("exports the judge metadata", () => {
    expect(metadata.title).toBe("For judges");
    expect(metadata.description).toContain("Mabrur in 30 seconds");
  });

  it("server-renders both languages (no dependence on the viewer's choice)", () => {
    const html = renderToString(<JudgePage />);
    expect(html).toContain("A pilgrim&#x27;s prepayment can only be spent on her own trip.");
    expect(html).toContain("Uang muka jamaah hanya bisa dipakai untuk perjalanannya sendiri.");
  });

  describe("Indonesian (default)", () => {
    it("states the claim and the intro in Indonesian only", () => {
      render(<JudgePage />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(
        "Uang muka jamaah hanya bisa dipakai untuk perjalanannya sendiri.",
      );
      const rules = screen.getAllByRole("list")[0];
      expect(rules).toHaveClass("mb-rules");
      expect(within(rules).getAllByRole("listitem")).toHaveLength(4);
      expect(within(rules).getByText("Penerima uangnya selalu si penanda tangan.")).toBeVisible();
      expect(screen.getByText(/^Mabrur mengunci rupiah setiap jamaah per pos/)).toBeVisible();
      expect(screen.getByText(/^Mabrur earmarks each pilgrim/)).not.toBeVisible();
    });

    it("has the four section headings", () => {
      render(<JudgePage />);
      const names = screen.getAllByRole("heading", { level: 2 }).map(h => h.textContent);
      expect(names.length).toBe(4);
      for (const h of [
        "Jalur 30 detik (tanpa dompet, tanpa instal)",
        "Bukti on-chain",
        "Reproduksi",
        "Batasan yang jujur",
      ])
        expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    });

    it("walks the 30-second path with working links", () => {
      render(<JudgePage />);
      const list = screen.getAllByRole("list").find(l => l.tagName === "OL")!;
      expect(within(list).getAllByRole("listitem")).toHaveLength(4);
      expect(within(list).getByRole("link", { name: "Buka booking Pak Ahmad" })).toHaveAttribute(
        "href",
        expect.stringContaining("/app/jamaah?id=9307128895"),
      );
      expect(within(list).getByRole("link", { name: "Buka booking Ibu Siti" })).toHaveAttribute(
        "href",
        expect.stringContaining("/app/jamaah?id=3830303331"),
      );
      expect(within(list).getByText("LUNAS")).toHaveClass("mb-chip-paid");
      expect(within(list).getByText("DIKEMBALIKAN")).toHaveClass("mb-chip-returned");
      expect(screen.getByRole("link", { name: "halaman vendor" })).toHaveAttribute("href", "/app/vendor");
      expect(screen.getByRole("link", { name: "konsol agen" })).toHaveAttribute("href", "/app/agen");
      const step4 = within(list).getAllByRole("listitem")[3];
      expect(step4.querySelector(".t-id")).toHaveTextContent(
        "(Tempel faktur → Baca faktur), lalu tekan Simulasi saja di sana.",
      );
    });

    it("lists the four mined refusals with their error names and Arbiscan links", () => {
      render(<JudgePage />);
      const table = screen.getByTestId("receipts");
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map(th => th.textContent),
      ).toEqual([
        "Percobaan yang ditolakRejected attempt",
        "Yang dicoba agenWhat the agency tried",
        "Tx tertambangMined tx",
      ]);
      expect(within(table).getByRole("columnheader", { name: "Percobaan yang ditolak" })).toBeInTheDocument();
      expect(within(table).getAllByRole("row")).toHaveLength(5);
      for (const [err, tx, short] of TXS) {
        expect(within(table).getByText(err)).toHaveClass("mb-receipt-err");
        const link = within(table).getByRole("link", {
          name: new RegExp(`^Transaksi ${err} di Arbiscan:\\s*${short}$`),
        });
        expect(link).toHaveAttribute("href", `https://arbiscan.io/tx/${tx}`);
        expect(link).toHaveAttribute("title", tx);
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer");
        expect(link.closest("td")).toHaveAttribute("data-label-id", "Tx tertambang");
        expect(link.closest("td")).toHaveAttribute("data-label-en", "Mined tx");
      }
      expect(screen.getByText("Faktur hotel Ibu Siti dipakai untuk booking jamaah lain")).toBeVisible();
    });

    it("gives tests, cost and verified contracts", () => {
      render(<JudgePage />);
      expect(screen.getByText("87 pengujian")).toBeVisible();
      expect(screen.getByText(/907\.185 gas ≈ Rp 809/)).toBeVisible();
      expect(screen.getByText(/582\.938 gas ≈ Rp 520/)).toBeVisible();
      for (const [name, addr] of [
        ["MabrurPBM", "0x36f1d899d9d4411b2DdfB60Dbbe989220336d2D5"],
        ["ClaimRegistry", "0xd5B731CD0f2c91D5D64b59d9E4a2A4E4b6315ADb"],
        ["TIDR", "0x66F838be32A624f4C797483a151C7f6209A43448"],
      ])
        expect(screen.getByRole("link", { name: new RegExp(`^${name} 0x`) })).toHaveAttribute(
          "href",
          `https://arbiscan.io/address/${addr}#code`,
        );
    });

    it("labels the keyboard-scrollable reproduce block", () => {
      render(<JudgePage />);
      const pre = screen.getByRole("region", { name: /^Perintah reproduksi/ });
      expect(pre).toHaveAttribute("tabindex", "0");
      expect(pre.textContent).toContain("git clone --recursive https://github.com/edycutjong/mabrur.git");
      expect(pre.textContent).toContain("forge test");
      expect(screen.getByText(/^cast run <tx mana pun di atas>/)).toBeVisible();
    });

    it("keeps the honest limits and the CTAs", () => {
      render(<JudgePage />);
      expect(screen.getByText(/^tIDR adalah token uji tanpa nilai/)).toBeVisible();
      expect(screen.getByText(/^Penerbit klaim adalah kunci demo/)).toBeVisible();
      expect(screen.getByText(/^Mabrur tidak bisa menjamin kursi/)).toBeVisible();
      expect(screen.getByRole("link", { name: "Repo GitHub" })).toHaveAttribute(
        "href",
        "https://github.com/edycutjong/mabrur",
      );
      expect(screen.getByRole("link", { name: "Buku besar DEMO.md" })).toHaveAttribute(
        "href",
        "https://github.com/edycutjong/mabrur/blob/main/DEMO.md",
      );
      expect(screen.getByRole("link", { name: "Buka aplikasi" })).toHaveAttribute("href", "/app");
    });
  });

  describe("English (EN mode)", () => {
    it("states the claim exactly", () => {
      en();
      render(<JudgePage />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName(
        "A pilgrim's prepayment can only be spent on her own trip.",
      );
      expect(screen.getByText("The payee is always that signer.")).toBeVisible();
      expect(screen.getByText(/^Mabrur earmarks each pilgrim/)).toBeVisible();
      expect(screen.getByText(/^Mabrur mengunci rupiah/)).not.toBeVisible();
    });

    it("shows every section in English", () => {
      en();
      render(<JudgePage />);
      for (const h of ["The 30-second path (no wallet, no install)", "Receipts", "Reproduce", "Honest limits"])
        expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "vendor page" })).toHaveAttribute("href", "/app/vendor");
      expect(screen.getByRole("link", { name: "agency console" })).toHaveAttribute("href", "/app/agen");
      const ol = screen.getAllByRole("list").find(l => l.tagName === "OL")!;
      const step4 = within(ol).getAllByRole("listitem")[3];
      expect(step4.querySelector(".t-en")).toHaveTextContent(
        "(Paste invoice → Read invoice), then press Simulate only there.",
      );
      expect(screen.getByRole("columnheader", { name: "Rejected attempt" })).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: new RegExp(`^EarmarkMismatch transaction on Arbiscan:\\s*${TXS[0][2]}$`) }),
      ).toBeInTheDocument();
      expect(screen.getByText("Siti's hotel invoice used on another pilgrim's booking")).toBeVisible();
      expect(screen.getByText("87 tests")).toBeVisible();
      expect(screen.getByText(/907,185 gas ≈ Rp 809/)).toBeVisible();
      expect(screen.getByRole("region", { name: /^Reproduce commands/ })).toBeInTheDocument();
      expect(screen.getByText(/^cast run <any tx above>/)).toBeVisible();
      expect(screen.getByText(/^tIDR is a test token with no value/)).toBeVisible();
      expect(screen.getByRole("link", { name: "GitHub repo" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "DEMO.md ledger" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Open the app" })).toHaveAttribute("href", "/app");
    });
  });
});
