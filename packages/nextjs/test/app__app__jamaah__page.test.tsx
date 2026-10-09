import { useRouter, useSearchParams } from "next/navigation";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Address } from "viem";
import { parseSignature } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount, useWalletClient } from "wagmi";
import JamaahPage from "~~/app/app/jamaah/page";
import {
  ZERO,
  eventsFrom,
  useBooking,
  useBookingsOf,
  useChainNow,
  useMabrurContracts,
  useMabrurTx,
} from "~~/hooks/mabrur/useMabrur";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { decodeRevert } from "~~/utils/mabrur/errors";
import { formatRp, fromLocalInput, toLocalInput } from "~~/utils/mabrur/format";
import { defaultAgency, getLabel, loadJson, saveJson, setLabel } from "~~/utils/mabrur/names";

vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));
vi.mock("wagmi", () => ({ useAccount: vi.fn(), useWalletClient: vi.fn() }));
vi.mock("~~/hooks/scaffold-eth", () => ({ useScaffoldReadContract: vi.fn(), useScaffoldWriteContract: vi.fn() }));
vi.mock("~~/hooks/mabrur/useMabrur", () => ({
  ZERO: "0x0000000000000000000000000000000000000000",
  eventsFrom: vi.fn(() => []),
  useBooking: vi.fn(),
  useBookingsOf: vi.fn(),
  useChainNow: vi.fn(),
  useMabrurContracts: vi.fn(),
  useMabrurTx: vi.fn(),
}));
vi.mock("~~/components/mabrur/ui", () => ({
  AddressChip: (p: any) => <span data-testid="addr">{p.address}</span>,
  Bi: (p: any) => <div data-testid="bi">{p.id}</div>,
  ContractsGuard: (p: any) => <div data-testid="g">{p.children}</div>,
  Label: (p: any) => <label>{p.children}</label>,
  PageShell: (p: any) => <div data-testid="s">{p.children}</div>,
  RevertStamp: (p: any) => <div data-testid="st">{p.d?.name}</div>,
  Rp: (p: any) => <span>{p.value}</span>,
  TxLink: (p: any) => <a data-testid="tl">{p.hash}</a>,
}));
vi.mock("~~/components/mabrur/Passbook", () => ({ Passbook: () => <div data-testid="p">P</div> }));
vi.mock("~~/utils/mabrur/format", () => ({
  LINES: [
    { key: "k1", id: "L1", ruleId: "R1", ruleEn: "E1" },
    { key: "k2", id: "L2", ruleId: "R2", ruleEn: "E2" },
    { key: "k3", id: "L3", ruleId: "R3", ruleEn: "E3" },
    { key: "k4", id: "L4", ruleId: "R4", ruleEn: "E4" },
  ],
  formatCountdown: vi.fn(() => "10d"),
  formatDateWIB: vi.fn(() => "2024-01-01"),
  formatRp: vi.fn(v => (v ? `${v}` : "0")),
  fromLocalInput: vi.fn(s => (s ? 1704067200 : 0)),
  idHex: vi.fn(id => `0x${String(typeof id === "bigint" ? id : id).padStart(64, "0")}`),
  parseBookingId: vi.fn(s => {
    try {
      return s ? BigInt(s) : undefined;
    } catch {
      return undefined;
    }
  }),
  parseRp: vi.fn(s => {
    const n = BigInt(s.replace(/\D/g, "") || "0");
    return n > 0n ? n : undefined;
  }),
  shortHex: vi.fn(h => h.slice(0, 10)),
  toLocalInput: vi.fn(() => "2024-01-01"),
}));
vi.mock("~~/utils/mabrur/names", () => ({
  defaultAgency: vi.fn(() => "0xd"),
  getLabel: vi.fn(() => null),
  loadJson: vi.fn(() => null),
  saveJson: vi.fn(),
  setLabel: vi.fn(),
}));
vi.mock("~~/utils/mabrur/errors", () => ({ decodeRevert: vi.fn(() => ({ name: "E", en: "E", isRevert: true })) }));
vi.mock("viem", async () => {
  const a = await vi.importActual("viem");
  return {
    ...a,
    isAddress: vi.fn(a => typeof a === "string" && a.startsWith("0x") && a.length === 42),
    parseSignature: vi.fn(() => ({ r: "0xr", s: "0xs", v: 27n, yParity: 0 })),
  };
});

const m = {
  r: useRouter as any,
  p: useSearchParams as any,
  a: useAccount as any,
  w: useWalletClient as any,
  rd: useScaffoldReadContract as any,
  wr: useScaffoldWriteContract as any,
  cn: useChainNow as any,
  c: useMabrurContracts as any,
  tx: useMabrurTx as any,
  b: useBooking as any,
  bs: useBookingsOf as any,
};

