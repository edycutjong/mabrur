import { isHex, stringToHex } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
  DEPARTURE_TYPES,
  INVOICE_TYPES,
  Invoice,
  InvoiceParseError,
  PBM_DOMAIN_NAME,
  PBM_DOMAIN_VERSION,
  PERMIT_TYPES,
  SignedInvoice,
  invoiceToJson,
  parseInvoices,
  pbmDomain,
  refToBytes32,
  refToLabel,
  toLine,
  utf8Length,
} from "~~/utils/mabrur/invoice";

// Mock viem functions where needed - for the error path in refToLabel
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return actual;
});

describe("refToLabel", () => {
  it("converts a valid printable ASCII hex string to its text representation", () => {
    // Create a hex ref from "INV-001"
    const ref = stringToHex("INV-001", { size: 32 });
    const label = refToLabel(ref);
    expect(label).toBe("INV-001");
  });

  it("returns abbreviated hex when string contains non-printable characters", () => {
    // Create a hex with non-printable chars by encoding binary data
    const ref = `0x${"01".repeat(32)}` as const;
    const label = refToLabel(ref);
    expect(label).toBe("0x01010101…");
  });

  it("returns abbreviated hex when hexToString throws an error", () => {
    // A malformed hex string that will cause hexToString to fail
    // Using an invalid hex that's 66 chars (valid length) but with invalid content
    const ref = `0x${"0g".repeat(32)}` as any; // "g" is not hex but same length
    const label = refToLabel(ref);
    // Should fall back to abbreviated hex
    expect(label).toMatch(/^0x.+…$/);
  });

  it("strips trailing null bytes from decoded string", () => {
    // stringToHex right-pads with zeros, so we test the reverse
    const ref = stringToHex("TEST", { size: 32 });
    const label = refToLabel(ref);
    expect(label).toBe("TEST");
  });

  it("handles edge case: very short printable string with padding", () => {
    const ref = stringToHex("A", { size: 32 });
    const label = refToLabel(ref);
    expect(label).toBe("A");
  });

  it("handles hex refs that decode to empty string (all zeros)", () => {
    const ref = `0x${"00".repeat(32)}` as const;
    const label = refToLabel(ref);
    expect(label).toBe("0x00000000…");
  });

  it("handles printable ASCII range boundary characters", () => {
    // Test the regex boundary: \x20 (space) to \x7e (~)
    const ref = stringToHex(" ~", { size: 32 }); // space (0x20) and tilde (0x7e)
    const label = refToLabel(ref);
    expect(label).toBe(" ~");
  });

  it("rejects strings with characters just outside printable ASCII range", () => {
    // \x1f (just below space) is not printable
    const ref = `0x1f${"00".repeat(31)}` as const;
    const label = refToLabel(ref);
    expect(label).toMatch(/^0x.+…$/);
  });
});

