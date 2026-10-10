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
  /** English label, when the source gave one (the sample file does); the UI falls back to `label`. */
  labelEn?: string;
};

/** A pasted / uploaded invoice file that is not acceptable. The message is shown to the user. */
export class InvoiceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceParseError";
  }
}

/** UTF-8 byte length of a string (an invoice ref must fit bytes32). */
export const utf8Length = (s: string) => new TextEncoder().encode(s).length;

/** "INV-GSA-0001" → bytes32 (right-padded UTF-8), or pass a 0x bytes32 through. Throws when the text exceeds 32 bytes. */
export const refToBytes32 = (ref: string): Hex => {
  if (isHex(ref) && ref.length === 66) return ref;
  const n = utf8Length(ref);
  if (n > 32) throw new InvoiceParseError(`ref is ${n} bytes (UTF-8); at most 32 fit bytes32`);
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

/** Upload / paste limits: an invoice file is a few KB; anything bigger is a mistake (or an attack on the tab). */
export const MAX_INVOICE_FILE_BYTES = 256 * 1024;
export const MAX_INVOICES = 50;

const LINE_NAMES: Record<string, number> = { FLIGHT: 0, HOTEL: 1, VISA: 2, MARGIN: 3 };
const MAX_UINT256 = (1n << 256n) - 1n;
const MAX_UINT64 = (1n << 64n) - 1n;

/**
 * An unsigned integer field. JSON numbers are accepted only up to Number.MAX_SAFE_INTEGER (bigger ones have
 * already lost precision in JSON.parse — send them as strings); strings must be decimal or 0x-hex digits only.
 */
export const toBig = (v: unknown, field: string, max: bigint = MAX_UINT256): bigint => {
  let out: bigint;
  if (typeof v === "bigint") out = v;
  else if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new InvoiceParseError(`${field} must be an integer`);
    if (!Number.isSafeInteger(v))
      throw new InvoiceParseError(`${field} is too large for a JSON number; send it as a string`);
    out = BigInt(v);
  } else if (typeof v === "string") {
    const t = v.trim();
    if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(t)) throw new InvoiceParseError(`${field} must be an unsigned integer`);
    out = BigInt(t);
  } else throw new InvoiceParseError(`${field} is missing`);
  if (out < 0n) throw new InvoiceParseError(`${field} must not be negative`);
  if (out > max) throw new InvoiceParseError(`${field} is out of range`);
  return out;
};

/** Invoice line: 0..3 as an integer (or its digit / name, e.g. "HOTEL"). Anything else is rejected, never defaulted. */
export const toLine = (v: unknown): number => {
  if (typeof v === "string") {
    const t = v.trim().toUpperCase();
    if (t in LINE_NAMES) return LINE_NAMES[t];
    if (/^[0-3]$/.test(t)) return Number(t);
  } else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 3) return v;
  throw new InvoiceParseError(`line must be an integer 0..3 (got ${JSON.stringify(v) ?? String(v)})`);
};

const SIG_KEYS = ["signature", "sig", "vendorSig"] as const;
const FIELD_KEYS = ["bookingId", "line", "amount"] as const;

const isObj = (v: unknown): v is Record<string, any> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** True when a node claims to be an invoice: it carries a signature or any core invoice field. */
const looksLikeInvoice = (raw: Record<string, any>) => {
  const inv = isObj(raw.invoice) ? raw.invoice : isObj(raw.message) ? raw.message : raw;
  return SIG_KEYS.some(k => k in raw) || FIELD_KEYS.some(k => k in inv);
};

/** One invoice node → SignedInvoice; undefined when the node is not an invoice at all; throws when it is a broken one. */
const normalizeOne = (raw: unknown, keyHint?: string): SignedInvoice | undefined => {
  if (!isObj(raw) || !looksLikeInvoice(raw)) return undefined;
  const inv = isObj(raw.invoice) ? raw.invoice : isObj(raw.message) ? raw.message : raw;
  const where = keyHint ? ` (${keyHint})` : "";
  const signature = raw.signature ?? raw.sig ?? raw.vendorSig;
  if (typeof signature !== "string" || !isHex(signature) || (signature.length !== 132 && signature.length !== 130))
    throw new InvoiceParseError(`signature missing or not a 64/65-byte hex string${where}`);
  for (const k of FIELD_KEYS)
    if (inv[k] === undefined || inv[k] === null || inv[k] === "")
      throw new InvoiceParseError(`incomplete invoice${where}: ${k} is missing`);
  const line = toLine(inv.line);
  const refStr: string = String(inv.ref ?? raw.ref ?? keyHint ?? "");
  const ref = refToBytes32(refStr || "0x" + "0".repeat(64));
  return {
    invoice: {
      bookingId: toBig(inv.bookingId, `bookingId${where}`),
      line,
      amount: toBig(inv.amount, `amount${where}`),
      ref,
      expiry: toBig(inv.expiry ?? 0, `expiry${where}`, MAX_UINT64),
    },
    signature: signature as Hex,
    refLabel: raw.refLabel ?? raw.refString ?? (isHex(refStr) ? refToLabel(ref) : refStr),
    signer: raw.signer,
    label: raw.label ?? raw.name ?? keyHint,
    ...(typeof raw.labelEn === "string" ? { labelEn: raw.labelEn } : {}),
  };
};

/**
 * Accepts the vendor page's output, script/out/invoices.json, or any of:
 * one object, an array, or an object keyed by ref (`{ "INV-GSA-0001": {...} }`), with the invoice fields either flat
 * or under `invoice` / `message`, and the signature under `signature` / `sig` / `vendorSig`.
 * Throws InvoiceParseError (or SyntaxError for bad JSON) on empty, oversized, partial or out-of-range input.
 */
export const parseInvoices = (text: string): SignedInvoice[] => {
  if (!text || !text.trim()) throw new InvoiceParseError("empty input");
  if (utf8Length(text) > MAX_INVOICE_FILE_BYTES)
    throw new InvoiceParseError(`file larger than ${MAX_INVOICE_FILE_BYTES / 1024} KB`);
  const json = JSON.parse(text);
  const out: SignedInvoice[] = [];
  const visit = (node: any, key?: string, depth = 0) => {
    if (depth > 3 || !node || typeof node !== "object") return;
    const one = normalizeOne(node, key);
    if (one) {
      out.push(one);
      if (out.length > MAX_INVOICES) throw new InvoiceParseError(`more than ${MAX_INVOICES} invoices`);
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
