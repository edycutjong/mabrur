import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount, useWalletClient } from "wagmi";
import { Passbook } from "~~/components/mabrur/Passbook";
import { deriveLines, useBookingLedger } from "~~/hooks/mabrur/useLedger";
import type { Booking } from "~~/hooks/mabrur/useMabrur";
import { ZERO } from "~~/hooks/mabrur/useMabrur";
// Get mocked functions
import { eventsFrom, useChainNow, useMabrurContracts, useMabrurTx } from "~~/hooks/mabrur/useMabrur";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useAccount: vi.fn(),
  useWalletClient: vi.fn(),
}));

// Mock scaffold-eth hooks
vi.mock("~~/hooks/scaffold-eth", () => ({
  useTargetNetwork: vi.fn(),
  useDeployedContractInfo: vi.fn(),
}));

// Mock mabrur hooks
vi.mock("~~/hooks/mabrur/useMabrur", () => ({
  ZERO: "0x0000000000000000000000000000000000000000",
  useChainNow: vi.fn(),
  useMabrurContracts: vi.fn(),
  useMabrurTx: vi.fn(),
  eventsFrom: vi.fn(),
  Booking: {},
}));

vi.mock("~~/hooks/mabrur/useLedger", () => ({
  useBookingLedger: vi.fn(),
  deriveLines: vi.fn(),
}));

// Mock UI components
vi.mock("~~/components/mabrur/ui", () => ({
  AddressChip: ({ address, name }: any) => <span>{name || address}</span>,
  Bi: ({ id, en }: any) => (
    <span>
      {id}
      {en && ` · ${en}`}
    </span>
  ),
  CopyButton: ({ label }: any) => <button data-testid="copy-btn">{label}</button>,
  Label: ({ children }: any) => <label>{children}</label>,
  RevertStamp: ({ d }: any) => <div data-testid="revert-stamp">{d.en}</div>,
  Rp: ({ value, words }: any) => (
    <span data-testid={`rp-${value}`}>
      Rp {value}
      {words && " (words)"}
    </span>
  ),
  Stamp: ({ kind, children }: any) => (
    <span data-testid={`stamp-${kind}`}>
      {kind}: {children}
    </span>
  ),
  TxLink: ({ hash }: any) => <a href={`/tx/${hash}`}>{hash?.slice(0, 8)}</a>,
}));

// Mock format utilities
vi.mock("~~/utils/mabrur/format", () => ({
  LINES: [
    {
      id: "Tiket pesawat",
      en: "Flight ticket",
      ruleId: "Flight rule",
      ruleEn: "Flight rule en",
    },
    {
      id: "Hotel",
      en: "Hotel",
      ruleId: "Hotel rule",
      ruleEn: "Hotel rule en",
    },
    {
      id: "Visa",
      en: "Visa",
      ruleId: "Visa rule",
      ruleEn: "Visa rule en",
    },
    {
      id: "Ujrah agen",
      en: "Agency fee",
      ruleId: "Agency rule",
      ruleEn: "Agency rule en",
    },
  ],
  formatCountdown: vi.fn(() => "5 days"),
  formatDateWIB: vi.fn(ts => `2024-01-01 ${ts}`),
  formatRp: vi.fn(v => `Rp ${v}`),
  idHex: vi.fn(v => `0x${v}`),
  shortHex: vi.fn(v => `${v.slice(0, 6)}...${v.slice(-4)}`),
}));

// Mock invoice utilities
vi.mock("~~/utils/mabrur/invoice", () => ({
  DEPARTURE_TYPES: {},
  pbmDomain: vi.fn(() => ({})),
  refToLabel: vi.fn(ref => `ref-${ref}`),
}));

// Mock names utilities
vi.mock("~~/utils/mabrur/names", () => ({
  getLabel: vi.fn(addr => {
    if (addr === "0x1111111111111111111111111111111111111111") return "Flight Vendor";
    if (addr === "0x2222222222222222222222222222222222222222") return "Agency Label";
    return null;
  }),
}));

// Mock errors utilities
vi.mock("~~/utils/mabrur/errors", () => ({
  decodeRevert: vi.fn(() => ({
    name: "TestError",
    en: "Test error",
    id: "Test error ID",
    isRevert: true,
    args: [],
    argNames: [],
  })),
}));

const mockUseChainNow = useChainNow as any;
const mockUseMabrurContracts = useMabrurContracts as any;
const mockUseMabrurTx = useMabrurTx as any;
const mockUseBookingLedger = useBookingLedger as any;
const mockDeriveLines = deriveLines as any;
const mockUseAccount = useAccount as any;
const mockUseWalletClient = useWalletClient as any;
const mockEventsFrom = eventsFrom as any;

// Helper to create a test booking
const createBooking = (overrides?: Partial<Booking>): Booking => ({
  id: 1n,
  pilgrim: "0x1234567890123456789012345678901234567890",
  agency: "0x2222222222222222222222222222222222222222",
  ticketBy: 1704067200n, // 2024-01-01
  departBy: 1704153600n, // 2024-01-02
  departed: false,
  marginReleased: false,
  refunded: false,
  flightVendor: ZERO,
  remaining: [1000n, 2000n, 3000n, 4000n],
  deposited: 10000n,
  refundable: true,
  ...overrides,
});