describe("app/app/jamaah/page.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const s = () => {
    m.r.mockReturnValue({ push: vi.fn(), refresh: vi.fn() });
    m.p.mockReturnValue({ get: vi.fn(() => null) });
    m.a.mockReturnValue({ address: undefined });
    m.w.mockReturnValue({ data: undefined });
    m.cn.mockReturnValue({ now: Math.floor(Date.now() / 1000) });
    m.c.mockReturnValue({
      pbm: { address: "0xpbm", abi: [] },
      tidr: { address: "0xtidr", abi: [] },
      publicClient: {},
      chainId: 31337,
    });
    m.tx.mockReturnValue({ run: vi.fn(), busy: false });
    m.rd.mockReturnValue({ data: undefined });
    m.wr.mockReturnValue({ writeContractAsync: vi.fn(), isMining: false });
    m.b.mockReturnValue({ data: undefined });
    m.bs.mockReturnValue({ data: { bookings: [] } });
  };

  const booking = {
    id: 1n,
    pilgrim: "0x1234567890123456789012345678901234567890" as Address,
    agency: "0x2222222222222222222222222222222222222222" as Address,
    ticketBy: 1704067200n,
    departBy: 1704153600n,
    departed: false,
    marginReleased: false,
    refunded: false,
    flightVendor: ZERO as Address,
    remaining: [1000n, 2000n, 3000n, 4000n],
    deposited: 10000n,
    refundable: false,
  };

  it("main render", () => {
    s();
    const { container } = render(<JamaahPage />);
    expect(container).toBeInTheDocument();
  });
  it("renders the full page without query params while useSearchParams suspends (static HTML fallback)", () => {
    s();
    (useSearchParams as any).mockImplementation(() => {
      throw new Promise(() => {});
    });
    render(<JamaahPage />);
    expect(screen.getByText("Buku Amanah Jamaah")).toBeInTheDocument();
  });
  it("L1", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("L1")).toBeTruthy();
  });
  it("L2", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("L2")).toBeTruthy();
  });
  it("L3", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("L3")).toBeTruthy();
  });
  it("L4", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("L4")).toBeTruthy();
  });
  it("form", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("Pesan paket umrah")).toBeTruthy();
  });
  it("lookup section", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("Lihat booking")).toBeTruthy();
  });
  it("lookup input", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByPlaceholderText("0x…")).toBeTruthy();
  });
  it("lookup button", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByRole("button", { name: "Lihat" })).toBeTruthy();
  });
  it("connect msg", () => {
    s();
    m.a.mockReturnValue({ address: undefined });
    render(<JamaahPage />);
    expect(screen.getByText("Hubungkan dompet")).toBeTruthy();
  });
  it("chip", () => {
    s();
    m.a.mockReturnValue({ address: "0x1234567890123456789012345678901234567890" });
    render(<JamaahPage />);
    expect(screen.getByTestId("addr")).toBeTruthy();
  });
  it("faucet low", () => {
    s();
    m.a.mockReturnValue({ address: "0x1234567890123456789012345678901234567890" });
    m.rd.mockImplementation(x => (x.functionName === "balanceOf" ? { data: 1000n } : { data: undefined }));
    render(<JamaahPage />);
    expect(screen.getByText("Ambil tIDR uji")).toBeTruthy();
  });
  it("faucet high", () => {
    s();
    m.a.mockReturnValue({ address: "0x1234567890123456789012345678901234567890" });
    m.rd.mockImplementation(x => (x.functionName === "balanceOf" ? { data: 50000000n } : { data: undefined }));
    render(<JamaahPage />);
    expect(!screen.queryByText("Ambil tIDR uji"));
  });
  it("passbook", () => {
    s();
    m.b.mockReturnValue({ data: booking });
    render(<JamaahPage />);
    expect(screen.getByTestId("p")).toBeTruthy();
  });
  it("null booking", () => {
    s();
    m.p.mockReturnValue({ get: (k: string) => (k === "id" ? "999" : null) });
    m.b.mockReturnValue({ data: null });
    render(<JamaahPage />);
    expect(screen.getByTestId("bi")).toBeTruthy();
  });
  it("refunded", () => {
    s();
    m.bs.mockReturnValue({ data: { bookings: [{ ...booking, refunded: true, remaining: [0n, 0n, 0n, 0n] }] } });
    m.cn.mockReturnValue({ now: Math.floor(Date.now() / 1000) });
    render(<JamaahPage />);
    expect(screen.getByText("Dikembalikan")).toBeTruthy();
  });
  it("refundable", () => {
    s();
    m.bs.mockReturnValue({ data: { bookings: [{ ...booking, refundable: true }] } });
    m.cn.mockReturnValue({ now: Math.floor(Date.now() / 1000) });
    render(<JamaahPage />);
    expect(screen.getByText("Bisa refund")).toBeTruthy();
  });
  it("paid", () => {
    s();
    m.bs.mockReturnValue({
      data: { bookings: [{ ...booking, flightVendor: "0x9999999999999999999999999999999999999999" as Address }] },
    });
    m.cn.mockReturnValue({ now: Math.floor(Date.now() / 1000) });
    render(<JamaahPage />);
    expect(screen.getByText("Tiket lunas")).toBeTruthy();
  });
  it("deadline", () => {
    s();
    const now = Math.floor(Date.now() / 1000);
    m.bs.mockReturnValue({
      data: { bookings: [{ ...booking, ticketBy: BigInt(now + 86400), departBy: BigInt(now + 172800) }] },
    });
    m.cn.mockReturnValue({ now });
    render(<JamaahPage />);
    expect(screen.queryAllByText(/Batas tiket/).length > 0).toBe(true);
  });
  it("id param", () => {
    s();
    m.p.mockReturnValue({ get: (k: string) => (k === "id" ? "1" : null) });
    m.b.mockReturnValue({ data: booking });
    render(<JamaahPage />);
    expect(screen.getByTestId("p")).toBeTruthy();
  });
  it("no bookings", () => {
    s();
    m.p.mockReturnValue({
      get: (k: string) => (k === "pilgrim" ? "0x1234567890123456789012345678901234567890" : null),
    });
    m.bs.mockReturnValue({ data: { bookings: [] } });
    render(<JamaahPage />);
    expect(screen.getByText(/Belum ada booking untuk/)).toBeTruthy();
  });
  it("title", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText(/Buku Amanah/)).toBeTruthy();
  });
  it("desc", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText(/Your prepayment/)).toBeTruthy();
  });
  it("pilgrim label", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("Jamaah")).toBeTruthy();
  });
  it("total", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("Jumlah")).toBeTruthy();
  });
  it("name input", () => {
    s();
    const { container } = render(<JamaahPage />);
    expect(container.querySelector('input[aria-label="Nama jamaah"]')).toBeTruthy();
  });
  it("agency input", () => {
    s();
    const { container } = render(<JamaahPage />);
    expect(container.querySelector('input[aria-label="Alamat agen"]')).toBeTruthy();
  });
  it("ticket input", () => {
    s();
    const { container } = render(<JamaahPage />);
    expect(container.querySelector('input[aria-label="Batas tiket"]')).toBeTruthy();
  });
  it("depart input", () => {
    s();
    const { container } = render(<JamaahPage />);
    expect(container.querySelector('input[aria-label="Batas berangkat"]')).toBeTruthy();
  });
  it("demo button", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("Demo: 10 menit")).toBeTruthy();
  });
  it("multiple bookings", () => {
    s();
    m.bs.mockReturnValue({ data: { bookings: [booking, { ...booking, id: 2n }] } });
    m.cn.mockReturnValue({ now: Math.floor(Date.now() / 1000) });
    const { container } = render(<JamaahPage />);
    expect(container.querySelectorAll("[aria-pressed]").length > 0).toBe(true);
  });
  it("receipt label", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText("No. kuitansi (berikutnya)")).toBeTruthy();
  });
  it("lookup help", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText(/Alamat jamaah atau id booking/)).toBeTruthy();
  });
  it("fee disclaimer", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText(/Ujrah agen maksimal/)).toBeTruthy();
  });
  it("deadline help", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText(/If no flight ticket is paid/)).toBeTruthy();
  });
  it("tIDR info", () => {
    s();
    render(<JamaahPage />);
    expect(screen.getByText(/tIDR = token uji/)).toBeTruthy();
  });
});