describe("invoiceToJson", () => {
  it("serializes a complete SignedInvoice to formatted JSON", () => {
    const invoice: Invoice = {
      bookingId: 123n,
      line: 1,
      amount: 9_000_000n,
      ref: stringToHex("INV-HTL-0001", { size: 32 }),
      expiry: 1_796_703_750n,
    };
    const signed: SignedInvoice = {
      invoice,
      signature: `0x${"ab".repeat(65)}`,
      refLabel: "INV-HTL-0001",
      signer: "0x1234567890123456789012345678901234567890",
      label: "Hotel",
    };

    const json = invoiceToJson(signed);
    const parsed = JSON.parse(json);

    expect(parsed.refLabel).toBe("INV-HTL-0001");
    expect(parsed.invoice.bookingId).toBe("0x000000000000000000000000000000000000000000000000000000000000007b");
    expect(parsed.invoice.line).toBe(1);
    expect(parsed.invoice.amount).toBe("9000000");
    expect(parsed.invoice.expiry).toBe("1796703750");
    expect(parsed.signature).toBe(`0x${"ab".repeat(65)}`);
    expect(parsed.signer).toBe("0x1234567890123456789012345678901234567890");
  });

  it("uses 2-space indentation in JSON output", () => {
    const invoice: Invoice = {
      bookingId: 1n,
      line: 0,
      amount: 1000n,
      ref: stringToHex("INV", { size: 32 }),
      expiry: 0n,
    };
    const signed: SignedInvoice = {
      invoice,
      signature: `0x${"00".repeat(65)}`,
    };

    const json = invoiceToJson(signed);
    expect(json).toContain("\n  ");
  });

  it("includes extra fields when provided", () => {
    const invoice: Invoice = {
      bookingId: 1n,
      line: 0,
      amount: 1000n,
      ref: stringToHex("INV", { size: 32 }),
      expiry: 0n,
    };
    const signed: SignedInvoice = {
      invoice,
      signature: `0x${"00".repeat(65)}`,
    };
    const extra = { customField: "custom value", id: 42 };

    const json = invoiceToJson(signed, extra);
    const parsed = JSON.parse(json);

    expect(parsed.customField).toBe("custom value");
    expect(parsed.id).toBe(42);
  });

  it("pads bookingId to 64 hex digits", () => {
    const invoice: Invoice = {
      bookingId: 1n,
      line: 0,
      amount: 1n,
      ref: `0x${"00".repeat(32)}` as const,
      expiry: 0n,
    };
    const signed: SignedInvoice = {
      invoice,
      signature: `0x${"00".repeat(65)}`,
    };

    const json = invoiceToJson(signed);
    const parsed = JSON.parse(json);

    expect(parsed.invoice.bookingId).toHaveLength(66); // "0x" + 64 chars
    expect(parsed.invoice.bookingId).toBe(`0x${"0".repeat(63)}1`);
  });

  it("handles large bigint values correctly", () => {
    const maxUint256 = (1n << 256n) - 1n;
    const invoice: Invoice = {
      bookingId: maxUint256,
      line: 3,
      amount: maxUint256,
      ref: `0x${"ff".repeat(32)}` as const,
      expiry: (1n << 64n) - 1n,
    };
    const signed: SignedInvoice = {
      invoice,
      signature: `0x${"ff".repeat(65)}`,
    };

    const json = invoiceToJson(signed);
    const parsed = JSON.parse(json);

    expect(parsed.invoice.bookingId).toBe(`0x${"f".repeat(64)}`);
    expect(parsed.invoice.amount).toBe(maxUint256.toString());
  });

  it("preserves optional fields when undefined", () => {
    const invoice: Invoice = {
      bookingId: 1n,
      line: 0,
      amount: 1n,
      ref: `0x${"00".repeat(32)}` as const,
      expiry: 0n,
    };
    const signed: SignedInvoice = {
      invoice,
      signature: `0x${"00".repeat(65)}`,
      // refLabel, signer, label not provided
    };

    const json = invoiceToJson(signed);
    const parsed = JSON.parse(json);

    expect(parsed.refLabel).toBeUndefined();
    expect(parsed.signer).toBeUndefined();
  });

  it("formats all line types correctly", () => {
    for (let line = 0; line < 4; line++) {
      const invoice: Invoice = {
        bookingId: 100n,
        line,
        amount: 5000n,
        ref: stringToHex(`INV-${line}`, { size: 32 }),
        expiry: 0n,
      };
      const signed: SignedInvoice = {
        invoice,
        signature: `0x${"00".repeat(65)}`,
      };

      const json = invoiceToJson(signed);
      const parsed = JSON.parse(json);

      expect(parsed.invoice.line).toBe(line);
    }
  });
});

