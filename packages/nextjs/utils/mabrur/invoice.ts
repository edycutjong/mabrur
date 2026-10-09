import { Address, Hex, hexToString, isHex, stringToHex } from "viem";

export const PBM_DOMAIN_NAME = "Mabrur Umrah Prepayment";
export const PBM_DOMAIN_VERSION = "1";

export const INVOICE_TYPES = {
  Invoice: [
    { name: "bookingId", type: "uint256" },
    { name: "line", type: "uint8" },
    { name: "amount", type: "uint256" },
    { name: "ref", type: "bytes32" },
    { name: "expiry", type: "uint64" },
  ],
} as const;

export const DEPARTURE_TYPES = {
  Departure: [{ name: "bookingId", type: "uint256" }],
} as const;

export const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const pbmDomain = (chainId: number, verifyingContract: Address) => ({
  name: PBM_DOMAIN_NAME,
  version: PBM_DOMAIN_VERSION,
  chainId,
  verifyingContract,
});

export type Invoice = {
  bookingId: bigint;
  line: number;
  amount: bigint;
  ref: Hex;
  expiry: bigint;
};

export type SignedInvoice = {
  invoice: Invoice;
  signature: Hex;
  /** human-readable ref, when the source gave one */
  refLabel?: string;
  signer?: Address;
  label?: string;
};

/** "INV-GSA-0001" → bytes32 (right-padded UTF-8), or pass a 0x bytes32 through. */
export const refToBytes32 = (ref: string): Hex => {
  if (isHex(ref) && ref.length === 66) return ref;
  return stringToHex(ref, { size: 32 });
};

export const refToLabel = (ref: Hex): string => {
  try {
    const s = hexToString(ref, { size: 32 }).replace(/\0+$/g, "");
    return /^[\x20-\x7e]+$/.test(s) ? s : `${ref.slice(0, 10)}…`;
  } catch {
    return `${ref.slice(0, 10)}…`;
  }
};

const LINE_NAMES: Record<string, number> = { FLIGHT: 0, HOTEL: 1, VISA: 2, MARGIN: 3 };

const toBig = (v: unknown): bigint => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string" && v.trim() !== "") return BigInt(v.trim());
  throw new Error("missing number");
};

const normalizeOne = (raw: any, keyHint?: string): SignedInvoice | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  const inv = raw.invoice ?? raw.message ?? raw;
  const signature = (raw.signature ?? raw.sig ?? raw.vendorSig) as Hex | undefined;
  if (!signature || !isHex(signature)) return undefined;
  if (inv.bookingId === undefined || inv.line === undefined || inv.amount === undefined) return undefined;
  const lineRaw = inv.line;
  const line =
    typeof lineRaw === "string" && lineRaw.toUpperCase() in LINE_NAMES
      ? LINE_NAMES[lineRaw.toUpperCase()]
      : Number(lineRaw);
  const refStr: string = String(inv.ref ?? raw.ref ?? keyHint ?? "");
  const ref = refToBytes32(refStr || "0x" + "0".repeat(64));
  return {
    invoice: {
      bookingId: toBig(inv.bookingId),
      line,
      amount: toBig(inv.amount),
      ref,
      expiry: toBig(inv.expiry ?? 0),
    },
    signature,
    refLabel: raw.refLabel ?? raw.refString ?? (isHex(refStr) ? refToLabel(ref) : refStr),
    signer: raw.signer,
    label: raw.label ?? raw.name ?? keyHint,
  };
};

/**
 * Accepts the vendor page's output, script/out/invoices.json, or any of:
 * one object, an array, or an object keyed by ref (`{ "INV-GSA-0001": {...} }`), with the invoice fields either flat
 * or under `invoice` / `message`, and the signature under `signature` / `sig` / `vendorSig`.
 */
export const parseInvoices = (text: string): SignedInvoice[] => {
  const json = JSON.parse(text);
  const out: SignedInvoice[] = [];
  const visit = (node: any, key?: string, depth = 0) => {
    if (depth > 3 || !node || typeof node !== "object") return;
    const one = normalizeOne(node, key);
    if (one) {
      out.push(one);
      return;
    }
    if (Array.isArray(node)) node.forEach(n => visit(n, undefined, depth + 1));
    else Object.entries(node).forEach(([k, v]) => visit(v, k, depth + 1));
  };
  visit(json);
  return out;
};

export const invoiceToJson = (s: SignedInvoice, extra: Record<string, unknown> = {}) =>
  JSON.stringify(
    {
      refLabel: s.refLabel,
      invoice: {
        bookingId: `0x${s.invoice.bookingId.toString(16).padStart(64, "0")}`,
        line: s.invoice.line,
        amount: s.invoice.amount.toString(),
        ref: s.invoice.ref,
        expiry: s.invoice.expiry.toString(),
      },
      signature: s.signature,
      signer: s.signer,
      ...extra,
    },
    null,
    2,
  );
