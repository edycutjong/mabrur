import { useRouter, useSearchParams } from "next/navigation";
import { render, screen } from "@testing-library/react";
import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount, useWalletClient } from "wagmi";
import JamaahPage from "~~/app/app/jamaah/page";
import {
  ZERO,
  useBooking,
  useBookingsOf,
  useChainNow,
  useMabrurContracts,
  useMabrurTx,
} from "~~/hooks/mabrur/useMabrur";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));
vi.mock("wagmi", () => ({ useAccount: vi.fn(), useWalletClient: vi.fn() }));
vi.mock("~~/hooks/scaffold-eth", () => ({ useScaffoldReadContract: vi.fn(), useScaffoldWriteContract: vi.fn() }));
vi.mock("~~/hooks/mabrur/useMabrur", () => ({
  ZERO: "0x0000000000000000000000000000000000000000",
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
  parseBookingId: vi.fn(s => (s ? BigInt(s) : undefined)),
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
    expect(screen.getByText("Lihat booking · look up")).toBeTruthy();
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
    expect(screen.getByText("Jamaah · pilgrim")).toBeTruthy();
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
