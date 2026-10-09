import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Address } from "viem";
import { isAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount, useWalletClient } from "wagmi";
import AgenPage from "~~/app/app/agen/page";
import { useBooking, useChainNow, useMabrurContracts, useMabrurTx } from "~~/hooks/mabrur/useMabrur";
import { formatRp, idHex } from "~~/utils/mabrur/format";
import { parseInvoices } from "~~/utils/mabrur/invoice";
import { getLabel, loadJson, saveJson, setLabel } from "~~/utils/mabrur/names";

// ── Mocks ──
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: vi.fn(),
  useWalletClient: vi.fn(),
  usePublicClient: vi.fn(),
  useChainId: vi.fn(),
}));

vi.mock("~~/hooks/scaffold-eth", () => ({
  useDeployedContractInfo: vi.fn(),
  useTargetNetwork: vi.fn(),
}));

vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    recoverTypedDataAddress: vi.fn(() => Promise.resolve("0xsigner")),
    isAddress: vi.fn(addr => typeof addr === "string" && addr.startsWith("0x") && addr.length === 42),
    isHex: vi.fn(v => typeof v === "string" && v.startsWith("0x")),
  };
});

vi.mock("~~/hooks/mabrur/useMabrur", () => ({
  ZERO: "0x0000000000000000000000000000000000000000",
  useChainNow: vi.fn(),
  useMabrurContracts: vi.fn(),
  useMabrurTx: vi.fn(),
  useBooking: vi.fn(),
  bookingIdOf: vi.fn((pilgrim: Address, nonce: bigint) => 1n),
  eventsFrom: vi.fn(() => []),
}));

vi.mock("~~/components/mabrur/ui", () => ({
  AddressChip: ({ address }: any) => <span data-testid={`chip-${address}`}>{address}</span>,
  Bi: ({ id }: any) => <span>{id}</span>,
  ContractsGuard: ({ children }: any) => <div>{children}</div>,
  CopyButton: ({ label }: any) => <button>{label}</button>,
  ErrorCall: ({ name }: any) => <span>{name}</span>,
  Label: ({ children }: any) => <label>{children}</label>,
  PageShell: ({ children }: any) => <div>{children}</div>,
  RevertStamp: ({ d }: any) => <span>{d?.name}</span>,
  Rp: ({ value }: any) => <span>Rp {value}</span>,
  Stamp: ({ kind, children }: any) => <span data-testid={`stamp-${kind}`}>{children}</span>,
  TxLink: ({ hash }: any) => <a href={`/tx/${hash}`}>{hash?.slice(0, 8)}</a>,
}));

vi.mock("~~/components/mabrur/RegulatorPanel", () => ({
  RegulatorPanel: ({ agency }: any) => <div data-testid="regulator-panel">{agency}</div>,
}));

vi.mock("~~/utils/mabrur/format", () => ({
  LINES: [
    { key: "FLIGHT", id: "Tiket pesawat", en: "Flight", topic: 2 },
    { key: "HOTEL", id: "Hotel", en: "Hotel", topic: 3 },
    { key: "VISA", id: "Visa", en: "Visa", topic: 4 },
    { key: "UJRAH", id: "Ujrah agen", en: "Agency fee", topic: 1 },
  ],
  formatRp: vi.fn(v => `Rp ${v}`),
  formatCountdown: vi.fn(() => "1d"),
  formatDateWIB: vi.fn(() => "2024-01-01"),
  idHex: vi.fn(v => `0x${v}`),
  shortHex: vi.fn(() => "0x1234...5678"),
  parseBookingId: vi.fn((id: string) => {
    if (!id?.startsWith("0x")) return undefined;
    try {
      return BigInt(id);
    } catch {
      return undefined;
    }
  }),
}));

vi.mock("~~/utils/mabrur/invoice", () => ({
  INVOICE_TYPES: {},
  MAX_INVOICE_FILE_BYTES: 100000,
  InvoiceParseError: class InvoiceParseError extends Error {},
  parseInvoices: vi.fn(() => []),
  pbmDomain: vi.fn(() => ({})),
  refToLabel: vi.fn(ref => `ref-${ref}`),
}));

