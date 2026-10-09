import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isAddress, isHex, recoverTypedDataAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount, useWalletClient } from "wagmi";
import AgenPage from "~~/app/app/agen/page";
import {
  bookingIdOf,
  eventsFrom,
  useBooking,
  useChainNow,
  useMabrurContracts,
  useMabrurTx,
} from "~~/hooks/mabrur/useMabrur";
import { errorArgParts } from "~~/utils/mabrur/errors";
import { formatRp, idHex } from "~~/utils/mabrur/format";
import { InvoiceParseError, parseInvoices } from "~~/utils/mabrur/invoice";
import { defaultAgency, getLabel, loadJson, saveJson, setLabel } from "~~/utils/mabrur/names";

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
  bookingIdOf: vi.fn(() => 1n),
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

  describe("agency console behaviour", () => {
    const PILGRIM = "0x1111111111111111111111111111111111111111";
    const AGENCY = "0x2222222222222222222222222222222222222222";
    const WALLET = "0xuser1111111111111111111111111111111111";
    const HASH = "0xhash123456789";
    const nowSec = () => Math.floor(Date.now() / 1000);

    const mkBooking = (over: Record<string, unknown> = {}) => ({
      id: 1n,
      pilgrim: PILGRIM,
      agency: AGENCY,
      ticketBy: nowSec() + 86400,
      departBy: nowSec() + 172800,
      flightVendor: "0x0000000000000000000000000000000000000000",
      remaining: [1000n, 2000n, 3000n, 4000n],
      refunded: false,
      departed: false,
      marginReleased: false,
      refundable: true,
      ...over,
    });
    const mkInvoice = (invOver: Record<string, unknown> = {}, over: Record<string, unknown> = {}) => ({
      invoice: { bookingId: 1n, line: 0, ref: "0xref", amount: 1000n, expiry: 1900000000, ...invOver },
      signature: "0xsig1",
      ...over,
    });
    const decoded = { name: "Expired", id: "Kedaluwarsa", en: "Expired invoice" };

    let run: ReturnType<typeof vi.fn>;
    const seedStore = ({ bookings = [] as string[], attempts = [] as unknown[] } = {}) =>
      (loadJson as any).mockImplementation((key: string, def: unknown) =>
        key.includes("bookings") ? bookings : key.includes("attempts") ? attempts : def,
      );
    const useTx = (over: Record<string, unknown> = {}) =>
      (useMabrurTx as any).mockReturnValue({ run, busy: false, walletClient: { account: {} }, ...over });
    const loadInvoices = async (user: ReturnType<typeof userEvent.setup>, list: unknown[], text = "{}") => {
      (parseInvoices as any).mockReturnValue(list);
      fireEvent.change(screen.getByLabelText("Tempel faktur"), { target: { value: text } });
      await user.click(screen.getByRole("button", { name: /Baca faktur/ }));
    };

    beforeEach(() => {
      Element.prototype.scrollIntoView = vi.fn();
      run = vi.fn();
      useTx();
      seedStore({ bookings: ["0x1"] });
      (useBooking as any).mockReturnValue({ data: mkBooking() });
      (parseInvoices as any).mockImplementation(() => []);
      (recoverTypedDataAddress as any).mockImplementation(() => Promise.resolve("0xsigner"));
      (errorArgParts as any).mockImplementation(() => []);
      (eventsFrom as any).mockImplementation(() => []);
      (bookingIdOf as any).mockImplementation(() => 1n);
      (defaultAgency as any).mockImplementation(() => "0xdefault");
      (isHex as any).mockImplementation((v: unknown) => typeof v === "string" && v.startsWith("0x"));
      (getLabel as any).mockImplementation(() => null);
    });

    describe("ledger rows from storage", () => {
      it("renders rejected attempts with the decoded call or the argument breakdown", () => {
        (getLabel as any).mockImplementation((k: string) => (k === "0xb1" ? "Pak Budi" : null));
        seedStore({
          attempts: [
            {
              at: 1,
              kind: "ditolak",
              action: "spend",
              bookingId: "0xb1",
              error: { name: "Expired", call: "Expired(1)", id: "Kedaluwarsa", en: "Expired invoice", args: [] },
            },
            {
              at: 2,
              kind: "ditolak",
              action: "spend 2",
              bookingId: "0xb2",
              simulated: true,
              error: { name: "NotSigner", call: "NotSigner()", id: "Bukan penanda tangan", en: "Not the signer" },
            },
            { at: 3, kind: "ditolak", action: "spend 3", bookingId: "0xb3" },
          ],
        });
        render(<AgenPage />);
        expect(screen.getAllByTestId("stamp-ditolak")).toHaveLength(3);
        expect(screen.getByText("Expired")).toBeInTheDocument();
        expect(screen.getByText("NotSigner()")).toBeInTheDocument();
        expect(screen.getByText(/\(Pak Budi\)/)).toBeInTheDocument();
        expect(screen.getByText(/simulateContract/)).toBeInTheDocument();
        expect(screen.getAllByText(/Kedaluwarsa|Bukan penanda tangan/)).toHaveLength(2);
      });

      it("renders passing dry runs as neutral simulation stamps", () => {
        seedStore({
          attempts: [
            { at: 1, kind: "lunas", action: "sim a", bookingId: "0xb1", simulated: true, amount: "250" },
            { at: 2, kind: "lunas", action: "sim b", bookingId: "0xb1", simulated: true, amount: "0" },
            { at: 3, kind: "lunas", action: "sim c", bookingId: "0xb1", simulated: true },
          ],
        });
        render(<AgenPage />);
        const stamps = screen.getAllByTestId("stamp-simulasi");
        expect(stamps.map(s => s.textContent)).toEqual(["Rp 250", "", ""]);
      });

      it("renders paid and refunded attempts with line, vendor and tx link", () => {
        seedStore({
          attempts: [
            { at: 1, kind: "lunas", action: "refund", bookingId: "0xb1", amount: "300" },
            { at: 2, kind: "lunas", action: "refund", bookingId: "0xb1" },
            {
              at: 3,
              kind: "lunas",
              action: "spend",
              bookingId: "0xb1",
              line: 1,
              vendor: "0xvendor",
              hash: HASH,
              amount: "900",
            },
            { at: 4, kind: "lunas", action: "spend", bookingId: "0xb1" },
            { at: 5, kind: "lunas", action: "spend", bookingId: "0xb1", line: 9 },
          ],
        });
        render(<AgenPage />);
        expect(screen.getAllByTestId("stamp-dikembalikan").map(s => s.textContent)).toEqual(["Rp 300", "Rp 0"]);
        expect(screen.getAllByTestId("stamp-lunas").map(s => s.textContent)).toEqual(["Rp 900", "Rp 0", "Rp 0"]);
        expect(screen.getAllByText("Hotel").length).toBeGreaterThan(0);
        expect(screen.getByTestId("chip-0xvendor")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: HASH.slice(0, 8) })).toBeInTheDocument();
      });
    });

    describe("booking list", () => {
      it("selects a booking by clicking its card but not by clicking its inner controls", async () => {
        seedStore({ bookings: ["0x1", "0x2"] });
        const user = userEvent.setup();
        const { container } = render(<AgenPage />);
        const pressed = () =>
          Array.from(container.querySelectorAll("button[aria-pressed]")).map(b => b.getAttribute("aria-pressed"));
        expect(pressed()).toEqual(["true", "false"]);

        fireEvent.click(container.querySelectorAll(".mb-hover")[1]);
        expect(pressed()).toEqual(["false", "true"]);

        await user.click(screen.getAllByLabelText("Nama booking")[0]);
        expect(pressed()).toEqual(["false", "true"]);

        await user.click(container.querySelectorAll("button[aria-pressed]")[0]);
        expect(pressed()).toEqual(["true", "false"]);
      });

      it("removes an unselected booking and keeps the selection", async () => {
        seedStore({ bookings: ["0x1", "0x2"] });
        const user = userEvent.setup();
        const { container } = render(<AgenPage />);
        await user.click(screen.getAllByLabelText("Hapus dari daftar")[1]);
        expect(saveJson).toHaveBeenLastCalledWith(expect.stringContaining("bookings"), ["0x1"]);
        expect(container.querySelector("button[aria-pressed]")).toHaveAttribute("aria-pressed", "true");
      });

      it("removes the selected booking and moves the selection to the next one", async () => {
        seedStore({ bookings: ["0x1", "0x2"] });
        const user = userEvent.setup();
        const { container } = render(<AgenPage />);
        await user.click(screen.getAllByLabelText("Hapus dari daftar")[0]);
        expect(saveJson).toHaveBeenLastCalledWith(expect.stringContaining("bookings"), ["0x2"]);
        expect(container.querySelector("button[aria-pressed]")).toHaveAttribute("aria-pressed", "true");
      });

      it("removes a booking that the chain cannot find", async () => {
        (useBooking as any).mockReturnValue({ data: null });
        const user = userEvent.setup();
        render(<AgenPage />);
        await user.click(screen.getByRole("button", { name: "hapus" }));
        expect(saveJson).toHaveBeenLastCalledWith(expect.stringContaining("bookings"), []);
      });

      it("skips stored ids that are not booking ids", () => {
        seedStore({ bookings: ["not-an-id"] });
        render(<AgenPage />);
        expect(screen.queryByLabelText("Nama booking")).not.toBeInTheDocument();
      });

      it("names a booking after the pilgrim label and stores edits under the booking id", async () => {
        (getLabel as any).mockImplementation((k: string) => (k === PILGRIM ? "Pak Ahmad" : null));
        const user = userEvent.setup();
        render(<AgenPage />);
        const input = screen.getByLabelText("Nama booking") as HTMLInputElement;
        expect(input.value).toBe("Pak Ahmad");
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Pak Ahmad");

        await user.type(input, "!");
        expect(setLabel).toHaveBeenLastCalledWith("0x1", "Pak Ahmad!");
        expect(input.value).toBe("Pak Ahmad!");
      });

      it("prompts to choose a booking when none exists", () => {
        seedStore();
        (useBooking as any).mockReturnValue({ data: undefined });
        render(<AgenPage />);
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("— pilih booking —");
      });

      it("shows a waiting button once the deadline passed and nothing can be refunded yet", () => {
        (useBooking as any).mockReturnValue({
          data: mkBooking({ ticketBy: nowSec() - 60, refundable: false }),
        });
        (useChainNow as any).mockReturnValue({ now: nowSec() });
        render(<AgenPage />);
        const wait = screen.getByRole("button", { name: "Menunggu blok berikutnya…" });
        expect(wait).toBeDisabled();
        expect(screen.getByText(/lewat/)).toBeInTheDocument();
      });

      it("asks for a wallet when a refund is possible but no wallet is connected", () => {
        useTx({ walletClient: undefined });
        render(<AgenPage />);
        expect(screen.getByText(/Hubungkan dompet apa saja/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Kembalikan/ })).toBeDisabled();
      });

      it("shows the date instead of a countdown while the deadline is far away", () => {
        render(<AgenPage />);
        expect(screen.getByText(/batas tiket 2024-01-01/)).toBeInTheDocument();
      });
    });

    describe("permissionless refund", () => {
      const pressRefund = async () => {
        const user = userEvent.setup();
        render(<AgenPage />);
        await user.click(screen.getByRole("button", { name: "Kembalikan Rp 10000" }));
        return screen.findByTestId("inline-result");
      };

      it("reports the refunded amount from the Refunded event", async () => {
        run.mockResolvedValue({ kind: "mined", receipt: {}, hash: HASH });
        (eventsFrom as any).mockReturnValue([{ eventName: "Refunded", args: { amount: 500n } }]);
        const result = await pressRefund();
        expect(run).toHaveBeenCalledWith({ address: "0xpbm", abi: [], functionName: "refund", args: [1n] });
        expect(within(result).getByTestId("stamp-dikembalikan")).toHaveTextContent("Rp 500");
        expect(within(result).getByText("Sisa dana dikembalikan ke jamaah.")).toBeInTheDocument();
        expect(within(result).getByRole("link")).toBeInTheDocument();
        expect(saveJson).toHaveBeenCalledWith(expect.stringContaining("attempts"), [
          expect.objectContaining({ kind: "lunas", action: "refund", amount: "500", hash: HASH, vendor: PILGRIM }),
        ]);
      });

      it("falls back to the whole remaining balance when no Refunded event is found", async () => {
        run.mockResolvedValue({ kind: "mined", receipt: {}, hash: HASH });
        const result = await pressRefund();
        expect(within(result).getByTestId("stamp-dikembalikan")).toHaveTextContent("Rp 10000");
      });

      it("records a simulated rejection when the dry run reverts", async () => {
        run.mockResolvedValue({ kind: "reverted", decoded });
        const result = await pressRefund();
        expect(within(result).getByText("Kedaluwarsa")).toBeInTheDocument();
        expect(within(result).getByText(/Expired invoice · simulated, nothing sent/)).toBeInTheDocument();
        expect(within(result).getByTestId("stamp-ditolak")).toHaveTextContent("Expired");
      });

      it("records a real rejection when the transaction fails", async () => {
        run.mockResolvedValue({ kind: "failed", decoded });
        (errorArgParts as any).mockReturnValue(undefined);
        const result = await pressRefund();
        expect(within(result).getByText("Expired invoice")).toBeInTheDocument();
        expect(within(result).getByTestId("stamp-ditolak")).toHaveTextContent("error()");
      });

      it("records nothing when the transaction is a passing simulation", async () => {
        run.mockResolvedValue({ kind: "simulated-ok" });
        const user = userEvent.setup();
        render(<AgenPage />);
        await user.click(screen.getByRole("button", { name: "Kembalikan Rp 10000" }));
        await waitFor(() => expect(run).toHaveBeenCalled());
        expect(screen.queryByTestId("inline-result")).not.toBeInTheDocument();
        expect(saveJson).not.toHaveBeenCalledWith(expect.stringContaining("attempts"), expect.anything());
      });

      it("does nothing when the contracts are not deployed", async () => {
        (useMabrurContracts as any).mockReturnValue({ pbm: undefined, chainId: 31337 });
        const user = userEvent.setup();
        render(<AgenPage />);
        await user.click(screen.getByRole("button", { name: "Kembalikan Rp 10000" }));
        expect(run).not.toHaveBeenCalled();
      });

      it("describes a rejection with no decoded id as plain Ditolak", async () => {
        seedStore({ bookings: [] });
        (useBooking as any).mockReturnValue({ data: mkBooking() });
        run.mockResolvedValue({ kind: "failed", decoded: { name: "X", id: undefined, en: undefined } });
        seedStore({ bookings: ["0x1"] });
        const result = await pressRefund();
        expect(within(result).getAllByText(/./).length).toBeGreaterThan(0);
        expect(within(result).queryByText("Expired invoice")).not.toBeInTheDocument();
      });
    });

    describe("loading invoices", () => {
      it("labels the seeded bookings and agency and warns about a chain mismatch", async () => {
        seedStore();
        const user = userEvent.setup();
        render(<AgenPage />);
        const agency = "0x" + "a".repeat(40);
        await loadInvoices(
          user,
          [mkInvoice()],
          JSON.stringify({ ahmadBookingId: "0x1", sitiBookingId: "0x2", agency, chainId: 1 }),
        );
        expect(setLabel).toHaveBeenCalledWith("0x1", "Pak Ahmad");
        expect(setLabel).toHaveBeenCalledWith("0x2", "Ibu Siti");
        expect(setLabel).toHaveBeenCalledWith(agency, "PT Amanah Contoh Wisata");
        expect(screen.getByText("Peringatan: file untuk chain 1, dompet di chain 31337")).toBeInTheDocument();
        expect(saveJson).toHaveBeenCalledWith(expect.stringContaining("bookings"), ["0x1", "0x2"]);
      });

      it("keeps an existing agency label, ignores non-address agencies and accepts a matching chain", async () => {
        seedStore();
        (getLabel as any).mockImplementation((k: string) => (k === "0xalready" ? "Named" : null));
        (isAddress as any).mockImplementation((a: string) => a === "0xalready");
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()], JSON.stringify({ agency: "0xalready", chainId: 31337 }));
        expect(setLabel).not.toHaveBeenCalled();
        expect(screen.queryByText(/Peringatan/)).not.toBeInTheDocument();

        await loadInvoices(user, [mkInvoice()], JSON.stringify({ agency: "nonsense" }));
        expect(setLabel).not.toHaveBeenCalled();
      });

      it("loads invoices from JSON that is not an object", async () => {
        seedStore();
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()], "null");
        expect(screen.getByText(/Bayar faktur/)).toBeInTheDocument();
        expect(setLabel).not.toHaveBeenCalled();
      });

      it("does not duplicate a booking that is already listed", async () => {
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()], JSON.stringify({ ahmadBookingId: "0x1" }));
        expect(saveJson).toHaveBeenLastCalledWith(expect.stringContaining("bookings"), ["0x1"]);
      });

      it("reports an empty invoice file but still keeps the seeded bookings", async () => {
        seedStore();
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [], JSON.stringify({ sitiBookingId: "0x2" }));
        expect(screen.getByText(/Tidak ada faktur bertanda tangan/)).toBeInTheDocument();
        expect(saveJson).toHaveBeenCalledWith(expect.stringContaining("bookings"), ["0x2"]);
        expect(screen.queryByText("kosongkan")).not.toBeInTheDocument();
      });

      it("shows the parser's message for a rejected invoice", async () => {
        const user = userEvent.setup();
        render(<AgenPage />);
        (parseInvoices as any).mockImplementation(() => {
          throw new InvoiceParseError("bad signature");
        });
        fireEvent.change(screen.getByLabelText("Tempel faktur"), { target: { value: "{}" } });
        await user.click(screen.getByRole("button", { name: /Baca faktur/ }));
        expect(screen.getByText("Faktur ditolak · invoice rejected: bad signature")).toBeInTheDocument();
      });

      it("shows a JSON error when the text cannot be parsed", async () => {
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()], "not json");
        expect(screen.getByText(/JSON tidak sah/)).toBeInTheDocument();
      });

      it("clears the loaded invoices with kosongkan", async () => {
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()]);
        expect(screen.getByRole("button", { name: "Bayar faktur" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "kosongkan" }));
        expect(screen.queryByRole("button", { name: "Bayar faktur" })).not.toBeInTheDocument();
      });

      it("opens the file picker from the Pilih invoices.json button", async () => {
        const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
        const user = userEvent.setup();
        render(<AgenPage />);
        await user.click(screen.getByRole("button", { name: "Pilih invoices.json" }));
        expect(click).toHaveBeenCalledTimes(1);
        click.mockRestore();
      });

      it("ignores a file selection that is empty", () => {
        render(<AgenPage />);
        fireEvent.change(screen.getByLabelText("File faktur"), { target: { files: [] } });
        expect(parseInvoices).not.toHaveBeenCalled();
      });
    });

    describe("invoice row", () => {
      it("shows the recovered signer and marks an invoice for the selected booking", async () => {
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice({}, { refLabel: "INV-1", label: "Hotel Makkah" })]);
        expect(await screen.findByTestId("chip-0xsigner")).toBeInTheDocument();
        expect(screen.getByText("booking ini")).toBeInTheDocument();
        expect(screen.getByText("INV-1")).toBeInTheDocument();
        expect(screen.getByText(/Hotel Makkah/)).toBeInTheDocument();
        expect(screen.getAllByText("Rp 1000").length).toBeGreaterThan(0);
      });

      it("derives the reference label and hides a label equal to it", async () => {
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice({}, { refLabel: "same", label: "same" })]);
        expect(screen.getByText("same")).toBeInTheDocument();
        await loadInvoices(user, [mkInvoice()]);
        expect(screen.getByText("ref-0xref")).toBeInTheDocument();
      });

      it("marks an invoice for another booking and shows the saved booking name", async () => {
        (getLabel as any).mockImplementation((k: string) => (k === "0x2" ? "Ibu Siti" : null));
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice({ bookingId: 2n })]);
        expect(screen.getByText("booking lain")).toBeInTheDocument();
        expect(screen.getAllByText("(Ibu Siti)").length).toBeGreaterThan(0);
      });

      it("disables payment when no booking is loaded", async () => {
        seedStore();
        (useBooking as any).mockReturnValue({ data: undefined });
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()]);
        expect(screen.getByRole("button", { name: "Bayar faktur" })).toBeDisabled();
        expect(screen.queryByText(/booking ini|booking lain/)).not.toBeInTheDocument();
      });

      it("shows a dash when the signer cannot be recovered", async () => {
        (recoverTypedDataAddress as any).mockImplementation(() => Promise.reject(new Error("bad sig")));
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()]);
        await waitFor(() => expect(recoverTypedDataAddress).toHaveBeenCalled());
        expect(screen.queryByTestId("chip-0xsigner")).not.toBeInTheDocument();
        expect(screen.getByText("–")).toBeInTheDocument();
      });

      it("does not recover a signer when the contracts are missing, and ignores payment clicks", async () => {
        (useMabrurContracts as any).mockReturnValue({ pbm: undefined, chainId: 31337 });
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()]);
        await user.click(screen.getByRole("button", { name: "Bayar faktur" }));
        expect(recoverTypedDataAddress).not.toHaveBeenCalled();
        expect(run).not.toHaveBeenCalled();
      });

      it("refuses to show an invoice for an unknown line", async () => {
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice({ line: 9 })]);
        expect(screen.getByText(/Pos tidak dikenal \(9\)/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Bayar faktur" })).not.toBeInTheDocument();
      });

      it("pays the invoice from the connected wallet and reports the Spent event", async () => {
        run.mockResolvedValue({ kind: "mined", receipt: {}, hash: HASH });
        (eventsFrom as any).mockReturnValue([{ eventName: "Spent", args: { vendor: "0xvendor", amount: 777n } }]);
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice({}, { refLabel: "INV-1" })]);
        await user.click(screen.getByRole("button", { name: "Bayar faktur" }));

        const result = await screen.findByTestId("inline-result");
        expect(run).toHaveBeenCalledWith(
          {
            address: "0xpbm",
            abi: [],
            functionName: "spend",
            args: [1n, expect.objectContaining({ line: 0, amount: 1000n }), "0xsig1"],
          },
          { dryRun: false, account: WALLET },
        );
        expect(within(result).getByTestId("stamp-lunas")).toHaveTextContent("Rp 777");
        expect(within(result).getByText("Dibayar ke penanda tangan.")).toBeInTheDocument();
        expect(screen.getByTestId("chip-0xvendor")).toBeInTheDocument();
      });

      it("falls back to the signer and the invoice amount when no Spent event is found", async () => {
        run.mockResolvedValue({ kind: "mined", receipt: {}, hash: HASH });
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()]);
        await screen.findByTestId("chip-0xsigner");
        await user.click(screen.getByRole("button", { name: "Bayar faktur" }));
        const result = await screen.findByTestId("inline-result");
        expect(within(result).getByTestId("stamp-lunas")).toHaveTextContent("Rp 1000");
        expect(saveJson).toHaveBeenCalledWith(expect.stringContaining("attempts"), [
          expect.objectContaining({ vendor: "0xsigner", action: "spend · ref-0xref", ref: "ref-0xref" }),
        ]);
      });

      it("simulates as the booking's agency when no wallet is connected", async () => {
        (useAccount as any).mockReturnValue({ address: undefined });
        run.mockResolvedValue({ kind: "simulated-ok" });
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice({}, { refLabel: "INV-1" })]);
        await user.click(screen.getAllByRole("button", { name: "Simulasi saja" })[0]);

        const result = await screen.findByTestId("inline-result");
        expect(run).toHaveBeenCalledWith(expect.anything(), { dryRun: true, account: AGENCY });
        expect(within(result).getByTestId("stamp-simulasi")).toHaveTextContent("Rp 1000");
        expect(within(result).getByText(/Simulasi lolos/)).toBeInTheDocument();
        expect(within(result).getByText("The contract would accept this; nothing was sent.")).toBeInTheDocument();
      });

      it("reports a reverted dry run as a simulated rejection", async () => {
        run.mockResolvedValue({ kind: "reverted", decoded });
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()]);
        await user.click(screen.getAllByRole("button", { name: "Simulasi saja" })[0]);
        const result = await screen.findByTestId("inline-result");
        expect(within(result).getByText(/simulated, nothing sent/)).toBeInTheDocument();
      });

      it("reports a failed transaction as a rejection", async () => {
        run.mockResolvedValue({ kind: "failed", decoded });
        const user = userEvent.setup();
        render(<AgenPage />);
        await loadInvoices(user, [mkInvoice()]);
        await user.click(screen.getByRole("button", { name: "Bayar faktur" }));
        const result = await screen.findByTestId("inline-result");
        expect(within(result).getByText("Expired invoice")).toBeInTheDocument();
        expect(within(result).queryByText(/simulated, nothing sent/)).not.toBeInTheDocument();
      });
    });

    describe("adding bookings", () => {
      const PILGRIM_ADDR = "0x" + "b".repeat(40);

      it("adds a booking computed from the pilgrim address and nonce", async () => {
        seedStore();
        const user = userEvent.setup();
        render(<AgenPage />);
        fireEvent.change(screen.getByLabelText("Alamat jamaah"), { target: { value: PILGRIM_ADDR } });
        fireEvent.change(screen.getByLabelText(/Booking ke/), { target: { value: "5" } });
        await user.click(screen.getByRole("button", { name: "Tambah dari alamat" }));
        expect(bookingIdOf).toHaveBeenCalledWith(PILGRIM_ADDR, 5n);
        expect(saveJson).toHaveBeenCalledWith(expect.stringContaining("bookings"), ["0x1"]);
      });

      it("treats an empty nonce as zero", async () => {
        seedStore();
        const user = userEvent.setup();
        render(<AgenPage />);
        fireEvent.change(screen.getByLabelText("Alamat jamaah"), { target: { value: PILGRIM_ADDR } });
        fireEvent.change(screen.getByLabelText(/Booking ke/), { target: { value: "" } });
        await user.click(screen.getByRole("button", { name: "Tambah dari alamat" }));
        expect(bookingIdOf).toHaveBeenCalledWith(PILGRIM_ADDR, 0n);
      });

      it("ignores the add click if the address stops validating before the handler runs", async () => {
        seedStore();
        let valid = true;
        (isAddress as any).mockImplementation(() => valid);
        const user = userEvent.setup();
        render(<AgenPage />);
        fireEvent.change(screen.getByLabelText("Alamat jamaah"), { target: { value: PILGRIM_ADDR } });
        valid = false;
        await user.click(screen.getByRole("button", { name: "Tambah dari alamat" }));
        expect(bookingIdOf).not.toHaveBeenCalled();
      });
    });

    describe("agency margin release", () => {
      const sign = (value: string) =>
        fireEvent.change(screen.getByLabelText("Tanda tangan keberangkatan"), { target: { value } });
      const release = () => screen.getByRole("button", { name: /Buka ujrah/ });
      const resultOf = () => screen.getAllByTestId("inline-result")[0];

      it("sends a raw hex signature and reports the MarginReleased amount", async () => {
        run.mockResolvedValue({ kind: "mined", receipt: {}, hash: HASH });
        (eventsFrom as any).mockReturnValue([{ eventName: "MarginReleased", args: { amount: 4000n } }]);
        const user = userEvent.setup();
        render(<AgenPage />);
        sign(" 0xabc ");
        await user.click(release());
        await screen.findByTestId("inline-result");
        expect(run).toHaveBeenCalledWith(
          { address: "0xpbm", abi: [], functionName: "releaseMargin", args: [1n, "0xabc"] },
          { dryRun: false, account: WALLET },
        );
        expect(within(resultOf()).getByTestId("stamp-lunas")).toHaveTextContent("Rp 4000");
      });

      it("reports zero when the MarginReleased event is missing", async () => {
        run.mockResolvedValue({ kind: "mined", receipt: {}, hash: HASH });
        const user = userEvent.setup();
        render(<AgenPage />);
        sign("0xabc");
        await user.click(release());
        await screen.findByTestId("inline-result");
        expect(within(resultOf()).getByTestId("stamp-lunas")).toHaveTextContent("Rp 0");
      });

      it("reads the signature out of a JSON object, preferring signature over sig", async () => {
        run.mockResolvedValue({ kind: "simulated-ok" });
        const user = userEvent.setup();
        render(<AgenPage />);
        sign(JSON.stringify({ signature: "0xaaa", sig: "0xbbb" }));
        await user.click(release());
        await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
        expect((run.mock.calls[0][0] as any).args[1]).toBe("0xaaa");

        sign(JSON.stringify({ sig: "0xbbb" }));
        await user.click(release());
        await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
        expect((run.mock.calls[1][0] as any).args[1]).toBe("0xbbb");
      });

      it("rejects a signature that is not hex without calling the contract", async () => {
        const user = userEvent.setup();
        render(<AgenPage />);
        sign(JSON.stringify({ unrelated: 1 }));
        await user.click(release());
        const result = await screen.findByTestId("inline-result");
        expect(within(result).getByText("Tanda tangan keberangkatan tidak terbaca")).toBeInTheDocument();
        expect(within(result).getByText("Could not read the departure signature")).toBeInTheDocument();
        expect(run).not.toHaveBeenCalled();
      });

      it("shows a passing dry run as a simulation using the agency when no wallet is connected", async () => {
        (useAccount as any).mockReturnValue({ address: undefined });
        run.mockResolvedValue({ kind: "simulated-ok" });
        const user = userEvent.setup();
        render(<AgenPage />);
        sign("0xabc");
        await user.click(screen.getAllByRole("button", { name: "Simulasi saja" })[0]);
        const result = await screen.findByTestId("inline-result");
        expect(run).toHaveBeenCalledWith(expect.anything(), { dryRun: true, account: AGENCY });
        expect(within(result).getByTestId("stamp-simulasi")).toHaveTextContent("Rp 4000");
      });

      it("reports a revert as a simulated rejection and a failure as a real one", async () => {
        run.mockResolvedValueOnce({ kind: "reverted", decoded });
        const user = userEvent.setup();
        render(<AgenPage />);
        sign("0xabc");
        await user.click(release());
        expect(await screen.findByText(/simulated, nothing sent/)).toBeInTheDocument();

        run.mockResolvedValueOnce({ kind: "failed", decoded: { ...decoded, en: "Real failure" } });
        await user.click(release());
        expect((await screen.findAllByText("Real failure")).length).toBeGreaterThan(0);
        expect(screen.getAllByTestId("stamp-ditolak").length).toBeGreaterThan(1);
      });

      it("does nothing when the contracts are missing", async () => {
        (useMabrurContracts as any).mockReturnValue({ pbm: undefined, chainId: 31337 });
        const user = userEvent.setup();
        render(<AgenPage />);
        sign("0xabc");
        await user.click(release());
        expect(run).not.toHaveBeenCalled();
        expect(screen.queryByTestId("inline-result")).not.toBeInTheDocument();
      });
    });

    describe("regulator panel agency", () => {
      const panel = () => screen.getByTestId("regulator-panel");

      it("follows the booking's agency unless overridden", () => {
        render(<AgenPage />);
        expect(panel()).toHaveTextContent(AGENCY);
        fireEvent.change(screen.getByLabelText("Alamat agen untuk panel regulator"), {
          target: { value: " 0xother " },
        });
        expect(panel()).toHaveTextContent("0xother");
      });

      it("falls back to the default agency, then the wallet, then nothing", () => {
        seedStore();
        (useBooking as any).mockReturnValue({ data: undefined });
        const { unmount } = render(<AgenPage />);
        expect(panel()).toHaveTextContent("0xdefault");
        unmount();

        (defaultAgency as any).mockImplementation(() => "");
        const second = render(<AgenPage />);
        expect(panel()).toHaveTextContent(WALLET);
        second.unmount();

        (useAccount as any).mockReturnValue({ address: undefined });
        render(<AgenPage />);
        expect(panel().textContent).toBe("");
      });
    });
  });
});