describe("pbmDomain", () => {
  it("creates a domain object with correct structure", () => {
    const domain = pbmDomain(1, "0x1234567890123456789012345678901234567890");

    expect(domain.name).toBe(PBM_DOMAIN_NAME);
    expect(domain.version).toBe(PBM_DOMAIN_VERSION);
    expect(domain.chainId).toBe(1);
    expect(domain.verifyingContract).toBe("0x1234567890123456789012345678901234567890");
  });

  it("uses correct constants for domain name and version", () => {
    const domain = pbmDomain(11155111, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

    expect(domain.name).toBe("Mabrur Umrah Prepayment");
    expect(domain.version).toBe("1");
  });

  it("preserves different chain IDs", () => {
    const sepolia = pbmDomain(11155111, "0x1111111111111111111111111111111111111111");
    const mainnet = pbmDomain(1, "0x2222222222222222222222222222222222222222");

    expect(sepolia.chainId).toBe(11155111);
    expect(mainnet.chainId).toBe(1);
  });

  it("preserves different contract addresses", () => {
    const addr1 = "0x1111111111111111111111111111111111111111";
    const addr2 = "0x2222222222222222222222222222222222222222";

    const domain1 = pbmDomain(1, addr1);
    const domain2 = pbmDomain(1, addr2);

    expect(domain1.verifyingContract).toBe(addr1);
    expect(domain2.verifyingContract).toBe(addr2);
  });
});

describe("utf8Length", () => {
  it("returns correct byte length for ASCII strings", () => {
    expect(utf8Length("INV-001")).toBe(7);
    expect(utf8Length("A")).toBe(1);
  });

  it("counts multibyte characters correctly", () => {
    // é is 2 bytes in UTF-8
    expect(utf8Length("é")).toBe(2);
  });

  it("handles empty strings", () => {
    expect(utf8Length("")).toBe(0);
  });

  it("handles mixed ASCII and multibyte", () => {
    // I, N, V, -, é = 1+1+1+1+2 = 6
    const result = utf8Length("INV-é");
    expect(result).toBe(6);
  });
});

describe("toLine direct tests", () => {
  it("accepts valid line numbers as integers", () => {
    expect(() => {
      // Implicitly tested via parseInvoices, but let's be explicit
      // Testing the else-if path for numbers
      const input = { invoice: { bookingId: "1", line: 2, amount: "100" }, signature: `0x${"ab".repeat(65)}` };
      parseInvoices(JSON.stringify(input));
    }).not.toThrow();
  });

  it("rejects a number with isInteger false but typeof number true", () => {
    const input = { invoice: { bookingId: "1", line: 2.7, amount: "100" }, signature: `0x${"ab".repeat(65)}` };
    expect(() => parseInvoices(JSON.stringify(input))).toThrow(/line must be an integer 0\.\.3/);
  });

  it("rejects a string that is not a LINE_NAME and not a digit", () => {
    const input = { invoice: { bookingId: "1", line: "unknown", amount: "100" }, signature: `0x${"ab".repeat(65)}` };
    expect(() => parseInvoices(JSON.stringify(input))).toThrow(/line must be an integer 0\.\.3/);
  });

  it("rejects an object type for line field (JSON.stringify fallback)", () => {
    // This tests the ?? operator in the error message on line 119
    // When line is an object, JSON.stringify({...}) works, but we test the error path
    const input = { invoice: { bookingId: "1", line: {}, amount: "100" }, signature: `0x${"ab".repeat(65)}` };
    expect(() => parseInvoices(JSON.stringify(input))).toThrow(/line must be an integer 0\.\.3/);
  });

  it("accepts boundary value 0 for line", () => {
    const input = { invoice: { bookingId: "1", line: 0, amount: "100" }, signature: `0x${"ab".repeat(65)}` };
    const [inv] = parseInvoices(JSON.stringify(input));
    expect(inv.invoice.line).toBe(0);
  });

  it("accepts boundary value 3 for line", () => {
    const input = { invoice: { bookingId: "1", line: 3, amount: "100" }, signature: `0x${"ab".repeat(65)}` };
    const [inv] = parseInvoices(JSON.stringify(input));
    expect(inv.invoice.line).toBe(3);
  });

  it("rejects value -1 for line (below 0 boundary)", () => {
    const input = { invoice: { bookingId: "1", line: -1, amount: "100" }, signature: `0x${"ab".repeat(65)}` };
    expect(() => parseInvoices(JSON.stringify(input))).toThrow(/line must be an integer 0\.\.3/);
  });

  it("calls toLine directly with string line names", () => {
    expect(toLine("FLIGHT")).toBe(0);
    expect(toLine("HOTEL")).toBe(1);
    expect(toLine("VISA")).toBe(2);
    expect(toLine("MARGIN")).toBe(3);
  });

  it("calls toLine directly with string digits", () => {
    expect(toLine("0")).toBe(0);
    expect(toLine("1")).toBe(1);
    expect(toLine("2")).toBe(2);
    expect(toLine("3")).toBe(3);
  });

  it("calls toLine directly with number values", () => {
    expect(toLine(0)).toBe(0);
    expect(toLine(3)).toBe(3);
  });

  it("calls toLine directly and rejects invalid inputs", () => {
    expect(() => toLine("INVALID")).toThrow(/line must be an integer 0\.\.3/);
    expect(() => toLine(5)).toThrow(/line must be an integer 0\.\.3/);
  });

  it("handles strings with leading/trailing whitespace", () => {
    expect(toLine(" FLIGHT ")).toBe(0);
    expect(toLine("\tHOTEL\n")).toBe(1);
    expect(toLine("  1  ")).toBe(1);
  });

  it("handles case-insensitive line names", () => {
    expect(toLine("flight")).toBe(0);
    expect(toLine("hotel")).toBe(1);
    expect(toLine("visa")).toBe(2);
    expect(toLine("margin")).toBe(3);
  });

  it("rejects strings that are invalid", () => {
    expect(() => toLine("")).toThrow(/line must be an integer 0\.\.3/);
    expect(() => toLine("04")).toThrow(/line must be an integer 0\.\.3/);
    expect(() => toLine("NOTANAME")).toThrow(/line must be an integer 0\.\.3/);
  });

  it("rejects non-string, non-number types", () => {
    expect(() => toLine(null as any)).toThrow(/line must be an integer 0\.\.3/);
    expect(() => toLine([])).toThrow(/line must be an integer 0\.\.3/);
    expect(() => toLine(true)).toThrow(/line must be an integer 0\.\.3/);
  });

  it("rejects negative numbers", () => {
    expect(() => toLine(-1)).toThrow(/line must be an integer 0\.\.3/);
    expect(() => toLine(-100)).toThrow(/line must be an integer 0\.\.3/);
  });

  it("rejects positive numbers > 3", () => {
    expect(() => toLine(4)).toThrow(/line must be an integer 0\.\.3/);
    expect(() => toLine(100)).toThrow(/line must be an integer 0\.\.3/);
  });

  it("rejects fractional numbers", () => {
    expect(() => toLine(0.5)).toThrow(/line must be an integer 0\.\.3/);
    expect(() => toLine(3.5)).toThrow(/line must be an integer 0\.\.3/);
  });

  it("accepts all valid integer values 0 through 3", () => {
    for (let i = 0; i <= 3; i++) {
      expect(toLine(i)).toBe(i);
    }
  });

  it("rejects a function (tests JSON.stringify fallback to String())", () => {
    const fn = () => {};
    expect(() => toLine(fn)).toThrow(/line must be an integer 0\.\.3/);
  });

  it("rejects a symbol (tests JSON.stringify fallback to String())", () => {
    const sym = Symbol("test");
    expect(() => toLine(sym)).toThrow(/line must be an integer 0\.\.3/);
  });

  it("rejects undefined (tests JSON.stringify fallback to String())", () => {
    expect(() => toLine(undefined)).toThrow(/line must be an integer 0\.\.3/);
  });
});

describe("refToBytes32", () => {
  it("passes through valid 32-byte hex strings unchanged", () => {
    const hex = `0x${"00".repeat(32)}` as const;
    expect(refToBytes32(hex)).toBe(hex);
  });

  it("converts short ASCII strings to bytes32", () => {
    const result = refToBytes32("TEST");
    expect(result).toHaveLength(66); // "0x" + 64 hex chars
    expect(isHex(result)).toBe(true);
  });

  it("right-pads strings to 32 bytes", () => {
    // "A" should be padded with zeros to 32 bytes
    const result = refToBytes32("A");
    // After encoding "A" (0x41) in 32 bytes with right padding, it becomes 0x41 + 31 zeros
    expect(result).toMatch(/^0x41/);
  });

  it("rejects strings longer than 32 UTF-8 bytes", () => {
    const longStr = "A".repeat(33);
    expect(() => refToBytes32(longStr)).toThrow(InvoiceParseError);
    expect(() => refToBytes32(longStr)).toThrow(/at most 32 fit bytes32/);
  });

  it("rejects multibyte character strings exceeding 32 bytes", () => {
    // é is 2 bytes each
    const tooLong = "é".repeat(17); // 34 bytes
    expect(() => refToBytes32(tooLong)).toThrow(InvoiceParseError);
  });

  it("accepts exactly 32 UTF-8 byte strings", () => {
    const exact32 = "A".repeat(32); // 32 ASCII bytes
    const result = refToBytes32(exact32);
    expect(isHex(result)).toBe(true);
  });
});

describe("Branch coverage: edge cases in parseInvoices", () => {
  const SIG = `0x${"ab".repeat(65)}`;
  const parse = (v: unknown) => parseInvoices(JSON.stringify(v));

  it("handles raw.message structure with invoice fields nested inside", () => {
    // This tests the looksLikeInvoice branch: isObj(raw.message)
    const input = {
      message: {
        bookingId: "100",
        line: 2,
        amount: "5000",
      },
      signature: SIG,
    };
    const [inv] = parse(input);
    expect(inv.invoice.bookingId).toBe(100n);
    expect(inv.invoice.line).toBe(2);
    expect(inv.invoice.amount).toBe(5000n);
  });

  it("uses raw.refString when raw.refLabel is absent", () => {
    // This tests the refLabel ternary: raw.refString branch
    const input = {
      invoice: { bookingId: "50", line: 0, amount: "1000" },
      signature: SIG,
      refString: "VENDOR-REF-123",
    };
    const [inv] = parse(input);
    expect(inv.refLabel).toBe("VENDOR-REF-123");
  });

  it("uses refStr directly when it's not hex-formatted", () => {
    // This tests the refLabel ternary: isHex(refStr) === false branch
    const input = {
      invoice: { bookingId: "75", line: 1, amount: "2000" },
      signature: SIG,
      ref: "PLAIN-TEXT-REF",
    };
    const [inv] = parse(input);
    expect(inv.refLabel).toBe("PLAIN-TEXT-REF");
  });

  it("includes keyHint context in error messages via keyed object structure", () => {
    // Test keyHint usage - pass an object keyed by reference
    const input = {
      "INV-HOTEL-001": {
        invoice: { bookingId: "10", line: 1, amount: "500" },
        signature: SIG,
      },
    };
    const [inv] = parse(input);
    expect(inv.label).toBe("INV-HOTEL-001");
    expect(inv.invoice.bookingId).toBe(10n);
  });

  it("correctly uses raw.refLabel when present (highest precedence)", () => {
    // This tests the first part of refLabel ternary
    const input = {
      invoice: { bookingId: "300", line: 3, amount: "7500" },
      signature: SIG,
      refLabel: "CUSTOM-LABEL",
      refString: "SHOULD-NOT-USE",
      ref: "0x" + "aa".repeat(32),
    };
    const [inv] = parse(input);
    expect(inv.refLabel).toBe("CUSTOM-LABEL");
  });

  it("uses refToLabel on isHex(refStr) when neither refLabel nor refString present", () => {
    // This tests the refLabel ternary: isHex(refStr) === true branch
    const hexRef = stringToHex("HEXREF", { size: 32 });
    const input = {
      invoice: { bookingId: "400", line: 2, amount: "3000", ref: hexRef },
      signature: SIG,
    };
    const [inv] = parse(input);
    expect(inv.refLabel).toBe("HEXREF");
  });

  it("handles keyHint with special characters in field missing errors", () => {
    // When a field is missing in a keyed object, keyHint appears in error
    const input = {
      "HOTEL-ABC-001": {
        invoice: { bookingId: "20", line: 0 }, // amount missing
        signature: SIG,
      },
    };
    expect(() => parse(input)).toThrow(/amount is missing/);
  });
});

describe("Type definitions and constants", () => {
  it("defines INVOICE_TYPES correctly", () => {
    expect(INVOICE_TYPES.Invoice).toHaveLength(5);
    expect(INVOICE_TYPES.Invoice[0].name).toBe("bookingId");
    expect(INVOICE_TYPES.Invoice[4].name).toBe("expiry");
  });

  it("defines DEPARTURE_TYPES correctly", () => {
    expect(DEPARTURE_TYPES.Departure).toHaveLength(1);
    expect(DEPARTURE_TYPES.Departure[0].name).toBe("bookingId");
  });

  it("defines PERMIT_TYPES correctly", () => {
    expect(PERMIT_TYPES.Permit).toHaveLength(5);
    expect(PERMIT_TYPES.Permit[0].name).toBe("owner");
    expect(PERMIT_TYPES.Permit[4].name).toBe("deadline");
  });
});
