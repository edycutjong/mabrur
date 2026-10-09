import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  InvoiceParseError,
  MAX_INVOICES,
  MAX_INVOICE_FILE_BYTES,
  parseInvoices,
  refToBytes32,
  toBig,
  toLine,
} from "~~/utils/mabrur/invoice";

const SIG = `0x${"ab".repeat(65)}`;
const ok = (over: Record<string, unknown> = {}) => ({
  invoice: { bookingId: "123", line: 1, amount: "9000000", ref: "INV-HTL-0001", expiry: "1796703750", ...over },
  signature: SIG,
});
const parse = (v: unknown) => parseInvoices(JSON.stringify(v));

describe("parseInvoices — accepts", () => {
  it("the vendor page's own output", () => {
    const [inv] = parse(ok());
    expect(inv.invoice).toMatchObject({ bookingId: 123n, line: 1, amount: 9_000_000n, expiry: 1_796_703_750n });
    expect(inv.refLabel).toBe("INV-HTL-0001");
  });

  it("line names and digit strings", () => {
    expect(parse(ok({ line: "visa" }))[0].invoice.line).toBe(2);
    expect(parse(ok({ line: "3" }))[0].invoice.line).toBe(3);
  });

  it("0x-hex and max-uint256 strings", () => {
    const max = ((1n << 256n) - 1n).toString();
    expect(parse(ok({ bookingId: `0x${"f".repeat(64)}`, amount: max }))[0].invoice.amount).toBe((1n << 256n) - 1n);
  });

  it("a real SeedDemo invoices.json (committed fixture), metadata keys ignored", () => {
    // fixture = SeedDemo.s.sol output on Arbitrum One: 5 signed invoices + booking/agency metadata (all public)
    const file = path.resolve(process.cwd(), "test/fixtures/invoices.seed.json");
    const list = parseInvoices(fs.readFileSync(file, "utf8"));
    expect(list).toHaveLength(5);
    expect(list.map(i => i.invoice.line).sort()).toEqual([0, 1, 1, 1, 2]);
  });
});

describe("parseInvoices — rejects", () => {
  const bad = (v: unknown, msg: RegExp) => expect(() => parse(v)).toThrow(msg);

  it("empty input", () => {
    expect(() => parseInvoices("")).toThrow(InvoiceParseError);
    expect(() => parseInvoices("   \n")).toThrow(/empty/);
  });

  it("a line outside 0..3 or not an integer", () => {
    bad(ok({ line: 4 }), /line must be an integer 0\.\.3/);
    bad(ok({ line: -1 }), /line/);
    bad(ok({ line: 1.5 }), /line/);
    bad(ok({ line: "LODGING" }), /line/);
    bad(ok({ line: true }), /line/);
  });

  it("JSON-number amounts / ids above Number.MAX_SAFE_INTEGER", () => {
    expect(() =>
      parseInvoices(`{"invoice":{"bookingId":1,"line":1,"amount":9007199254740993},"signature":"${SIG}"}`),
    ).toThrow(/send it as a string/);
    bad(ok({ bookingId: 2 ** 60 }), /bookingId.*string/);
  });

  it("negatives, fractions, junk strings and values above 2^256-1", () => {
    bad(ok({ amount: -1 }), /amount/);
    bad(ok({ amount: "-5" }), /amount/);
    bad(ok({ amount: 1.5 }), /amount must be an integer/);
    bad(ok({ amount: "12abc" }), /amount/);
    bad(ok({ amount: (1n << 256n).toString() }), /amount is out of range/);
    bad(ok({ expiry: (1n << 64n).toString() }), /expiry is out of range/);
  });

  it("partial invoices instead of skipping them", () => {
    bad({ invoice: { bookingId: "1", line: 1 }, signature: SIG }, /amount is missing/);
    bad({ invoice: { bookingId: "1", line: 1, amount: "" }, signature: SIG }, /amount is missing/);
    bad({ invoice: { bookingId: "1", line: 1, amount: "5" } }, /signature/);
    bad({ ...ok(), signature: "0x1234" }, /signature/);
    bad({ hotel: { bookingId: "1", amount: "5", signature: SIG } }, /\(hotel\): line is missing/);
  });

  it("a ref longer than 32 UTF-8 bytes", () => {
    bad(ok({ ref: "INV-" + "é".repeat(15) }), /bytes/);
  });

  it("a file over the size cap", () => {
    const big = JSON.stringify({ pad: "x".repeat(MAX_INVOICE_FILE_BYTES), ...ok() });
    expect(() => parseInvoices(big)).toThrow(/KB/);
  });

  it(`more than ${MAX_INVOICES} invoices`, () => {
    expect(parse(Array.from({ length: MAX_INVOICES }, () => ok()))).toHaveLength(MAX_INVOICES);
    bad(
      Array.from({ length: MAX_INVOICES + 1 }, () => ok()),
      /more than 50/,
    );
  });
});

describe("helpers", () => {
  it("toBig / toLine / refToBytes32", () => {
    expect(toBig(5n, "x")).toBe(5n);
    expect(() => toBig(-1n, "x")).toThrow(/negative/);
    expect(() => toBig(undefined, "x")).toThrow(/missing/);
    expect(toLine("flight")).toBe(0);
    expect(refToBytes32("A".repeat(32))).toHaveLength(66);
    expect(() => refToBytes32("A".repeat(33))).toThrow(InvoiceParseError);
    const hex = `0x${"00".repeat(32)}` as const;
    expect(refToBytes32(hex)).toBe(hex);
  });
});