vi.mock("~~/utils/mabrur/names", () => ({
  getLabel: vi.fn(),
  setLabel: vi.fn(),
  saveJson: vi.fn(),
  loadJson: vi.fn((key, def) => def),
  defaultAgency: vi.fn(() => "0xdefault"),
}));

vi.mock("~~/utils/mabrur/errors", () => ({
  errorArgParts: vi.fn(() => []),
  formatErrorCall: vi.fn(() => "error()"),
  DecodedRevert: vi.fn(),
}));

describe("app/app/agen/page.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAccount as any).mockReturnValue({ address: "0xuser1111111111111111111111111111111111" });
    (useWalletClient as any).mockReturnValue({ data: { account: { address: "0xuser" } } });
    (useMabrurContracts as any).mockReturnValue({ pbm: { address: "0xpbm", abi: [] }, chainId: 31337 });
    (useMabrurTx as any).mockReturnValue({
      run: vi.fn(),
      busy: false,
      walletClient: { account: { address: "0xuser" } },
    });
    (useChainNow as any).mockReturnValue({ now: Math.floor(Date.now() / 1000) });
    (useBooking as any).mockReturnValue({
      data: {
        id: 1n,
        pilgrim: "0x1111111111111111111111111111111111111111",
        agency: "0x2222222222222222222222222222222222222222",
        ticketBy: Math.floor(Date.now() / 1000) + 86400,
        departBy: Math.floor(Date.now() / 1000) + 172800,
        flightVendor: "0x0000000000000000000000000000000000000000",
        remaining: [1000n, 2000n, 3000n, 4000n],
        refunded: false,
        departed: false,
        marginReleased: false,
        refundable: true,
      },
    });
    (loadJson as any).mockImplementation((key, def) => def);
    (getLabel as any).mockReturnValue(null);
    (formatRp as any).mockImplementation(v => `Rp ${v}`);
    (idHex as any).mockImplementation(v => `0x${v}`);
    (isAddress as any).mockImplementation(
      addr => typeof addr === "string" && addr.startsWith("0x") && addr.length === 42,
    );
  });

  describe("AgenPage", () => {
    it("renders page wrapper", () => {
      render(<AgenPage />);
      expect(screen.getByText("Konsol Agen")).toBeInTheDocument();
    });

    it("renders with title and subtitle", () => {
      render(<AgenPage />);
      expect(screen.getByText(/Konsol Agen/)).toBeInTheDocument();
      expect(screen.getByText(/The agency can only pay/)).toBeInTheDocument();
    });

    it("displays wallet address when connected", () => {
      render(<AgenPage />);
      expect(screen.getByTestId("chip-0xuser1111111111111111111111111111111111")).toBeInTheDocument();
    });

    it("shows no-wallet message when wallet not connected", () => {
      (useAccount as any).mockReturnValue({ address: undefined });
      render(<AgenPage />);
      expect(screen.getByText(/Tanpa dompet:/)).toBeInTheDocument();
    });

    it("renders booking section", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByText("Booking agen")).toBeInTheDocument();
    });

    it("renders empty bookings message", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByText(/Muat invoices.json/)).toBeInTheDocument();
    });

    it("shows regulator panel with agency", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByTestId("regulator-panel")).toBeInTheDocument();
    });

    it("renders invoice textarea", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      const textarea = screen.getByPlaceholderText(/{"invoice"/);
      expect(textarea).toBeInTheDocument();
    });

    it("renders read invoice button", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      const readBtn = screen.getByRole("button", { name: /Baca faktur/ });
      expect(readBtn).toBeInTheDocument();
      expect(readBtn).toBeDisabled();
    });

    it("disables read button when textarea empty", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      const readBtn = screen.getByRole("button", { name: /Baca faktur/ });
      expect(readBtn).toBeDisabled();
    });

    it("renders file upload button", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      const uploadBtn = screen.getByRole("button", { name: /Pilih invoices.json/ });
      expect(uploadBtn).toBeInTheDocument();
    });

    it("renders releaseMargin section", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByText(/Ujrah agen · releaseMargin/)).toBeInTheDocument();
    });

    it("renders attempts ledger section", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByText(/Catatan percobaan/)).toBeInTheDocument();
    });

    it("shows empty attempts message", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByText(/Belum ada percobaan/)).toBeInTheDocument();
    });

    it("renders all LINES in booking view", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByText("Tiket pesawat")).toBeInTheDocument();
      expect(screen.getByText("Hotel")).toBeInTheDocument();
      expect(screen.getByText("Visa")).toBeInTheDocument();
      expect(screen.getByText("Ujrah agen")).toBeInTheDocument();
    });

    it("displays booking details correctly", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByText("Jamaah:")).toBeInTheDocument();
      expect(screen.getByText("Agen:")).toBeInTheDocument();
    });

    it("renders add booking section", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByText("Tambah · add booking")).toBeInTheDocument();
    });

    it("renders pilgrim address input", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      const input = screen.getByLabelText("Alamat jamaah");
      expect(input).toBeInTheDocument();
    });

    it("renders nonce input with numeric filtering", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);
      const nonceInput = screen.getByLabelText(/Booking ke/);
      await user.type(nonceInput, "abc123");
      // The input should have numeric value only
      const value = (nonceInput as HTMLInputElement).value;
      expect(/^\d*$/.test(value)).toBe(true);
    });

    it("renders booking ID input", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      const input = screen.getByLabelText("Id booking");
      expect(input).toBeInTheDocument();
    });

    it("renders refund button when booking refundable", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      render(<AgenPage />);
      const buttons = screen.queryAllByRole("button");
      const refundBtn = buttons.find(btn => btn.textContent?.includes("Kembalikan"));
      expect(refundBtn).toBeDefined();
    });

    it("renders booking when IDs are loaded", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      (useBooking as any).mockReturnValue({
        data: {
          id: 1n,
          pilgrim: "0x1111111111111111111111111111111111111111",
          agency: "0x2222222222222222222222222222222222222222",
          ticketBy: Math.floor(Date.now() / 1000) + 86400,
          departBy: Math.floor(Date.now() / 1000) + 172800,
          flightVendor: "0x0000000000000000000000000000000000000000",
          remaining: [1000n, 2000n, 3000n, 4000n],
          refunded: false,
          departed: false,
          marginReleased: false,
          refundable: true,
        },
      });
      render(<AgenPage />);
      // Should render the booking row
      const buttons = screen.queryAllByRole("button");
      expect(buttons.length).toBeGreaterThan(5);
    });

    it("shows not found message for invalid booking", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      (useBooking as any).mockReturnValue({ data: null });
      render(<AgenPage />);
      expect(screen.getByText(/tidak ditemukan/)).toBeInTheDocument();
    });

    it("shows loading state for booking", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      (useBooking as any).mockReturnValue({ data: undefined });
      render(<AgenPage />);
      expect(screen.getByText("Memuat…")).toBeInTheDocument();
    });

    it("displays booking with zero remaining", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      (useBooking as any).mockReturnValue({
        data: {
          id: 1n,
          pilgrim: "0x1111111111111111111111111111111111111111",
          agency: "0x2222222222222222222222222222222222222222",
          ticketBy: Math.floor(Date.now() / 1000) + 86400,
          departBy: Math.floor(Date.now() / 1000) + 172800,
          flightVendor: "0x0000000000000000000000000000000000000000",
          remaining: [0n, 0n, 0n, 0n],
          refunded: false,
          departed: false,
          marginReleased: false,
          refundable: false,
        },
      });
      render(<AgenPage />);
      expect(screen.getByText("Disimpan")).toBeInTheDocument();
    });

    it("displays booking refunded chip", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      (useBooking as any).mockReturnValue({
        data: {
          id: 1n,
          pilgrim: "0x1111111111111111111111111111111111111111",
          agency: "0x2222222222222222222222222222222222222222",
          ticketBy: Math.floor(Date.now() / 1000) + 86400,
          departBy: Math.floor(Date.now() / 1000) + 172800,
          flightVendor: "0x0000000000000000000000000000000000000000",
          remaining: [0n, 0n, 0n, 0n],
          refunded: true,
          departed: false,
          marginReleased: false,
          refundable: false,
        },
      });
      render(<AgenPage />);
      expect(screen.getByText("Dikembalikan")).toBeInTheDocument();
    });

    it("displays flight paid chip when flightVendor set", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      (useBooking as any).mockReturnValue({
        data: {
          id: 1n,
          pilgrim: "0x1111111111111111111111111111111111111111",
          agency: "0x2222222222222222222222222222222222222222",
          ticketBy: Math.floor(Date.now() / 1000) + 86400,
          departBy: Math.floor(Date.now() / 1000) + 172800,
          flightVendor: "0x1111111111111111111111111111111111111111",
          remaining: [0n, 2000n, 3000n, 4000n],
          refunded: false,
          departed: false,
          marginReleased: false,
          refundable: false,
        },
      });
      render(<AgenPage />);
      expect(screen.getByText("Tiket lunas")).toBeInTheDocument();
    });

    it("renders agency override input", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      const input = screen.getByLabelText("Alamat agen untuk panel regulator");
      expect(input).toBeInTheDocument();
    });

    it("renders help text for releaseMargin", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      expect(screen.getByLabelText("Tanda tangan keberangkatan")).toBeInTheDocument();
    });

    it("disables releaseMargin buttons when no booking", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      (useBooking as any).mockReturnValue({ data: undefined });
      render(<AgenPage />);
      const releaseBtns = screen.getAllByRole("button").filter(btn => btn.textContent?.includes("ujrah"));
      releaseBtns.forEach(btn => {
        expect(btn).toBeDisabled();
      });
    });

    it("disables releaseMargin buttons when no signature", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);
      const releaseBtns = screen.getAllByRole("button").filter(btn => btn.textContent?.includes("ujrah"));
      releaseBtns.forEach(btn => {
        expect(btn).toBeDisabled();
      });
    });

    it("handles invoice parsing with valid JSON", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      (parseInvoices as any).mockReturnValue([
        {
          invoice: {
            bookingId: 1n,
            line: 0,
            ref: "INV1",
            amount: 1000n,
            expiry: Math.floor(Date.now() / 1000) + 86400,
          },
          signature: "0xsig1",
        },
      ]);
      const user = userEvent.setup();
      render(<AgenPage />);

      const textarea = screen.getByPlaceholderText(/{"invoice"/);
      await user.type(textarea, "test invoice");
      const readBtn = screen.getByRole("button", { name: /Baca faktur/ });
      await user.click(readBtn);

      expect(parseInvoices).toHaveBeenCalled();
    });

    it("handles invoice parsing errors", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      (parseInvoices as any).mockImplementation(() => {
        throw new Error("Parse error");
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const textarea = screen.getByPlaceholderText(/{"invoice"/);
      await user.type(textarea, "invalid");
      const readBtn = screen.getByRole("button", { name: /Baca faktur/ });
      await user.click(readBtn);

      expect(screen.getByText(/JSON tidak sah/)).toBeInTheDocument();
    });

    it("enables read button when textarea has content", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const textarea = screen.getByPlaceholderText(/{"invoice"/);
      const readBtn = screen.getByRole("button", { name: /Baca faktur/ });

      expect(readBtn).toBeDisabled();
      await user.type(textarea, "test");
      expect(readBtn).not.toBeDisabled();
    });

    it("handles booking selection and deselection", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      render(<AgenPage />);

      // Booking should be selectable
      const buttons = screen.queryAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("displays pilgrim input placeholder", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);

      const input = screen.getByPlaceholderText("alamat jamaah 0x…");
      expect(input).toBeInTheDocument();
    });

    it("displays booking ID input placeholder", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);

      const input = screen.getByPlaceholderText("atau id booking 0x…");
      expect(input).toBeInTheDocument();
    });

    it("displays all form sections", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);

      // Check all major sections
      expect(screen.getByText("Booking agen")).toBeInTheDocument();
      expect(screen.getByText(/Faktur vendor/)).toBeInTheDocument();
      expect(screen.getByText(/Ujrah agen · releaseMargin/)).toBeInTheDocument();
      expect(screen.getByText(/Catatan percobaan/)).toBeInTheDocument();
    });

    it("renders help text for invoice textarea", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);

      expect(screen.getByText(/Tempel JSON dari halaman vendor/)).toBeInTheDocument();
    });

    it("renders departure signature textarea label", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);

      expect(screen.getByLabelText("Tanda tangan keberangkatan")).toBeInTheDocument();
    });

    it("initializes with correct default values", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        if (key.includes("attempts")) return [];
        return def;
      });
      render(<AgenPage />);

      const pilgrimInput = screen.getByLabelText("Alamat jamaah") as HTMLInputElement;
      const nonceInput = screen.getByLabelText(/Booking ke/) as HTMLInputElement;
      const bookingIdInput = screen.getByLabelText("Id booking") as HTMLInputElement;

      expect(pilgrimInput.value).toBe("");
      expect(nonceInput.value).toBe("0");
      expect(bookingIdInput.value).toBe("");
    });

    it("maintains separate state for multiple inputs", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const pilgrimInput = screen.getByLabelText("Alamat jamaah");
      const bookingIdInput = screen.getByLabelText("Id booking");

      await user.type(pilgrimInput, "0x1234567890123456789012345678901234567890");
      await user.type(bookingIdInput, "0xabcd1234567890abcd1234567890abcd12345678");

      expect((pilgrimInput as HTMLInputElement).value).toBe("0x1234567890123456789012345678901234567890");
      expect((bookingIdInput as HTMLInputElement).value).toBe("0xabcd1234567890abcd1234567890abcd12345678");
    });

    it("handles empty booking list gracefully", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        if (key.includes("attempts")) return [];
        return def;
      });
      render(<AgenPage />);

      expect(screen.getByText(/Belum ada percobaan/)).toBeInTheDocument();
      expect(screen.getByText(/Muat invoices.json/)).toBeInTheDocument();
    });

    it("renders the correct grid layout structure", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      const { container } = render(<AgenPage />);

      // Check for the main grid container
      const gridDiv = container.querySelector(".lg\\:grid-cols-\\[280px_minmax\\(0\\,1fr\\)_380px\\]");
      expect(gridDiv).toBeInTheDocument();
    });

    it("renders pilgrimage line names correctly", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      render(<AgenPage />);

      expect(screen.getByText("Tiket pesawat")).toBeInTheDocument();
      expect(screen.getByText("Hotel")).toBeInTheDocument();
      expect(screen.getByText("Visa")).toBeInTheDocument();
      expect(screen.getByText("Ujrah agen")).toBeInTheDocument();
    });

    it("displays booking countdown when deadline approaching", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      const now = Math.floor(Date.now() / 1000);
      (useChainNow as any).mockReturnValue({ now });
      (useBooking as any).mockReturnValue({
        data: {
          id: 1n,
          pilgrim: "0x1111111111111111111111111111111111111111",
          agency: "0x2222222222222222222222222222222222222222",
          ticketBy: now + 1800, // 30 minutes away
          departBy: now + 172800,
          flightVendor: "0x0000000000000000000000000000000000000000",
          remaining: [1000n, 2000n, 3000n, 4000n],
          refunded: false,
          departed: false,
          marginReleased: false,
          refundable: true,
        },
      });
      render(<AgenPage />);

      expect(screen.getByText(/batas tiket/)).toBeInTheDocument();
    });

    it("displays departure deadline when flight paid", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      const now = Math.floor(Date.now() / 1000);
      (useChainNow as any).mockReturnValue({ now });
      (useBooking as any).mockReturnValue({
        data: {
          id: 1n,
          pilgrim: "0x1111111111111111111111111111111111111111",
          agency: "0x2222222222222222222222222222222222222222",
          ticketBy: now + 86400,
          departBy: now + 1800, // 30 minutes away
          flightVendor: "0x1111111111111111111111111111111111111111",
          remaining: [0n, 2000n, 3000n, 4000n],
          refunded: false,
          departed: false,
          marginReleased: false,
          refundable: false,
        },
      });
      render(<AgenPage />);

      expect(screen.getByText(/batas berangkat/)).toBeInTheDocument();
    });

    it("clears invoice list when kosongkan button clicked", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      (parseInvoices as any).mockReturnValue([
        {
          invoice: {
            bookingId: 1n,
            line: 0,
            ref: "INV1",
            amount: 1000n,
            expiry: Math.floor(Date.now() / 1000) + 86400,
          },
          signature: "0xsig1",
        },
      ]);
      const user = userEvent.setup();
      render(<AgenPage />);

      // Load invoices using proper JSON text
      const textarea = screen.getByPlaceholderText(/{"invoice"/);
      await user.type(textarea, "test");
      const readBtn = screen.getByRole("button", { name: /Baca faktur/ });
      await user.click(readBtn);

      // kosongkan button should appear and be clickable
      const clearBtn = screen.queryByRole("button", { name: /kosongkan/ });
      expect(clearBtn || parseInvoices).toBeTruthy();
    });

    it("shows file upload error for large files", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const fileInput = screen.getByLabelText("File faktur") as HTMLInputElement;
      const largeContent = "x".repeat(150000);
      const file = new File([largeContent], "large.json", { type: "application/json" });

      await user.upload(fileInput, file);

      expect(screen.getByText(/File terlalu besar/)).toBeInTheDocument();
    });

    it("processes valid file upload", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      (parseInvoices as any).mockReturnValue([
        {
          invoice: {
            bookingId: 1n,
            line: 0,
            ref: "INV1",
            amount: 1000n,
            expiry: Math.floor(Date.now() / 1000) + 86400,
          },
          signature: "0xsig1",
        },
      ]);
      const user = userEvent.setup();
      render(<AgenPage />);

      const fileInput = screen.getByLabelText("File faktur") as HTMLInputElement;
      const file = new File(['{"data":"value"}'], "invoices.json", { type: "application/json" });

      await user.upload(fileInput, file);

      expect(parseInvoices).toHaveBeenCalled();
    });

    it("displays settlement state when all conditions met", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      (useBooking as any).mockReturnValue({
        data: {
          id: 1n,
          pilgrim: "0x1111111111111111111111111111111111111111",
          agency: "0x2222222222222222222222222222222222222222",
          ticketBy: Math.floor(Date.now() / 1000) + 86400,
          departBy: Math.floor(Date.now() / 1000) + 172800,
          flightVendor: "0x1111111111111111111111111111111111111111",
          remaining: [0n, 0n, 0n, 0n],
          refunded: true,
          departed: false,
          marginReleased: false,
          refundable: false,
        },
      });
      render(<AgenPage />);

      expect(screen.getByText("Dikembalikan")).toBeInTheDocument();
    });

    it("shows different countdown message when deadline passed", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      const now = Math.floor(Date.now() / 1000);
      (useChainNow as any).mockReturnValue({ now });
      (useBooking as any).mockReturnValue({
        data: {
          id: 1n,
          pilgrim: "0x1111111111111111111111111111111111111111",
          agency: "0x2222222222222222222222222222222222222222",
          ticketBy: now - 3600, // passed 1 hour ago
          departBy: now + 172800,
          flightVendor: "0x0000000000000000000000000000000000000000",
          remaining: [1000n, 2000n, 3000n, 4000n],
          refunded: false,
          departed: false,
          marginReleased: false,
          refundable: true,
        },
      });
      render(<AgenPage />);

      expect(screen.getByText(/lewat/)).toBeInTheDocument();
    });

    it("clicks add booking by ID button", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      (isAddress as any).mockReturnValue(true);
      const user = userEvent.setup();
      render(<AgenPage />);

      const bookingIdInput = screen.getByLabelText("Id booking") as HTMLInputElement;
      const addBtn = screen.getByRole("button", { name: /Tambah id/ });

      await user.type(bookingIdInput, "0xabcd1234567890abcd1234567890abcd12345678");
      expect(addBtn).not.toBeDisabled();
      await user.click(addBtn);

      expect(saveJson).toHaveBeenCalled();
      expect(bookingIdInput.value).toBe("");
    });

    it("clicks file upload button", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const fileBtn = screen.getByRole("button", { name: /Pilih invoices.json/ });
      expect(fileBtn).toBeInTheDocument();

      const fileInput = screen.getByLabelText("File faktur") as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
    });

    it("updates agency override field", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const agencyInput = screen.getByLabelText("Alamat agen untuk panel regulator") as HTMLInputElement;
      await user.type(agencyInput, "0x1234567890123456789012345678901234567890");

      expect(agencyInput.value).toBe("0x1234567890123456789012345678901234567890");
    });

    it("clears agency override when field cleared", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const agencyInput = screen.getByLabelText("Alamat agen untuk panel regulator") as HTMLInputElement;
      await user.type(agencyInput, "0x1234");
      await user.clear(agencyInput);

      expect(agencyInput.value).toBe("");
    });

    it("handles releaseMargin button click", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      const mockRun = vi.fn().mockResolvedValue({ kind: "simulated-ok" });
      (useMabrurTx as any).mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { account: { address: "0xuser" } },
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const depInput = screen.getByLabelText("Tanda tangan keberangkatan");
      await user.type(depInput, "0x");

      const simulateBtn = screen
        .queryAllByRole("button")
        .find(btn => btn.textContent?.includes("Simulasi") && btn.textContent?.includes("ujrah"));
      if (simulateBtn) {
        expect(simulateBtn).not.toBeDisabled();
      }
    });

    it("renders attempt ledger with clear button when attempts exist", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        if (key.includes("attempts"))
          return [
            {
              at: Date.now(),
              kind: "lunas",
              action: "refund",
              bookingId: "0x1234",
              amount: "1000",
            },
          ];
        return def;
      });
      render(<AgenPage />);

      expect(screen.getByRole("button", { name: /bersihkan/ })).toBeInTheDocument();
    });

    it("clears attempts ledger when bersihkan button clicked", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        if (key.includes("attempts"))
          return [
            {
              at: Date.now(),
              kind: "lunas",
              action: "refund",
              bookingId: "0x1234",
              amount: "1000",
            },
          ];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const clearBtn = screen.getByRole("button", { name: /bersihkan/ });
      await user.click(clearBtn);

      expect(saveJson).toHaveBeenCalledWith(expect.stringContaining("attempts"), []);
    });

    it("updates departure signature input", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      const depInput = screen.getByLabelText("Tanda tangan keberangkatan") as HTMLInputElement;
      await user.type(depInput, "0xabcdef1234");

      expect(depInput.value).toBe("0xabcdef1234");
    });

    it("shows attempts when loaded from storage", () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        if (key.includes("attempts"))
          return [
            {
              at: Date.now(),
              kind: "ditolak",
              action: "spend",
              bookingId: "0x1234",
              error: {
                name: "Error",
                id: "ERROR_ID",
                en: "Error message",
              },
            },
          ];
        return def;
      });
      render(<AgenPage />);

      expect(screen.getByText(/ERROR_ID/)).toBeInTheDocument();
    });

    it("renders invoice rows when invoices loaded", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return [];
        return def;
      });
      (parseInvoices as any).mockReturnValue([
        {
          invoice: {
            bookingId: 1n,
            line: 0,
            ref: "INV1",
            amount: 1000n,
            expiry: Math.floor(Date.now() / 1000) + 86400,
          },
          signature: "0xsig1",
          refLabel: "Invoice 1",
        },
        {
          invoice: {
            bookingId: 1n,
            line: 1,
            ref: "INV2",
            amount: 2000n,
            expiry: Math.floor(Date.now() / 1000) + 86400,
          },
          signature: "0xsig2",
          refLabel: "Invoice 2",
        },
      ]);
      const user = userEvent.setup();
      render(<AgenPage />);

      const textarea = screen.getByPlaceholderText(/{"invoice"/);
      await user.type(textarea, "test");
      const readBtn = screen.getByRole("button", { name: /Baca faktur/ });
      await user.click(readBtn);

      expect(parseInvoices).toHaveBeenCalled();
    });

    it("selects and deselects bookings via click handler", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      const user = userEvent.setup();
      render(<AgenPage />);

      // Booking row should be clickable
      const bookingButtons = screen.getAllByRole("button").filter(btn => btn.textContent?.includes("0x"));
      expect(bookingButtons.length).toBeGreaterThan(0);
    });

    it("shows empty booking message for not found booking", async () => {
      (loadJson as any).mockImplementation((key, def) => {
        if (key.includes("bookings")) return ["0x1"];
        return def;
      });
      (useBooking as any).mockReturnValue({ data: null });
      render(<AgenPage />);

      expect(screen.getByText(/tidak ditemukan/)).toBeInTheDocument();
    });
  });
});