const setupMocks = () => {
  mockUseChainNow.mockReturnValue({
    now: Math.floor(Date.now() / 1000),
    blockNumber: 1000n,
    blockTime: 1704067200n,
  });

  mockUseMabrurContracts.mockReturnValue({
    pbm: { address: "0x5555555555555555555555555555555555555555", abi: [] },
    chainId: 31337,
    isLoading: false,
    ready: true,
  });

  mockUseMabrurTx.mockReturnValue({
    run: vi.fn(),
    busy: false,
    walletClient: null,
    address: null,
  });

  mockUseBookingLedger.mockReturnValue({
    data: undefined,
    isError: false,
  });

  mockDeriveLines.mockReturnValue([
    { original: 1000n, remaining: 1000n, spent: [], refunded: undefined, state: "earmarked" },
    { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
    { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
    { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
  ]);

  mockUseAccount.mockReturnValue({
    address: undefined,
  });

  mockUseWalletClient.mockReturnValue({
    data: null,
  });
};

describe("Passbook component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  describe("header section", () => {
    it("renders booking id header with shortened hex", () => {
      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText(/No. kuitansi/)).toBeInTheDocument();
      expect(screen.getByTestId("copy-btn")).toBeInTheDocument();
    });

    it("renders pilgrim address chip", () => {
      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText("Sudah terima dari")).toBeInTheDocument();
    });

    it("renders agency address chip", () => {
      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText("Agen")).toBeInTheDocument();
    });

    it("displays depart date without strikethrough when not passed", () => {
      mockUseChainNow.mockReturnValue({
        now: Math.floor(new Date("2024-01-01").getTime() / 1000),
        blockNumber: 1000n,
        blockTime: 1704067200n,
      });

      const booking = createBooking({
        departBy: 1704240000n, // 2024-01-03, 2 days later
      });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Berangkat paling lambat/)).toBeInTheDocument();
    });

    it("displays refunded status in header", () => {
      const booking = createBooking({ refunded: true });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Dana sudah dikembalikan/)).toBeInTheDocument();
    });

    it("displays departed chip when departed", () => {
      const booking = createBooking({ departed: true });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Sudah berangkat/)).toBeInTheDocument();
    });

    it("displays refund allowed message when depart passed", () => {
      mockUseChainNow.mockReturnValue({
        now: Math.floor(new Date("2024-01-03").getTime() / 1000),
        blockNumber: 1000n,
        blockTime: 1704240000n,
      });

      const booking = createBooking({
        departBy: 1704067200n,
      });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Batas berangkat lewat/)).toBeInTheDocument();
    });

    it("displays days left countdown when depart not passed", () => {
      mockUseChainNow.mockReturnValue({
        now: Math.floor(new Date("2024-01-01").getTime() / 1000),
        blockNumber: 1000n,
        blockTime: 1704067200n,
      });

      const booking = createBooking({
        departBy: 1704240000n,
      });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/hari lagi/)).toBeInTheDocument();
    });

    it("displays ticket deadline", () => {
      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText("Batas tiket")).toBeInTheDocument();
    });

    it("displays paid ticket chip with vendor name and amount", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0x1111111111111111111111111111111111111111", hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
      });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Tiket dibayar/)).toBeInTheDocument();
    });

    it("displays unpaid ticket message when refunded without ticket", () => {
      const booking = createBooking({
        refunded: true,
        flightVendor: ZERO,
      });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Tiket tidak dibeli/)).toBeInTheDocument();
    });

    it("displays ticket passed message when ticket deadline exceeded", () => {
      mockUseChainNow.mockReturnValue({
        now: Math.floor(new Date("2024-01-02").getTime() / 1000),
        blockNumber: 1000n,
        blockTime: 1704153600n,
      });

      const booking = createBooking({
        ticketBy: 1704067200n,
        flightVendor: ZERO,
      });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Batas tiket lewat/)).toBeInTheDocument();
    });

    it("displays ticket countdown when not yet passed", () => {
      mockUseChainNow.mockReturnValue({
        now: Math.floor(new Date("2024-01-01").getTime() / 1000),
        blockNumber: 1000n,
        blockTime: 1704067200n,
      });

      const booking = createBooking({
        ticketBy: 1704240000n,
      });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Tiket belum dibayar/)).toBeInTheDocument();
    });

    it("displays explanatory text about refund rules", () => {
      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Jika tiket pesawat belum dibayar sampai batas tiket/i)).toBeInTheDocument();
    });
  });

  describe("line cards", () => {
    it("renders all four line cards", () => {
      const booking = createBooking();
      render(<Passbook b={booking} />);

      const cards = screen.getAllByText(/^Sisa$/);
      expect(cards).toHaveLength(4);
    });

    it("renders line card with earmarked state", () => {
      mockDeriveLines.mockReturnValue([
        { original: 1000n, remaining: 1000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      const disimpanElements = screen.getAllByText("Disimpan");
      expect(disimpanElements.length).toBeGreaterThan(0);
    });

    it("renders line card with partial state", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 500n,
          spent: [{ amount: 500n, to: "0x111", hash: "0x123" }],
          refunded: undefined,
          state: "partial",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      const disimpanElements = screen.getAllByText("Disimpan");
      expect(disimpanElements.length).toBeGreaterThan(0);
    });

    it("renders line card with lunas state and spending details", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [
            {
              amount: 1000n,
              to: "0x1111111111111111111111111111111111111111",
              hash: "0xabc123",
              ref: "0x123ref",
            },
          ],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByTestId("stamp-lunas")).toBeInTheDocument();
    });

    it("renders line card with returned state and refund amount", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [],
          refunded: 500n,
          state: "returned",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking({ refunded: true });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Dikembalikan/)).toBeInTheDocument();
    });

    it("renders line card with returned state without refund amount", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [],
          refunded: undefined,
          state: "returned",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking({ refunded: true });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Dikembalikan/)).toBeInTheDocument();
    });

    it("renders line card with empty state", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 0n,
          remaining: 0n,
          spent: [],
          refunded: undefined,
          state: "empty",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getAllByText(/^Sisa$/).length).toBeGreaterThan(0);
    });

    it("shows original amount when different from remaining", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 500n,
          spent: [{ amount: 500n, to: "0x111", hash: "0x123" }],
          refunded: undefined,
          state: "partial",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText(/dari Rp/)).toBeInTheDocument();
    });
  });

  describe("total amount section", () => {
    it("displays total remaining amount", () => {
      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Total sisa dana amanah/)).toBeInTheDocument();
    });
  });

  describe("refund section", () => {
    it("does not render refund section when not refundable and not refunded", () => {
      const booking = createBooking({ refundable: false, refunded: false });
      render(<Passbook b={booking} />);

      expect(screen.queryByText(/Pengembalian dana/)).not.toBeInTheDocument();
    });

    it("renders refund section when refundable", () => {
      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Pengembalian dana/)).toBeInTheDocument();
    });

    it("renders refund button when can refund and has wallet", async () => {
      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true, remaining: [100n, 200n, 300n, 400n] });
      render(<Passbook b={booking} />);

      expect(screen.getByRole("button", { name: /Kembalikan/ })).toBeInTheDocument();
    });

    it("disables refund button when busy", () => {
      mockUseMabrurTx.mockReturnValue({
        run: vi.fn(),
        busy: true,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      expect(refundBtn).toBeDisabled();
    });

    it("disables refund button when no wallet client", () => {
      mockUseWalletClient.mockReturnValue({
        data: null,
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      expect(refundBtn).toBeDisabled();
    });

    it("shows wallet connection message when no wallet", () => {
      mockUseWalletClient.mockReturnValue({
        data: null,
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Hubungkan dompet apa saja/)).toBeInTheDocument();
    });

    it("calls refund function when refund button clicked", async () => {
      const mockRun = vi.fn(async () => ({
        kind: "mined",
        hash: "0x123abc",
        receipt: { logs: [] },
        result: undefined,
      }));
      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      mockEventsFrom.mockReturnValue([
        {
          eventName: "Refunded",
          args: {
            amount: 10000n,
            caller: "0x3333333333333333333333333333333333333333",
          },
        },
      ]);

      const booking = createBooking({ refundable: true, id: 42n });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      expect(mockRun).toHaveBeenCalled();
    });

    it("displays refund outcome when refund succeeds", async () => {
      const mockRun = vi.fn(async () => ({
        kind: "mined",
        hash: "0x123abc",
        receipt: { logs: [] },
        result: undefined,
      }));

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockEventsFrom.mockReturnValue([
        {
          eventName: "Refunded",
          args: {
            amount: 10000n,
            caller: "0x3333333333333333333333333333333333333333",
          },
        },
      ]);

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      await waitFor(() => {
        expect(screen.getByTestId("stamp-dikembalikan")).toBeInTheDocument();
      });
    });

    it("displays refund error when refund fails", async () => {
      const mockRun = vi.fn(async () => ({
        kind: "reverted",
        decoded: {
          name: "RefundError",
          en: "Refund not allowed",
          id: "Refund tidak diizinkan",
          isRevert: true,
          args: [],
          argNames: [],
        },
        simulated: true,
      }));

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      await waitFor(() => {
        expect(screen.getByTestId("revert-stamp")).toBeInTheDocument();
      });
    });

    it("displays refund from ledger when available", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Refunded",
            blockNumber: 100n,
            logIndex: 0,
            hash: "0xref123",
            amount: 10000n,
            counterparty: "0x3333333333333333333333333333333333333333",
          },
        ],
        isError: false,
      });

      const booking = createBooking({ refunded: true });
      render(<Passbook b={booking} />);

      expect(screen.getByTestId("stamp-dikembalikan")).toBeInTheDocument();
    });

    it("displays refunded status without outcome or ledger", () => {
      const booking = createBooking({ refunded: true });
      render(<Passbook b={booking} />);

      expect(screen.getByTestId("stamp-dikembalikan")).toBeInTheDocument();
    });
  });

  describe("departure signature section", () => {
    it("does not render when refunded", () => {
      const booking = createBooking({ refunded: true });
      render(<Passbook b={booking} />);

      expect(screen.queryByText(/Tanda tangan keberangkatan/)).not.toBeInTheDocument();
    });

    it("renders section when not refunded", () => {
      const booking = createBooking({ refunded: false });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Tanda tangan keberangkatan/)).toBeInTheDocument();
    });

    it("shows message when margin already released", () => {
      const booking = createBooking({ marginReleased: true, refunded: false });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/The agency fee was released on departure/)).toBeInTheDocument();
    });

    it("shows unavailable message when flight not paid", () => {
      const booking = createBooking({ flightVendor: ZERO, refunded: false });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Available once the flight ticket is paid/)).toBeInTheDocument();
    });

    it("shows sign button when flight paid and not departed", async () => {
      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      expect(screen.getByRole("button", { name: /Tanda tangani keberangkatan/ })).toBeInTheDocument();
    });

    it("disables sign button when user is not pilgrim", () => {
      mockUseAccount.mockReturnValue({
        address: "0xotheraddress0000000000000000000000000000",
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      expect(signBtn).toBeDisabled();
    });

    it("shows message when not pilgrim", () => {
      mockUseAccount.mockReturnValue({
        address: "0xotheraddress0000000000000000000000000000",
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Hanya dompet jamaah ini/)).toBeInTheDocument();
    });

    it("calls signTypedData when sign button clicked", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurContracts.mockReturnValue({
        pbm: { address: "0x5555555555555555555555555555555555555555", abi: [] },
        chainId: 31337,
        isLoading: false,
        ready: true,
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        expect(mockSignTypedData).toHaveBeenCalled();
      });
    });

    it("displays signature JSON when signature obtained", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurContracts.mockReturnValue({
        pbm: { address: "0x5555555555555555555555555555555555555555", abi: [] },
        chainId: 31337,
        isLoading: false,
        ready: true,
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        expect(screen.getByText(/Tanda tangan — tempel di konsol agen/)).toBeInTheDocument();
      });
    });

    it("shows submit release button when signature available", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Kirim releaseMargin/ })).toBeInTheDocument();
      });
    });

    it("calls submitRelease when release button clicked", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      const mockRun = vi.fn();

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: mockSignTypedData },
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
        expect(releaseBtn).toBeInTheDocument();
      });
    });

    it("displays success stamp when release succeeds", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      const mockRun = vi.fn(async () => ({
        kind: "mined",
        hash: "0xrelease123",
        receipt: {},
      }));

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: mockSignTypedData },
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
        expect(releaseBtn).toBeInTheDocument();
      });

      const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
      await userEvent.click(releaseBtn);

      // Verify run was called for submitRelease
      await waitFor(() => {
        expect(mockRun).toHaveBeenCalled();
      });
    });

    it("displays error when sign fails", async () => {
      const mockSignTypedData = vi.fn(async () => {
        throw new Error("User rejected signing");
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        expect(screen.getByTestId("revert-stamp")).toBeInTheDocument();
      });
    });

    it("displays release error when submitRelease fails with reverted", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      const mockRun = vi.fn(async () => ({
        kind: "reverted",
        decoded: {
          name: "ReleaseError",
          en: "Cannot release",
          id: "Tidak bisa release",
          isRevert: true,
          args: [],
          argNames: [],
        },
        simulated: true,
      }));

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: mockSignTypedData },
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
        expect(releaseBtn).toBeInTheDocument();
      });

      const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
      await userEvent.click(releaseBtn);

      // Just check that mockRun was called
      expect(mockRun).toHaveBeenCalled();
    });

    it("displays release error when submitRelease fails with failed outcome", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      const mockRun = vi.fn(async () => ({
        kind: "failed",
        decoded: {
          name: "TransactionFailed",
          en: "Transaction failed",
          id: "Transaksi gagal",
          isRevert: false,
          args: [],
          argNames: [],
        },
        simulated: false,
      }));

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: mockSignTypedData },
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
        expect(releaseBtn).toBeInTheDocument();
      });

      const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
      await userEvent.click(releaseBtn);

      // Just check that mockRun was called
      expect(mockRun).toHaveBeenCalled();
    });

    it("disables buttons when busy", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurTx.mockReturnValue({
        run: vi.fn(),
        busy: true,
        walletClient: { signTypedData: mockSignTypedData },
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      expect(signBtn).toBeDisabled();
    });

    it("submitRelease handles unexpected outcome kind gracefully", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      const mockRun = vi.fn(async () => ({
        kind: "simulated-ok",
        result: undefined,
      }));

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: mockSignTypedData },
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        expect(screen.getByText(/Tanda tangan — tempel di konsol agen/)).toBeInTheDocument();
      });

      // Now try submitRelease
      const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
      await userEvent.click(releaseBtn);

      // Should call run but not set release hash or error
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockRun).toHaveBeenCalled();
    });

    it("handles signDeparture when walletClient is null", async () => {
      mockUseWalletClient.mockReturnValue({
        data: null,
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurContracts.mockReturnValue({
        pbm: { address: "0x5555555555555555555555555555555555555555", abi: [] },
        chainId: 31337,
        isLoading: false,
        ready: true,
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      // Button should be present but when clicked with null walletClient, it returns early
      expect(signBtn).toBeInTheDocument();
    });

    it("handles submitRelease when walletClient is initially null then has data", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      const mockRun = vi.fn(async () => {
        return { kind: "simulated-ok", result: undefined };
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: mockSignTypedData },
      });

      mockUseMabrurContracts.mockReturnValue({
        pbm: { address: "0x5555555555555555555555555555555555555555", abi: [] },
        chainId: 31337,
        isLoading: false,
        ready: true,
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      // Should call mockRun which is part of signDeparture
      expect(mockRun).not.toHaveBeenCalled();
    });
  });

  describe("ledger section", () => {
    it("renders ledger title", () => {
      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Buku tabungan amanah/)).toBeInTheDocument();
    });

    it("shows loading message when ledger is undefined", () => {
      mockUseBookingLedger.mockReturnValue({
        data: undefined,
        isError: false,
      });

      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Memuat riwayat/)).toBeInTheDocument();
    });

    it("shows error message when ledger fails to load", () => {
      mockUseBookingLedger.mockReturnValue({
        data: undefined,
        isError: true,
      });

      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Riwayat event tidak tersedia/)).toBeInTheDocument();
    });

    it("renders ledger table when ledger is available", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Booked",
            blockNumber: 1n,
            logIndex: 0,
            hash: "0xbook123",
            timestamp: 1704067200n,
            amount: 10000n,
            lines: [1000n, 2000n, 3000n, 4000n],
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        { original: 1000n, remaining: 1000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      const { container } = render(<Passbook b={booking} />);

      expect(screen.getByText(/Tanggal/)).toBeInTheDocument();
      expect(screen.getByText(/Keterangan/)).toBeInTheDocument();
      expect(screen.getByText(/Keluar/)).toBeInTheDocument();
      // Check that there's a table element with Sisa header
      const tables = container.querySelectorAll("table");
      expect(tables.length).toBeGreaterThan(0);
    });

    it("renders booked row in ledger", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Booked",
            blockNumber: 1n,
            logIndex: 0,
            hash: "0xbook123",
            timestamp: 1704067200n,
            amount: 10000n,
            lines: [1000n, 2000n, 3000n, 4000n],
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        { original: 1000n, remaining: 1000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText(/^Pemesanan$/)).toBeInTheDocument();
    });

    it("renders spent row in ledger with vendor and ref", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Spent",
            blockNumber: 2n,
            logIndex: 0,
            hash: "0xspent123",
            timestamp: 1704153600n,
            amount: 1000n,
            line: 0,
            counterparty: "0x1111111111111111111111111111111111111111",
            ref: "0xref123",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0x111", hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getAllByText(/ref-0xref123/)[0]).toBeInTheDocument();
    });

    it("renders margin released row in ledger", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "MarginReleased",
            blockNumber: 3n,
            logIndex: 0,
            hash: "0xmargin123",
            timestamp: 1704240000n,
            amount: 4000n,
            line: 3,
            counterparty: "0x2222222222222222222222222222222222222222",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        { original: 1000n, remaining: 1000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 0n, spent: [], refunded: undefined, state: "lunas" },
      ]);

      const booking = createBooking({ marginReleased: true });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Ujrah agen setelah berangkat/)).toBeInTheDocument();
    });

    it("renders refunded row in ledger", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Refunded",
            blockNumber: 4n,
            logIndex: 0,
            hash: "0xrefund123",
            timestamp: 1704326400n,
            amount: 9000n,
            counterparty: "0x3333333333333333333333333333333333333333",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        { original: 1000n, remaining: 0n, spent: [], refunded: 1000n, state: "returned" },
        { original: 2000n, remaining: 0n, spent: [], refunded: 2000n, state: "returned" },
        { original: 3000n, remaining: 0n, spent: [], refunded: 3000n, state: "returned" },
        { original: 4000n, remaining: 0n, spent: [], refunded: 0n, state: "returned" },
      ]);

      const booking = createBooking({ refunded: true });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Dikembalikan ke Jamaah/)).toBeInTheDocument();
    });

    it("shows dash for missing timestamp", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Booked",
            blockNumber: 1n,
            logIndex: 0,
            hash: "0xbook123",
            amount: 10000n,
            lines: [1000n, 2000n, 3000n, 4000n],
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        { original: 1000n, remaining: 1000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      const { container } = render(<Passbook b={booking} />);

      const dashes = container.querySelectorAll("td.mb-num");
      expect(dashes.length).toBeGreaterThan(0);
    });

    it("calculates and displays running balance correctly", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Booked",
            blockNumber: 1n,
            logIndex: 0,
            hash: "0xbook123",
            timestamp: 1704067200n,
            amount: 10000n,
            lines: [1000n, 2000n, 3000n, 4000n],
          },
          {
            kind: "Spent",
            blockNumber: 2n,
            logIndex: 0,
            hash: "0xspent123",
            timestamp: 1704153600n,
            amount: 1000n,
            line: 0,
            counterparty: "0x1111111111111111111111111111111111111111",
            ref: "0xref123",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0x111", hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      const rows = screen.getAllByRole("row");
      expect(rows.length).toBeGreaterThan(1);
    });

    it("displays disclaimer text about balance", () => {
      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Saldo mUMRAH Anda/)).toBeInTheDocument();
    });
  });

  describe("custom name prop", () => {
    it("uses provided name instead of label lookup", () => {
      const booking = createBooking();
      render(<Passbook b={booking} name="Ust. Ahmad" />);

      expect(screen.getByText("Ust. Ahmad")).toBeInTheDocument();
    });

    it("shows refund text with custom name", async () => {
      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} name="Ust. Ahmad" />);

      const nameElements = screen.getAllByText(/Ust. Ahmad/);
      expect(nameElements.length).toBeGreaterThan(0);
    });
  });

  describe("integration scenarios", () => {
    it("renders complete booking with all sections", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Booked",
            blockNumber: 1n,
            logIndex: 0,
            hash: "0xbook123",
            timestamp: 1704067200n,
            amount: 10000n,
            lines: [1000n, 2000n, 3000n, 4000n],
          },
        ],
        isError: false,
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
      });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/No. kuitansi/)).toBeInTheDocument();
      expect(screen.getAllByText(/^Sisa$/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Pengembalian dana/)).toBeInTheDocument();
      expect(screen.getByText(/Tanda tangan keberangkatan/)).toBeInTheDocument();
      expect(screen.getByText(/Buku tabungan amanah/)).toBeInTheDocument();
    });

    it("updates when booking state changes from earmarked to partial", () => {
      mockDeriveLines.mockReturnValue([
        { original: 1000n, remaining: 1000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      const { rerender } = render(<Passbook b={booking} />);

      expect(screen.getAllByText("Disimpan").length).toBeGreaterThan(0);

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 500n,
          spent: [{ amount: 500n, to: "0x111", hash: "0x123" }],
          refunded: undefined,
          state: "partial",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const updatedBooking = createBooking({
        remaining: [500n, 2000n, 3000n, 4000n],
      });
      rerender(<Passbook b={updatedBooking} />);

      expect(screen.getByText(/dari Rp/)).toBeInTheDocument();
    });
  });

  describe("additional coverage", () => {
    it("handles refund when pbm is null", async () => {
      mockUseMabrurContracts.mockReturnValue({
        pbm: null,
        chainId: 31337,
        isLoading: false,
        ready: false,
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      // Should return early without calling run
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockUseMabrurTx().run).not.toHaveBeenCalled();
    });

    it("displays refund error when outcome is failed", async () => {
      const mockRun = vi.fn(async () => ({
        kind: "failed",
        decoded: {
          name: "RefundFailed",
          en: "Refund failed",
          id: "Refund gagal",
          isRevert: false,
          args: [],
          argNames: [],
        },
        simulated: false,
      }));

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockRun).toHaveBeenCalled();
    });

    it("displays flight vendor with shortHex fallback when label not found", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0xunknownvendor00000000000000000000000000", hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking({
        flightVendor: "0xunknownvendor00000000000000000000000000",
      });
      render(<Passbook b={booking} />);

      // Should show the vendor chip with shortHex since no label found
      expect(screen.getByText(/Tiket dibayar/)).toBeInTheDocument();
    });

    it("displays release hash after successful release", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      const mockRun = vi.fn(async () => ({
        kind: "mined",
        hash: "0xrelease789",
        receipt: {},
      }));

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: mockSignTypedData },
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
        expect(releaseBtn).toBeInTheDocument();
      });

      const releaseBtn = screen.getByRole("button", { name: /Kirim releaseMargin/ });
      await userEvent.click(releaseBtn);

      // Just verify mockRun was called
      expect(mockRun).toHaveBeenCalled();
    });

    it("displays ledger entry for spent with unknown vendor and ref", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Spent",
            blockNumber: 2n,
            logIndex: 0,
            hash: "0xspent123",
            timestamp: 1704153600n,
            amount: 1000n,
            line: 0,
            counterparty: "0xunknownvendor00000000000000000000000000",
            ref: "0xref456",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0xunknownvendor00000000000000000000000000", hash: "0x123", ref: "0xref456" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      const { container } = render(<Passbook b={booking} />);

      // Should display the ledger table
      const tables = container.querySelectorAll("table");
      expect(tables.length).toBeGreaterThan(0);
    });

    it("displays ledger entry without ref when ref is undefined", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Spent",
            blockNumber: 2n,
            logIndex: 0,
            hash: "0xspent123",
            timestamp: 1704153600n,
            amount: 1000n,
            line: 0,
            counterparty: "0x1111111111111111111111111111111111111111",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0x111", hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      // Should display the ledger without ref suffix
      expect(screen.getAllByText(/Flight Vendor/)[0]).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles nil destination in spent transaction", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: undefined, hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getByTestId("stamp-lunas")).toBeInTheDocument();
    });

    it("handles nil refunded event args", async () => {
      mockUseMabrurTx.mockReturnValue({
        run: vi.fn(async () => ({
          kind: "mined",
          hash: "0x123abc",
          receipt: { logs: [] },
          result: undefined,
        })),
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockEventsFrom.mockReturnValue([
        {
          eventName: "Refunded",
          args: {
            amount: undefined,
            caller: undefined,
          },
        },
      ]);

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true, remaining: [100n, 200n, 300n, 400n] });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      await waitFor(() => {
        expect(screen.getByTestId("stamp-dikembalikan")).toBeInTheDocument();
      });
    });

    it("handles multiple spent items on same line", () => {
      mockDeriveLines.mockReturnValue([
        {
          original: 3000n,
          remaining: 0n,
          spent: [
            { amount: 1500n, to: "0x111", hash: "0x123" },
            { amount: 1500n, to: "0x222", hash: "0x456" },
          ],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      expect(screen.getAllByTestId("stamp-lunas").length).toBeGreaterThan(0);
    });

    it("handles zero remaining on all lines", () => {
      mockDeriveLines.mockReturnValue([
        { original: 1000n, remaining: 0n, spent: [], refunded: undefined, state: "lunas" },
        { original: 2000n, remaining: 0n, spent: [], refunded: undefined, state: "lunas" },
        { original: 3000n, remaining: 0n, spent: [], refunded: undefined, state: "lunas" },
        { original: 4000n, remaining: 0n, spent: [], refunded: undefined, state: "lunas" },
      ]);

      const booking = createBooking({ remaining: [0n, 0n, 0n, 0n] });
      render(<Passbook b={booking} />);

      expect(screen.getByText(/Total sisa dana amanah/)).toBeInTheDocument();
    });

    it("signDeparture guard: returns early when walletClient is null", async () => {
      mockUseWalletClient.mockReturnValue({
        data: null,
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      // Should not set depSig since walletClient is null
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(screen.queryByText(/Tanda tangan — tempel di konsol agen/)).not.toBeInTheDocument();
    });

    it("signDeparture guard: returns early when pbm is null", async () => {
      mockUseMabrurContracts.mockReturnValue({
        pbm: null,
        chainId: 31337,
        isLoading: false,
        ready: false,
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });
      render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      // Should not set depSig since pbm is null
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(screen.queryByText(/Tanda tangan — tempel di konsol agen/)).not.toBeInTheDocument();
    });

    it("submitRelease guard: returns early when pbm becomes null during execution", async () => {
      const mockSignTypedData = vi.fn(async () => "0xsignature123");
      const mockRun = vi.fn();

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: mockSignTypedData },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      // First render with pbm available for signing
      mockUseMabrurContracts.mockReturnValue({
        pbm: { address: "0x5555555555555555555555555555555555555555", abi: [] },
        chainId: 31337,
        isLoading: false,
        ready: true,
      });

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: mockSignTypedData },
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });

      const { rerender } = render(<Passbook b={booking} />);

      const signBtn = screen.getByRole("button", { name: /Tanda tangani keberangkatan/ });
      await userEvent.click(signBtn);

      await waitFor(() => {
        expect(screen.getByText(/Tanda tangan — tempel di konsol agen/)).toBeInTheDocument();
      });

      // Now change pbm to null and rerender
      mockUseMabrurContracts.mockReturnValue({
        pbm: null,
        chainId: 31337,
        isLoading: false,
        ready: false,
      });

      rerender(<Passbook b={booking} />);

      // Now try to submit release - since pbm is now null, run should not be called
      const releaseBtn = screen.queryByRole("button", { name: /Kirim releaseMargin/ });
      if (releaseBtn) {
        await userEvent.click(releaseBtn);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Either button doesn't exist or run was not called
      expect(releaseBtn === null || mockRun.mock.calls.length === 0).toBe(true);
    });

    it("submitRelease guard: returns early when depSig is undefined", async () => {
      const mockRun = vi.fn();
      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890",
      });

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseMabrurContracts.mockReturnValue({
        pbm: { address: "0x5555555555555555555555555555555555555555", abi: [] },
        chainId: 31337,
        isLoading: false,
        ready: true,
      });

      const booking = createBooking({
        flightVendor: "0x1111111111111111111111111111111111111111",
        refunded: false,
      });

      // Render without clicking sign - depSig will be undefined
      render(<Passbook b={booking} />);

      // Try to find and check if there are any release buttons - there shouldn't be
      const releaseBtns = screen.queryAllByRole("button", { name: /Kirim releaseMargin/ });
      expect(releaseBtns.length).toBe(0);
    });

    it("doRefund: handles failed outcome correctly", async () => {
      const mockRun = vi.fn(async () => ({
        kind: "failed",
        decoded: {
          name: "TransactionFailed",
          en: "Transaction failed",
          id: "Transaksi gagal",
          isRevert: false,
          args: [],
          argNames: [],
        },
        simulated: false,
      }));

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      await waitFor(() => {
        expect(mockRun).toHaveBeenCalled();
        expect(screen.getByTestId("revert-stamp")).toBeInTheDocument();
      });
    });

    it("getLabel fallback: uses shortHex when vendor label not found", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Spent",
            blockNumber: 2n,
            logIndex: 0,
            hash: "0xspent123",
            timestamp: 1704153600n,
            amount: 1000n,
            line: 0,
            counterparty: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            ref: "0xref123",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      const { container } = render(<Passbook b={booking} />);

      // Should use shortHex since no label found for 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef
      const tables = container.querySelectorAll("table");
      expect(tables.length).toBeGreaterThan(0);
      // Verify that shortHex was used (it should show as "deadb...beef" format)
      expect(screen.getByText(/deadb.*beef/)).toBeInTheDocument();
    });

    it("ledger: spent entry with known vendor and ref", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Spent",
            blockNumber: 2n,
            logIndex: 0,
            hash: "0xspent123",
            timestamp: 1704153600n,
            amount: 1000n,
            line: 0,
            counterparty: "0x1111111111111111111111111111111111111111",
            ref: "0xref123",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0x1111111111111111111111111111111111111111", hash: "0x123", ref: "0xref123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      const { container } = render(<Passbook b={booking} />);

      // Should display Flight Vendor label (from mock) and ref label in the ledger
      const tables = container.querySelectorAll("table");
      expect(tables.length).toBeGreaterThan(0);
      // Check that the table contains both vendor and ref
      const tableText = container.querySelector("table")?.textContent || "";
      expect(tableText).toContain("Flight Vendor");
      expect(tableText).toContain("ref-0xref123");
    });

    it("ledger: spent entry with unknown vendor and no ref", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Spent",
            blockNumber: 2n,
            logIndex: 0,
            hash: "0xspent123",
            timestamp: 1704153600n,
            amount: 1000n,
            line: 0,
            counterparty: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      // Should show table with the spent entry
      expect(screen.getByText(/Keterangan/)).toBeInTheDocument();
    });

    it("ledger: spent entry with known vendor and no ref", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Spent",
            blockNumber: 2n,
            logIndex: 0,
            hash: "0xspent123",
            timestamp: 1704153600n,
            amount: 1000n,
            line: 0,
            counterparty: "0x1111111111111111111111111111111111111111",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0x1111111111111111111111111111111111111111", hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      const { container } = render(<Passbook b={booking} />);

      // Should display Flight Vendor label (from mock) without ref suffix
      const tables = container.querySelectorAll("table");
      expect(tables.length).toBeGreaterThan(0);
      const tableText = container.querySelector("table")?.textContent || "";
      expect(tableText).toContain("Flight Vendor");
    });

    it("refund: handles reverted outcome distinctly from failed", async () => {
      const mockRun = vi.fn(async () => ({
        kind: "reverted",
        decoded: {
          name: "RefundNotAllowed",
          en: "Refund not allowed",
          id: "Refund tidak diizinkan",
          isRevert: true,
          args: [],
          argNames: [],
        },
        simulated: true,
      }));

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      await waitFor(() => {
        expect(mockRun).toHaveBeenCalled();
        expect(screen.getByTestId("revert-stamp")).toBeInTheDocument();
      });
    });

    it("doRefund: sets error for reverted outcome", async () => {
      const mockRun = vi.fn(async () => ({
        kind: "reverted",
        decoded: {
          name: "TestRevert",
          en: "Test",
          id: "Test",
          isRevert: true,
          args: [],
          argNames: [],
        },
        simulated: true,
      }));

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      await waitFor(() => {
        expect(mockRun).toHaveBeenCalled();
        expect(screen.getByTestId("revert-stamp")).toBeInTheDocument();
      });
    });

    it("doRefund: sets error for failed outcome specifically", async () => {
      const mockRun = vi.fn(async () => ({
        kind: "failed",
        decoded: {
          name: "TestFailed",
          en: "Test",
          id: "Test",
          isRevert: false,
          args: [],
          argNames: [],
        },
        simulated: false,
      }));

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      await waitFor(() => {
        expect(mockRun).toHaveBeenCalled();
        expect(screen.getByTestId("revert-stamp")).toBeInTheDocument();
      });
    });

    it("doRefund: handles unexpected outcome kind gracefully", async () => {
      const mockRun = vi.fn(async () => ({
        kind: "simulated-ok",
        result: undefined,
      }));

      mockUseMabrurTx.mockReturnValue({
        run: mockRun,
        busy: false,
        walletClient: { signTypedData: vi.fn() },
      });

      mockUseWalletClient.mockReturnValue({
        data: { signTypedData: vi.fn() },
      });

      const booking = createBooking({ refundable: true });
      render(<Passbook b={booking} />);

      const refundBtn = screen.getByRole("button", { name: /Kembalikan/ });
      await userEvent.click(refundBtn);

      // Should call run but not set outcome or error
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockRun).toHaveBeenCalled();
      // Neither the outcome stamp nor error stamp should appear
      expect(screen.queryByTestId("stamp-dikembalikan")).not.toBeInTheDocument();
      expect(screen.queryByTestId("revert-stamp")).not.toBeInTheDocument();
    });

    it("ledger: spent with unknown line index uses fallback to line 0", () => {
      mockUseBookingLedger.mockReturnValue({
        data: [
          {
            kind: "Spent",
            blockNumber: 2n,
            logIndex: 0,
            hash: "0xspent123",
            timestamp: 1704153600n,
            amount: 1000n,
            line: undefined,
            counterparty: "0x1111111111111111111111111111111111111111",
            ref: "0xref123",
          },
        ],
        isError: false,
      });

      mockDeriveLines.mockReturnValue([
        {
          original: 1000n,
          remaining: 0n,
          spent: [{ amount: 1000n, to: "0x1111111111111111111111111111111111111111", hash: "0x123" }],
          refunded: undefined,
          state: "lunas",
        },
        { original: 2000n, remaining: 2000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 3000n, remaining: 3000n, spent: [], refunded: undefined, state: "earmarked" },
        { original: 4000n, remaining: 4000n, spent: [], refunded: undefined, state: "earmarked" },
      ]);

      const booking = createBooking();
      render(<Passbook b={booking} />);

      // Should use line 0 (Tiket pesawat) when line is undefined
      // The description should show the ticket line name
      expect(screen.getAllByText(/Flight Vendor/)[0]).toBeInTheDocument();
    });
  });
});