const ADDR = "0x1234567890123456789012345678901234567890";
const AGENCY = "0x2222222222222222222222222222222222222222";
const VENDOR = "0x9999999999999999999999999999999999999999" as Address;

const mk = {
  r: useRouter as any,
  p: useSearchParams as any,
  a: useAccount as any,
  w: useWalletClient as any,
  rd: useScaffoldReadContract as any,
  wr: useScaffoldWriteContract as any,
  cn: useChainNow as any,
  c: useMabrurContracts as any,
  tx: useMabrurTx as any,
  b: useBooking as any,
  bs: useBookingsOf as any,
};

const baseBooking = {
  id: 1n,
  pilgrim: ADDR as Address,
  agency: AGENCY as Address,
  ticketBy: 1704067200n,
  departBy: 1704153600n,
  departed: false,
  marginReleased: false,
  refunded: false,
  flightVendor: ZERO as Address,
  remaining: [1000n, 2000n, 3000n, 4000n],
  deposited: 10000n,
  refundable: false,
};

describe("app/app/jamaah/page.tsx behaviour", () => {
  let push: ReturnType<typeof vi.fn>;
  let signTypedData: ReturnType<typeof vi.fn>;
  let publicClient: { readContract: any; simulateContract: any };
  let run: ReturnType<typeof vi.fn>;
  let writeContractAsync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
    (decodeRevert as any).mockImplementation(() => ({ name: "E", en: "E", isRevert: true }));
    (getLabel as any).mockImplementation(() => null);
    (loadJson as any).mockImplementation(() => null);
    (defaultAgency as any).mockImplementation(() => AGENCY);
    (eventsFrom as any).mockImplementation(() => []);
    (parseSignature as any).mockImplementation(() => ({ r: "0xr", s: "0xs", v: 27n, yParity: 0 }));

    push = vi.fn();
    signTypedData = vi.fn().mockResolvedValue("0xsig");
    publicClient = {
      readContract: vi.fn(async ({ functionName }: any) =>
        functionName === "eip712Domain" ? ["0x0f", "TIDR", "1", 31337n, "0xtidr", "0x", []] : 3n,
      ),
      simulateContract: vi.fn().mockResolvedValue({}),
    };
    run = vi.fn().mockResolvedValue({ kind: "mined", hash: "0xhash", receipt: {}, result: 7n });
    writeContractAsync = vi.fn();
    mk.r.mockReturnValue({ push, refresh: vi.fn() });
    mk.p.mockReturnValue({ get: vi.fn(() => null) });
    mk.a.mockReturnValue({ address: ADDR });
    mk.w.mockReturnValue({ data: { signTypedData } });
    mk.cn.mockReturnValue({ now: Math.floor(Date.now() / 1000) });
    mk.c.mockReturnValue({
      pbm: { address: "0xpbm", abi: [] },
      tidr: { address: "0xtidr", abi: [] },
      publicClient,
      chainId: 31337,
    });
    mk.tx.mockReturnValue({ run, busy: false });
    mk.rd.mockImplementation((x: any) => ({
      data: x.functionName === "balanceOf" ? 50000000n : x.functionName === "bookingNonce" ? 2n : 5n,
    }));
    mk.wr.mockReturnValue({ writeContractAsync, isMining: false });
    mk.b.mockReturnValue({ data: undefined });
    mk.bs.mockReturnValue({ data: { bookings: [] } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const bookBtn = () => screen.getByRole("button", { name: /Tanda tangani/ }) as HTMLButtonElement;
  const clickBook = async () => {
    await act(async () => {
      fireEvent.click(bookBtn());
    });
  };
  const tick = async (ms = 400) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  describe("book form prefill", () => {
    it("fills the agency from storage when one was saved", () => {
      (loadJson as any).mockImplementation(() => "0x3333333333333333333333333333333333333333");
      render(<JamaahPage />);
      expect((screen.getByLabelText("Alamat agen") as HTMLInputElement).value).toBe(
        "0x3333333333333333333333333333333333333333",
      );
    });

    it("falls back to the default agency when nothing is saved", () => {
      render(<JamaahPage />);
      expect((screen.getByLabelText("Alamat agen") as HTMLInputElement).value).toBe(AGENCY);
    });

    it("prefills the pilgrim name from the stored label", () => {
      (getLabel as any).mockImplementation((k: string) => (k === ADDR ? "Ali" : null));
      render(<JamaahPage />);
      expect((screen.getByLabelText("Nama jamaah") as HTMLInputElement).value).toBe("Ali");
    });

    it("shows the next receipt number when connected and a nonce id exists", () => {
      render(<JamaahPage />);
      expect(screen.getByText(/^0x0000/, { selector: "span.mb-data" })).toBeTruthy();
    });

    it("shows a dash for the receipt number without a wallet", () => {
      mk.a.mockReturnValue({ address: undefined });
      render(<JamaahPage />);
      expect(screen.getByText("—")).toBeTruthy();
    });

    it("shows a dash for the receipt number while the id is still loading", () => {
      mk.rd.mockImplementation((x: any) => ({ data: x.functionName === "balanceOf" ? 50000000n : undefined }));
      render(<JamaahPage />);
      expect(screen.getByText("—")).toBeTruthy();
    });
  });

  describe("form inputs", () => {
    it("edits the pilgrim name", () => {
      render(<JamaahPage />);
      const input = screen.getByLabelText("Nama jamaah") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Budi" } });
      expect(input.value).toBe("Budi");
    });

    it("trims the agency address and shows a chip only when it is a valid address", () => {
      render(<JamaahPage />);
      const input = screen.getByLabelText("Alamat agen") as HTMLInputElement;
      expect(screen.getAllByTestId("addr")).toHaveLength(2);
      fireEvent.change(input, { target: { value: "  nope  " } });
      expect(input.value).toBe("nope");
      expect(screen.getAllByTestId("addr")).toHaveLength(1);
      expect(bookBtn().disabled).toBe(true);
    });

    it("recomputes the total and disables booking when a line is not a number", () => {
      render(<JamaahPage />);
      expect(bookBtn().textContent).toContain("32000000");
      fireEvent.change(screen.getByLabelText("Jumlah L1"), { target: { value: "0" } });
      expect(bookBtn().disabled).toBe(true);
      fireEvent.change(screen.getByLabelText("Jumlah L1"), { target: { value: "1.000.000" } });
      expect(bookBtn().textContent).toContain("19000000");
      expect(bookBtn().disabled).toBe(false);
    });

    it("updates the ticket deadline from the datetime input", () => {
      render(<JamaahPage />);
      fireEvent.change(screen.getByLabelText("Batas tiket"), { target: { value: "2024-02-01T10:00" } });
      expect(fromLocalInput).toHaveBeenCalledWith("2024-02-01T10:00");
    });

    it("updates the departure deadline from the datetime input", () => {
      render(<JamaahPage />);
      fireEvent.change(screen.getByLabelText("Batas berangkat"), { target: { value: "2024-03-01T10:00" } });
      expect(fromLocalInput).toHaveBeenCalledWith("2024-03-01T10:00");
    });

    it("clears the deadline inputs when the datetime parses to zero", () => {
      render(<JamaahPage />);
      fireEvent.change(screen.getByLabelText("Batas tiket"), { target: { value: "2024-02-01T10:00" } });
      (fromLocalInput as any).mockReturnValueOnce(0);
      fireEvent.change(screen.getByLabelText("Batas tiket"), { target: { value: "" } });
      expect((screen.getByLabelText("Batas tiket") as HTMLInputElement).value).toBe("");
    });

    it("the demo button sets the ticket deadline ten minutes from now", () => {
      render(<JamaahPage />);
      fireEvent.click(screen.getByText("Demo: 10 menit"));
      expect(toLocalInput).toHaveBeenCalledWith(Math.floor(Date.now() / 1000) + 600);
    });
  });

  describe("faucet", () => {
    it("requests test tIDR for the connected wallet", () => {
      mk.rd.mockImplementation((x: any) => ({ data: x.functionName === "balanceOf" ? 1n : undefined }));
      render(<JamaahPage />);
      fireEvent.click(screen.getByText("Ambil tIDR uji"));
      expect(writeContractAsync).toHaveBeenCalledWith({ functionName: "faucet", args: [ADDR] });
    });

    it("treats an unloaded balance as zero and offers the faucet", () => {
      mk.rd.mockImplementation(() => ({ data: undefined }));
      render(<JamaahPage />);
      expect(screen.getByText("Ambil tIDR uji")).toBeTruthy();
      expect(bookBtn().disabled).toBe(true);
    });

    it("disables the faucet button while minting", () => {
      mk.rd.mockImplementation(() => ({ data: 0n }));
      mk.wr.mockReturnValue({ writeContractAsync, isMining: true });
      render(<JamaahPage />);
      expect((screen.getByRole("button", { name: "Ambil tIDR uji" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("hides the faucet when no wallet is connected", () => {
      mk.a.mockReturnValue({ address: undefined });
      render(<JamaahPage />);
      expect(screen.queryByText("Ambil tIDR uji")).toBeNull();
      expect(screen.getByText(/Hubungkan dompet untuk memesan/)).toBeTruthy();
    });
  });

  describe("preflight simulation", () => {
    it("simulates book() with an empty permit after the debounce and shows nothing on success", async () => {
      render(<JamaahPage />);
      expect(publicClient.simulateContract).not.toHaveBeenCalled();
      await tick();
      expect(publicClient.simulateContract).toHaveBeenCalledTimes(1);
      const arg = publicClient.simulateContract.mock.calls[0][0];
      expect(arg.functionName).toBe("book");
      expect(arg.account).toBe(ADDR);
      expect(arg.args[1]).toEqual([14000000n, 9000000n, 4000000n, 5000000n]);
      expect(screen.queryByTestId("st")).toBeNull();
    });

    it("simulates from a placeholder account when no wallet is connected", async () => {
      mk.a.mockReturnValue({ address: undefined });
      render(<JamaahPage />);
      await tick();
      expect(publicClient.simulateContract.mock.calls[0][0].account).toBe("0x000000000000000000000000000000000000dEaD");
    });

    it("shows the decoded revert and blocks booking when the simulation reverts", async () => {
      publicClient.simulateContract.mockRejectedValue(new Error("x"));
      (decodeRevert as any).mockImplementation(() => ({ name: "NotLicensed", en: "no", isRevert: true }));
      render(<JamaahPage />);
      await tick();
      expect(screen.getByTestId("st").textContent).toBe("NotLicensed");
      expect(bookBtn().disabled).toBe(true);
    });

    it.each(["ERC20InsufficientAllowance", "ERC20InsufficientBalance"])(
      "ignores %s because it only means the permit is not signed yet",
      async name => {
        publicClient.simulateContract.mockRejectedValue(new Error("x"));
        (decodeRevert as any).mockImplementation(() => ({ name, en: "no", isRevert: true }));
        render(<JamaahPage />);
        await tick();
        expect(screen.queryByTestId("st")).toBeNull();
        expect(bookBtn().disabled).toBe(false);
      },
    );

    it("ignores non-revert failures such as network errors", async () => {
      publicClient.simulateContract.mockRejectedValue(new Error("network"));
      (decodeRevert as any).mockImplementation(() => ({ name: "Net", en: "net", isRevert: false }));
      render(<JamaahPage />);
      await tick();
      expect(screen.queryByTestId("st")).toBeNull();
    });

    it("clears a previous revert once the simulation succeeds again", async () => {
      publicClient.simulateContract.mockRejectedValueOnce(new Error("x"));
      (decodeRevert as any).mockImplementation(() => ({ name: "Bad", en: "bad", isRevert: true }));
      render(<JamaahPage />);
      await tick();
      expect(screen.getByTestId("st")).toBeTruthy();
      fireEvent.change(screen.getByLabelText("Jumlah L1"), { target: { value: "15.000.000" } });
      await tick();
      expect(screen.queryByTestId("st")).toBeNull();
    });

    it("does not simulate when the agency address is invalid", async () => {
      render(<JamaahPage />);
      fireEvent.change(screen.getByLabelText("Alamat agen"), { target: { value: "bad" } });
      await tick(1000);
      expect(publicClient.simulateContract).not.toHaveBeenCalled();
    });

    it("does not simulate when the contracts are not ready", async () => {
      mk.c.mockReturnValue({ pbm: undefined, tidr: undefined, publicClient, chainId: 31337 });
      render(<JamaahPage />);
      await tick(1000);
      expect(publicClient.simulateContract).not.toHaveBeenCalled();
    });

    it("debounces: a change inside the window cancels the earlier timer", async () => {
      render(<JamaahPage />);
      await tick(200);
      fireEvent.change(screen.getByLabelText("Jumlah L2"), { target: { value: "8.000.000" } });
      await tick(200);
      expect(publicClient.simulateContract).not.toHaveBeenCalled();
      await tick(300);
      expect(publicClient.simulateContract).toHaveBeenCalledTimes(1);
    });
  });

  describe("booking", () => {
    it("signs a permit, sends book() and reports the new booking id", async () => {
      mk.p.mockReturnValue({ get: vi.fn(() => null) });
      (getLabel as any).mockImplementation((k: string) => (k === ADDR ? "Ali" : null));
      (eventsFrom as any).mockImplementation(() => [{ eventName: "Booked", args: { id: 11n } }]);
      render(<JamaahPage />);
      await clickBook();

      expect(saveJson).toHaveBeenCalledWith("mabrur.agency.31337", AGENCY);
      expect(setLabel).toHaveBeenCalledWith(ADDR, "Ali");
      expect(signTypedData.mock.calls[0][0].domain).toEqual({
        name: "TIDR",
        version: "1",
        chainId: 31337,
        verifyingContract: "0xtidr",
      });
      expect(signTypedData.mock.calls[0][0].message.value).toBe(32000000n);
      expect(signTypedData.mock.calls[0][0].message.nonce).toBe(3n);
      const arg = run.mock.calls[0][0];
      expect(arg.functionName).toBe("book");
      expect(arg.args[0]).toBe(AGENCY);
      expect(arg.args[5]).toBe(27);
      expect(arg.args.slice(6)).toEqual(["0xr", "0xs"]);
      expect(screen.getByTestId("tl").textContent).toBe("0xhash");
      expect(setLabel).toHaveBeenCalledWith(expect.stringMatching(/^0x0+11$/), "Ali");
      expect(mk.b).toHaveBeenLastCalledWith(11n);
      expect(screen.queryByText(/Menandatangani|Mengirim/)).toBeNull();
    });

    it("does not store a label when the name is empty", async () => {
      render(<JamaahPage />);
      await clickBook();
      expect(setLabel).not.toHaveBeenCalled();
      expect(mk.b).toHaveBeenLastCalledWith(7n);
    });

    it("falls back to the result of book() when the receipt has no Booked event", async () => {
      (eventsFrom as any).mockImplementation(() => [{ eventName: "Other", args: {} }]);
      render(<JamaahPage />);
      await clickBook();
      expect(mk.b).toHaveBeenLastCalledWith(7n);
    });

    it("selects nothing when neither the event nor the result carries an id", async () => {
      run.mockResolvedValue({ kind: "mined", hash: "0xhash", receipt: {}, result: undefined });
      render(<JamaahPage />);
      await clickBook();
      expect(screen.getByTestId("tl")).toBeTruthy();
      expect(mk.b).not.toHaveBeenCalledWith(expect.anything());
    });

    it("derives v from yParity when the signature has no v", async () => {
      (parseSignature as any).mockImplementation(() => ({ r: "0xr", s: "0xs", v: undefined, yParity: 1 }));
      render(<JamaahPage />);
      await clickBook();
      expect(run.mock.calls[0][0].args[5]).toBe(28);
    });

    it("derives v as 27 when neither v nor yParity is present", async () => {
      (parseSignature as any).mockImplementation(() => ({ r: "0xr", s: "0xs", v: undefined, yParity: undefined }));
      render(<JamaahPage />);
      await clickBook();
      expect(run.mock.calls[0][0].args[5]).toBe(27);
    });

    it("shows the decoded error when the transaction reverts", async () => {
      run.mockResolvedValue({ kind: "reverted", decoded: { name: "Reverted", en: "r", isRevert: true } });
      render(<JamaahPage />);
      await clickBook();
      expect(screen.getByTestId("st").textContent).toBe("Reverted");
      expect(screen.queryByTestId("tl")).toBeNull();
    });

    it("shows the decoded error when the transaction fails", async () => {
      run.mockResolvedValue({ kind: "failed", decoded: { name: "Failed", en: "f", isRevert: false } });
      render(<JamaahPage />);
      await clickBook();
      expect(screen.getByTestId("st").textContent).toBe("Failed");
    });

    it("shows nothing for an outcome that is neither mined, reverted nor failed", async () => {
      run.mockResolvedValue({ kind: "rejected" });
      render(<JamaahPage />);
      await clickBook();
      expect(screen.queryByTestId("st")).toBeNull();
      expect(screen.queryByTestId("tl")).toBeNull();
    });

    it("decodes the error when the wallet rejects the signature", async () => {
      signTypedData.mockRejectedValue(new Error("User rejected"));
      (decodeRevert as any).mockImplementation(() => ({ name: "UserRejected", en: "no", isRevert: false }));
      render(<JamaahPage />);
      await clickBook();
      expect(screen.getByTestId("st").textContent).toBe("UserRejected");
      expect(run).not.toHaveBeenCalled();
      expect(bookBtn().disabled).toBe(false);
    });

    it("decodes the error when reading the permit domain fails", async () => {
      publicClient.readContract.mockRejectedValue(new Error("rpc"));
      render(<JamaahPage />);
      await clickBook();
      expect(screen.getByTestId("st").textContent).toBe("E");
    });

    it("shows the progress step while signing", async () => {
      let release: (v: string) => void = () => {};
      signTypedData.mockReturnValue(new Promise<string>(r => (release = r)));
      render(<JamaahPage />);
      await clickBook();
      expect(screen.getByText("Menandatangani permit…")).toBeTruthy();
      expect(bookBtn().disabled).toBe(true);
      await act(async () => {
        release("0xsig");
      });
      expect(screen.queryByText("Menandatangani permit…")).toBeNull();
    });

    it("clears the previous error and tx link when booking again", async () => {
      run.mockResolvedValueOnce({ kind: "reverted", decoded: { name: "Reverted", en: "r", isRevert: true } });
      render(<JamaahPage />);
      await clickBook();
      expect(screen.getByTestId("st")).toBeTruthy();
      await clickBook();
      expect(screen.queryByTestId("st")).toBeNull();
      expect(screen.getByTestId("tl")).toBeTruthy();
    });

    it.each([
      ["pbm", { pbm: undefined }],
      ["tidr", { tidr: undefined }],
      ["publicClient", { publicClient: undefined }],
    ])("does nothing when %s is not available", async (_n, patch) => {
      mk.c.mockReturnValue({
        pbm: { address: "0xpbm", abi: [] },
        tidr: { address: "0xtidr", abi: [] },
        publicClient,
        chainId: 31337,
        ...patch,
      });
      render(<JamaahPage />);
      await clickBook();
      expect(signTypedData).not.toHaveBeenCalled();
      expect(saveJson).not.toHaveBeenCalled();
    });

    it("does nothing without a connected account", async () => {
      mk.a.mockReturnValue({ address: undefined });
      render(<JamaahPage />);
      await clickBook();
      expect(signTypedData).not.toHaveBeenCalled();
    });

    it("keeps the book button disabled without a wallet client or while a tx is busy", () => {
      mk.w.mockReturnValue({ data: undefined });
      const { unmount } = render(<JamaahPage />);
      expect(bookBtn().disabled).toBe(true);
      unmount();
      mk.w.mockReturnValue({ data: { signTypedData } });
      mk.tx.mockReturnValue({ run, busy: true });
      render(<JamaahPage />);
      expect(bookBtn().disabled).toBe(true);
      expect(formatRp).toHaveBeenCalled();
    });
  });

  describe("look up", () => {
    const lookup = (v: string) => {
      fireEvent.change(screen.getByLabelText("Alamat atau id booking"), { target: { value: v } });
      fireEvent.click(screen.getByRole("button", { name: "Lihat" }));
    };

    it("navigates to the pilgrim view for an address", () => {
      render(<JamaahPage />);
      lookup(`  ${AGENCY}  `);
      expect(push).toHaveBeenCalledWith(`/app/jamaah?pilgrim=${AGENCY}`);
    });

    it("navigates to the booking view for a booking id", () => {
      render(<JamaahPage />);
      lookup("42");
      expect(push).toHaveBeenCalledWith("/app/jamaah?id=42");
    });

    it("ignores input that is neither an address nor an id", () => {
      render(<JamaahPage />);
      lookup("not-an-id");
      lookup("");
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("booking list and selection", () => {
    it("preselects the newest booking and switches selection when a tab is clicked", () => {
      mk.bs.mockReturnValue({
        data: {
          bookings: [
            { ...baseBooking, id: 1n },
            { ...baseBooking, id: 2n },
          ],
        },
      });
      render(<JamaahPage />);
      const pressed = () => document.querySelectorAll('[aria-pressed="true"]');
      expect(pressed()).toHaveLength(1);
      expect(mk.b).toHaveBeenLastCalledWith(1n);
      const other = document.querySelector('[aria-pressed="false"]') as HTMLElement;
      fireEvent.click(other);
      expect(mk.b).toHaveBeenLastCalledWith(2n);
      expect(pressed()).toHaveLength(1);
      expect(pressed()[0]).toBe(other);
    });

    it.each([
      ["refunded", { refunded: true }],
      ["margin released", { marginReleased: true }],
      ["paid vendor", { flightVendor: VENDOR }],
      ["partly paid out", { remaining: [1n, 2n, 3n, 4n] }],
    ])("prefers the booking with activity (%s) over a newer untouched one", (_n, patch) => {
      mk.bs.mockReturnValue({
        data: {
          bookings: [
            { ...baseBooking, id: 1n },
            { ...baseBooking, id: 2n, ...patch },
          ],
        },
      });
      render(<JamaahPage />);
      expect(mk.b).toHaveBeenLastCalledWith(2n);
    });

    it("falls back to the newest booking when none has activity", () => {
      mk.bs.mockReturnValue({
        data: {
          bookings: [
            { ...baseBooking, id: 1n },
            { ...baseBooking, id: 2n },
          ],
        },
      });
      render(<JamaahPage />);
      expect(mk.b).toHaveBeenLastCalledWith(1n);
    });

    it("keeps an explicit ?id= over the automatic pick", () => {
      mk.p.mockReturnValue({ get: (k: string) => (k === "id" ? "2" : null) });
      mk.bs.mockReturnValue({
        data: {
          bookings: [
            { ...baseBooking, id: 1n },
            { ...baseBooking, id: 2n },
          ],
        },
      });
      render(<JamaahPage />);
      expect(mk.b).toHaveBeenLastCalledWith(2n);
    });

    it("lists bookings for a ?pilgrim= address and puts the passbook first on deep links", () => {
      mk.p.mockReturnValue({ get: (k: string) => (k === "pilgrim" ? AGENCY : null) });
      mk.bs.mockReturnValue({ data: { bookings: [baseBooking] } });
      const { container } = render(<JamaahPage />);
      expect(mk.bs).toHaveBeenCalledWith(AGENCY);
      expect(container.querySelector(".order-first")).toBeTruthy();
    });

    it("uses the connected wallet as pilgrim when ?pilgrim= is not an address", () => {
      mk.p.mockReturnValue({ get: (k: string) => (k === "pilgrim" ? "junk" : null) });
      const { container } = render(<JamaahPage />);
      expect(mk.bs).toHaveBeenCalledWith(ADDR);
      expect(container.querySelector(".order-first")).toBeTruthy();
    });

    it("reports an empty list for the connected wallet", () => {
      render(<JamaahPage />);
      expect(screen.getByText(/Belum ada booking untuk/)).toBeTruthy();
    });

    it("shows no list and no empty note while bookings load", () => {
      mk.bs.mockReturnValue({ data: undefined });
      render(<JamaahPage />);
      expect(screen.queryByText(/Belum ada booking/)).toBeNull();
      expect(document.querySelector("[aria-pressed]")).toBeNull();
    });

    it("drops the previous pick when ?pilgrim= changes and re-picks from the new list", () => {
      mk.bs.mockReturnValue({ data: { bookings: [{ ...baseBooking, id: 1n }] } });
      const { rerender } = render(<JamaahPage />);
      expect(mk.b).toHaveBeenLastCalledWith(1n);
      mk.p.mockReturnValue({ get: (k: string) => (k === "pilgrim" ? AGENCY : null) });
      mk.bs.mockReturnValue({ data: { bookings: [{ ...baseBooking, id: 9n }] } });
      rerender(<JamaahPage />);
      expect(mk.b).toHaveBeenLastCalledWith(9n);
    });

    it("keeps an explicit id when ?pilgrim= changes alongside ?id=", () => {
      mk.p.mockReturnValue({ get: (k: string) => (k === "id" ? "5" : null) });
      mk.bs.mockReturnValue({ data: { bookings: [{ ...baseBooking, id: 1n }] } });
      const { rerender } = render(<JamaahPage />);
      mk.p.mockReturnValue({ get: (k: string) => (k === "id" ? "5" : k === "pilgrim" ? AGENCY : null) });
      rerender(<JamaahPage />);
      expect(mk.b).toHaveBeenLastCalledWith(5n);
    });

    it("follows a new ?id= param", () => {
      mk.p.mockReturnValue({ get: (k: string) => (k === "id" ? "3" : null) });
      const { rerender } = render(<JamaahPage />);
      expect(mk.b).toHaveBeenLastCalledWith(3n);
      mk.p.mockReturnValue({ get: (k: string) => (k === "id" ? "4" : null) });
      rerender(<JamaahPage />);
      expect(mk.b).toHaveBeenLastCalledWith(4n);
    });
  });

  describe("booking tab chips and titles", () => {
    const withTab = (patch: object) => {
      mk.bs.mockReturnValue({ data: { bookings: [{ ...baseBooking, ...patch }] } });
      render(<JamaahPage />);
    };

    it("shows the refund chip only while money remains", () => {
      withTab({ refundable: true });
      expect(screen.getByText("Bisa refund")).toBeTruthy();
    });

    it("skips the refund chip when refundable but nothing remains", () => {
      withTab({ refundable: true, remaining: [0n, 0n, 0n, 0n] });
      expect(screen.queryByText("Bisa refund")).toBeNull();
      expect(screen.getByText("Batas tiket 10d")).toBeTruthy();
    });

    it("shows the paid chip when a flight vendor was paid", () => {
      withTab({ flightVendor: VENDOR });
      expect(screen.getByText("Tiket lunas")).toBeTruthy();
    });

    it("shows the ticket countdown otherwise", () => {
      withTab({});
      expect(screen.getByText("Batas tiket 10d")).toBeTruthy();
    });

    it("labels a tab by its booking label first, then by pilgrim label", () => {
      (getLabel as any).mockImplementation((k: string) => (k.startsWith("0x0") ? "ByBooking" : null));
      withTab({});
      expect(screen.getAllByText("ByBooking").length).toBeGreaterThan(0);
    });

    it("labels a tab by the pilgrim label when the booking has none", () => {
      (getLabel as any).mockImplementation((k: string) => (k === ADDR ? "ByPilgrim" : null));
      withTab({});
      expect(screen.getAllByText("ByPilgrim").length).toBeGreaterThan(0);
    });

    it("puts the booking name in the page title when the selected booking is labelled", () => {
      (getLabel as any).mockImplementation((k: string) => (k === ADDR ? "Siti" : null));
      mk.b.mockReturnValue({ data: baseBooking });
      mk.p.mockReturnValue({ get: (k: string) => (k === "id" ? "1" : null) });
      render(<JamaahPage />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName("Buku Amanah Siti");
    });

    it("uses the plain title when the selected booking has no label", () => {
      mk.b.mockReturnValue({ data: baseBooking });
      mk.p.mockReturnValue({ get: (k: string) => (k === "id" ? "1" : null) });
      render(<JamaahPage />);
      expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName("Buku Amanah Jamaah");
    });
  });

  describe("passbook panel", () => {
    it("asks to pick or create a booking when nothing is selected", () => {
      render(<JamaahPage />);
      expect(screen.getByTestId("bi").textContent).toBe("Pilih atau buat booking.");
    });

    it("says the booking was not found when the selected id resolves to null", () => {
      mk.p.mockReturnValue({ get: (k: string) => (k === "id" ? "99" : null) });
      mk.b.mockReturnValue({ data: null });
      render(<JamaahPage />);
      expect(screen.getByTestId("bi").textContent).toBe("Booking tidak ditemukan.");
    });

    it("keeps the pick prompt while the selected booking is still loading", () => {
      mk.p.mockReturnValue({ get: (k: string) => (k === "id" ? "99" : null) });
      mk.b.mockReturnValue({ data: undefined });
      render(<JamaahPage />);
      expect(screen.getByTestId("bi").textContent).toBe("Pilih atau buat booking.");
    });
  });
});

describe("app/app/jamaah/page.tsx — ID/EN", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const setup = () => {
    (useRouter as any).mockReturnValue({ push: vi.fn(), refresh: vi.fn() });
    (useSearchParams as any).mockReturnValue({ get: vi.fn(() => null) });
    (useAccount as any).mockReturnValue({ address: undefined });
    (useWalletClient as any).mockReturnValue({ data: undefined });
    (useChainNow as any).mockReturnValue({ now: 1704067200 });
    (useMabrurContracts as any).mockReturnValue({
      pbm: undefined,
      tidr: undefined,
      publicClient: undefined,
      chainId: 31337,
    });
    (useMabrurTx as any).mockReturnValue({ run: vi.fn(), busy: false });
    (useScaffoldReadContract as any).mockReturnValue({ data: undefined });
    (useScaffoldWriteContract as any).mockReturnValue({ writeContractAsync: vi.fn(), isMining: false });
    (useBooking as any).mockReturnValue({ data: undefined });
    (useBookingsOf as any).mockReturnValue({ data: { bookings: [] } });
  };

  it("ID mode: Indonesian title, labels and attributes", () => {
    setup();
    render(<JamaahPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName("Buku Amanah Jamaah");
    expect(screen.getByPlaceholderText("Nama (disimpan di browser ini saja)")).toBeInTheDocument();
    expect(screen.getByLabelText("Alamat agen")).toBeInTheDocument();
    expect(screen.getByText("tIDR = token uji, tanpa nilai")).toBeVisible();
  });

  it("EN mode: English title, labels and attributes; tIDR disclaimer still visible", () => {
    document.documentElement.classList.add("lang-en");
    setup();
    render(<JamaahPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAccessibleName("Pilgrim's passbook");
    expect(screen.getByRole("heading", { level: 2 })).toHaveAccessibleName("Book an umrah package");
    expect(screen.getByPlaceholderText("Name (kept in this browser only)")).toBeInTheDocument();
    expect(screen.getByLabelText("Agency address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(screen.getByText("tIDR = test token, no value")).toBeVisible();
    expect(screen.getByText("tIDR = token uji, tanpa nilai")).not.toBeVisible();
  });

  it("switching language after render updates attributes", async () => {
    setup();
    render(<JamaahPage />);
    expect(screen.getByLabelText("Batas tiket")).toBeInTheDocument();
    act(() => document.documentElement.classList.add("lang-en"));
    expect(await screen.findByLabelText("Ticket-by date")).toBeInTheDocument();
  });
});
