import type { AbiError } from "abitype";
import { Abi, BaseError, ContractFunctionRevertedError, Hex, decodeErrorResult } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";

/** Human reasons for every custom error the three contracts (and their OZ bases) can raise. Error names are never translated. */
export const REVERT_REASONS: Record<string, { id: string; en: string }> = {
  // MabrurPBM
  EarmarkMismatch: {
    id: "Faktur untuk booking lain — dana jamaah ini tidak bisa membayarnya",
    en: "Invoice is for another booking",
  },
  VendorClaimMissing: {
    id: "Penanda tangan faktur bukan vendor berlisensi untuk pos ini",
    en: "Invoice signer is not a licensed vendor for this line",
  },
  NotDeparted: {
    id: "Jamaah belum berangkat — ujrah belum terbuka",
    en: "Pilgrim has not departed — the fee is still locked",
  },
  LineExceeded: { id: "Melebihi sisa pos ini", en: "Exceeds what is left on this line" },
  DeadlinePassed: {
    id: "Batas tiket atau batas berangkat sudah lewat — dana hanya bisa dikembalikan",
    en: "Deadline passed — funds can only be refunded",
  },
  InvoiceExpired: { id: "Faktur kedaluwarsa", en: "Invoice expired" },
  InvoiceReplayed: { id: "Faktur sudah pernah dipakai", en: "Invoice already used" },
  SelfDealing: { id: "Agen tidak boleh membayar dirinya sendiri", en: "The agency cannot pay itself" },
  FlightAlreadyPurchased: { id: "Tiket pesawat sudah dibeli", en: "Flight ticket already purchased" },
  FlightNotFullyPaid: {
    id: "Faktur tiket harus melunasi seluruh pos tiket pesawat",
    en: "A flight invoice must pay the whole flight line",
  },
  UseReleaseMargin: { id: "Ujrah tidak dibayar lewat faktur", en: "The fee is not paid by invoice" },
  AgencyNotLicensed: { id: "Agen tidak berizin PPIU", en: "Agency has no valid PPIU licence claim" },
  NotYetRefundable: { id: "Belum lewat batas tiket atau batas berangkat", en: "Not refundable yet" },
  NothingToRefund: { id: "Tidak ada sisa dana", en: "Nothing left to refund" },
  NonTransferable: { id: "Dana amanah tidak bisa dipindah", en: "Prepayment claims are non-transferable" },
  DirectWithdrawDisabled: { id: "Tidak bisa ditarik langsung", en: "Direct withdrawal disabled" },
  DirectDepositDisabled: { id: "Setoran harus lewat pemesanan", en: "Deposits only through booking" },
  BadSignature: { id: "Tanda tangan tidak sah", en: "Invalid signature" },
  NotBookingAgency: { id: "Bukan agen booking ini", en: "Caller is not this booking's agency" },
  MarginAlreadyReleased: {
    id: "Ujrah sudah dibayar (atau booking sudah dikembalikan)",
    en: "Fee already released (or booking refunded)",
  },
  InvalidSplit: {
    id: "Isian tidak sah — total harus > 0 dan ujrah ≤ 20%",
    en: "Invalid split — total > 0 and fee ≤ 20%",
  },
  InvalidDepartBy: {
    id: "Isian tidak sah — batas berangkat harus di masa depan, ≤ 180 hari",
    en: "Invalid depart-by — future, within 180 days",
  },
  InvalidTicketBy: {
    id: "Isian tidak sah — batas tiket harus di masa depan, ≤ batas berangkat",
    en: "Invalid ticket-by — future, not after depart-by",
  },
  InvalidLine: { id: "Isian tidak sah — pos tidak dikenal", en: "Invalid line" },
  ZeroAmount: { id: "Isian tidak sah — jumlah nol", en: "Zero amount" },
  // OZ (inherited)
  ERC20InsufficientBalance: {
    id: "Saldo tIDR tidak cukup — ambil tIDR uji dulu",
    en: "Not enough tIDR — use the test faucet first",
  },
  ERC20InsufficientAllowance: {
    id: "Izin pembayaran (permit) belum cukup — tanda tangani ulang",
    en: "Permit allowance missing — sign again",
  },
  ERC2612ExpiredSignature: { id: "Permit kedaluwarsa — tanda tangani ulang", en: "Permit expired — sign again" },
  ERC2612InvalidSigner: { id: "Permit tidak sah — tanda tangani ulang", en: "Invalid permit signer" },
  SafeERC20FailedOperation: { id: "Transfer tIDR gagal", en: "tIDR transfer failed" },
  ReentrancyGuardReentrantCall: { id: "Panggilan berulang ditolak", en: "Reentrant call" },
  // tIDR
  FaucetLimitReached: {
    id: "Batas faucet harian tercapai (100× per alamat per hari UTC)",
    en: "Daily faucet limit reached",
  },
  // ClaimRegistry
  NotRegistryOwner: { id: "Bukan pemilik registri (regulator)", en: "Not the registry owner (regulator)" },
  IssuerNotTrustedForTopic: {
    id: "Penerbit tidak dipercaya untuk klaim ini",
    en: "Issuer not trusted for this claim topic",
  },
  NotClaimIssuer: { id: "Bukan penerbit klaim ini", en: "Not this claim's issuer" },
  InvalidExpiry: { id: "Masa berlaku tidak sah", en: "Invalid expiry" },
  UnknownTopic: { id: "Jenis klaim tidak dikenal", en: "Unknown claim topic" },
};