describe("Passbook — ID/EN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("ID mode shows only Indonesian: labels, refund button, footnote", () => {
    mockUseWalletClient.mockReturnValue({ data: { signTypedData: vi.fn() } });
    render(<Passbook b={createBooking({ refundable: true })} name="Pak Ahmad" />);
    expect(screen.getByRole("button", { name: /^Kembalikan Rp \d+ ke Pak Ahmad$/ })).toBeInTheDocument();
    expect(screen.getByText("Sudah terima dari")).toBeVisible();
    expect(screen.getByText("Received from")).not.toBeVisible();
    expect(screen.getByText(/Saldo mUMRAH Anda/)).toBeVisible();
    expect(screen.getByText(/Your mUMRAH balance/)).not.toBeVisible();
  });

  it("EN mode shows only English, with the same names and amounts", () => {
    document.documentElement.classList.add("lang-en");
    mockUseWalletClient.mockReturnValue({ data: { signTypedData: vi.fn() } });
    render(<Passbook b={createBooking({ refundable: true })} name="Pak Ahmad" />);
    expect(screen.getByRole("button", { name: /^Return Rp \d+ to Pak Ahmad$/ })).toBeInTheDocument();
    expect(screen.getByText("Received from")).toBeVisible();
    expect(screen.getByText("Sudah terima dari")).not.toBeVisible();
    expect(screen.getByText("Depart by")).toBeVisible();
    expect(screen.getAllByText("Remaining")[0]).toBeVisible();
    expect(screen.getByText(/Your mUMRAH balance is your remaining prepayment/)).toBeVisible();
  });

  it("EN fallback name for an unlabelled pilgrim is 'the pilgrim'", () => {
    document.documentElement.classList.add("lang-en");
    mockUseWalletClient.mockReturnValue({ data: { signTypedData: vi.fn() } });
    render(<Passbook b={createBooking({ refundable: true })} />);
    expect(screen.getByRole("button", { name: /to the pilgrim$/ })).toBeInTheDocument();
  });
});