/** Every error entry from every deployed contract on every chain, so bubbled reverts (e.g. tIDR inside the PBM) decode. */
const ALL_ERRORS: Abi = (() => {
  const seen = new Set<string>();
  const out: AbiError[] = [];
  for (const chain of Object.values(deployedContracts as Record<string, Record<string, { abi: Abi }>>)) {
    for (const c of Object.values(chain)) {
      for (const item of c.abi) {
        if (item.type !== "error") continue;
        const key = `${item.name}(${item.inputs.map(i => i.type).join(",")})`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
      }
    }
  }
  return out;
})();

export type DecodedRevert = {
  name: string;
  args: readonly unknown[];
  argNames: string[];
  id: string;
  en: string;
  /** true when this was a real on-chain revert (vs. user rejection / network) */
  isRevert: boolean;
};

const findRawData = (e: unknown): Hex | undefined => {
  let cur: any = e;
  for (let i = 0; i < 10 && cur; i++) {
    const d = cur.data;
    if (typeof d === "string" && d.startsWith("0x") && d.length >= 10) return d as Hex;
    if (d && typeof d.data === "string" && d.data.startsWith("0x")) return d.data as Hex;
    cur = cur.cause;
  }
  return undefined;
};

export const decodeRevert = (e: unknown): DecodedRevert => {
  const base = e instanceof BaseError ? e : undefined;
  const reverted = base?.walk(err => err instanceof ContractFunctionRevertedError) as
    | ContractFunctionRevertedError
    | undefined;

  let name: string | undefined;
  let args: readonly unknown[] = [];
  let argNames: string[] = [];

  if (reverted?.data?.errorName && reverted.data.errorName !== "Error") {
    name = reverted.data.errorName;
    args = reverted.data.args ?? [];
    argNames = (reverted.data.abiItem as AbiError | undefined)?.inputs?.map(i => i.name ?? "") ?? [];
  }
  if (!name) {
    const raw = (reverted?.raw as Hex | undefined) ?? findRawData(e);
    if (raw) {
      try {
        const d = decodeErrorResult({ abi: ALL_ERRORS, data: raw });
        name = d.errorName;
        args = d.args ?? [];
        argNames = (d.abiItem as AbiError).inputs.map(i => i.name ?? "");
      } catch {
        name = `Unknown(${raw.slice(0, 10)})`;
      }
    }
  }
  if (name === "Error" || (!name && reverted?.reason)) {
    return {
      name: "Error",
      args: [reverted?.reason],
      argNames: ["reason"],
      id: reverted?.reason ?? "Ditolak",
      en: reverted?.reason ?? "Reverted",
      isRevert: true,
    };
  }
  if (name) {
    const r = REVERT_REASONS[name] ?? { id: "Ditolak oleh kontrak", en: "Rejected by the contract" };
    return { name, args, argNames, ...r, isRevert: true };
  }
  const msg = (base?.shortMessage ?? (e as Error)?.message ?? "Unknown error").split("\n")[0];
  const rejected = /reject|denied/i.test(msg);
  return {
    name: rejected ? "UserRejected" : "Error",
    args: [],
    argNames: [],
    id: rejected ? "Dibatalkan di dompet" : msg,
    en: rejected ? "Rejected in the wallet" : msg,
    isRevert: false,
  };
};

/** "EarmarkMismatch(0x3f2a…, 0x91bc…)" — uint256 ids are shown as shortened hex. */
export const formatErrorCall = (d: DecodedRevert): string => {
  const fmt = (v: unknown): string => {
    if (typeof v === "bigint") {
      if (v > 10n ** 15n) {
        const h = `0x${v.toString(16)}`;
        return `${h.slice(0, 6)}…${h.slice(-4)}`;
      }
      return v.toString();
    }
    if (typeof v === "string" && v.startsWith("0x") && v.length > 14) return `${v.slice(0, 6)}…${v.slice(-4)}`;
    return String(v);
  };
  return `${d.name}(${d.args.map(fmt).join(", ")})`;
};
