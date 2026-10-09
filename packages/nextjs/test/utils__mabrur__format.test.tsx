import {
  LINES,
  TOPICS,
  formatCountdown,
  formatDateWIB,
  formatRp,
  fromLocalInput,
  idHex,
  parseBookingId,
  parseRp,
  shortHex,
  terbilang,
  toLocalInput,
} from "../utils/mabrur/format";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatRp", () => {
  it("formats positive number with thousand separators", () => {
    expect(formatRp(14000000)).toBe("Rp 14.000.000");
  });

  it("formats positive bigint with thousand separators", () => {
    expect(formatRp(5000000n)).toBe("Rp 5.000.000");
  });

  it("formats single digit", () => {
    expect(formatRp(5)).toBe("Rp 5");
  });

  it("formats zero", () => {
    expect(formatRp(0)).toBe("Rp 0");
  });

  it("formats negative number with minus sign", () => {
    expect(formatRp(-1000)).toBe("−Rp 1.000");
  });

  it("formats negative bigint with minus sign", () => {
    expect(formatRp(-50000n)).toBe("−Rp 50.000");
  });

  it("returns placeholder for undefined", () => {
    expect(formatRp(undefined)).toBe("Rp –");
  });

  it("returns placeholder for null", () => {
    expect(formatRp(null)).toBe("Rp –");
  });

  it("formats large number with many separators", () => {
    expect(formatRp(1234567890)).toBe("Rp 1.234.567.890");
  });
});

describe("terbilang", () => {
  it("returns empty string for undefined", () => {
    expect(terbilang(undefined)).toBe("");
  });

  it("returns empty string for null", () => {
    expect(terbilang(null)).toBe("");
  });

  it("returns 'nol rupiah' for zero", () => {
    expect(terbilang(0)).toBe("nol rupiah");
  });

  it("converts single digits", () => {
    expect(terbilang(1)).toBe("satu rupiah");
    expect(terbilang(5)).toBe("lima rupiah");
    expect(terbilang(9)).toBe("sembilan rupiah");
  });

  it("converts 10 and 11", () => {
    expect(terbilang(10)).toBe("sepuluh rupiah");
    expect(terbilang(11)).toBe("sebelas rupiah");
  });

  it("converts teens (13-19)", () => {
    expect(terbilang(13)).toBe("tiga belas rupiah");
    expect(terbilang(19)).toBe("sembilan belas rupiah");
  });

  it("converts tens", () => {
    expect(terbilang(20)).toBe("dua puluh rupiah");
    expect(terbilang(30)).toBe("tiga puluh rupiah");
  });

  it("converts tens with remainder", () => {
    expect(terbilang(25)).toBe("dua puluh lima rupiah");
    expect(terbilang(99)).toBe("sembilan puluh sembilan rupiah");
  });

  it("converts hundreds", () => {
    expect(terbilang(100)).toBe("seratus rupiah");
    expect(terbilang(200)).toBe("dua ratus rupiah");
  });

  it("converts hundreds with remainder", () => {
    expect(terbilang(123)).toBe("seratus dua puluh tiga rupiah");
    expect(terbilang(999)).toBe("sembilan ratus sembilan puluh sembilan rupiah");
  });

  it("converts thousands", () => {
    expect(terbilang(1000)).toBe("seribu rupiah");
    expect(terbilang(2000)).toBe("dua ribu rupiah");
    expect(terbilang(10000)).toBe("sepuluh ribu rupiah");
  });

  it("converts thousands with remainder", () => {
    expect(terbilang(1234)).toBe("seribu dua ratus tiga puluh empat rupiah");
    expect(terbilang(5678)).toBe("lima ribu enam ratus tujuh puluh delapan rupiah");
  });

  it("converts millions", () => {
    expect(terbilang(1000000)).toBe("satu juta rupiah");
    expect(terbilang(2500000)).toBe("dua juta lima ratus ribu rupiah");
  });

  it("converts complex amounts with multiple units", () => {
    expect(terbilang(32000000)).toBe("tiga puluh dua juta rupiah");
    expect(terbilang(123456789)).toBe(
      "seratus dua puluh tiga juta empat ratus lima puluh enam ribu tujuh ratus delapan puluh sembilan rupiah",
    );
  });

  it("converts billions", () => {
    expect(terbilang(1000000000)).toBe("satu miliar rupiah");
    expect(terbilang(5500000000)).toBe("lima miliar lima ratus juta rupiah");
  });

  it("converts trillions", () => {
    expect(terbilang(1000000000000n)).toBe("satu triliun rupiah");
    expect(terbilang(2300000000000n)).toBe("dua triliun tiga ratus miliar rupiah");
  });

  it("handles negative numbers by taking absolute value", () => {
    expect(terbilang(-1000)).toBe("seribu rupiah");
    expect(terbilang(-42)).toBe("empat puluh dua rupiah");
  });

  it("handles bigint inputs", () => {
    expect(terbilang(1234n)).toBe("seribu dua ratus tiga puluh empat rupiah");
  });

  it("handles very large numbers", () => {
    expect(terbilang(999999999999n)).toBe(
      "sembilan ratus sembilan puluh sembilan miliar sembilan ratus sembilan puluh sembilan juta sembilan ratus sembilan puluh sembilan ribu sembilan ratus sembilan puluh sembilan rupiah",
    );
  });
});

describe("formatDateWIB", () => {
  it("returns dash for undefined", () => {
    expect(formatDateWIB(undefined)).toBe("–");
  });

  it("formats unix timestamp with time in WIB (UTC+7)", () => {
    // 2026-10-11 10:04:00 UTC = Unix 1791777840
    const result = formatDateWIB(1791777840);
    expect(result).toContain("WIB");
    expect(result).toMatch(/\d{1,2} \w{3} \d{4}, \d{2}\.\d{2} WIB/);
  });

  it("formats unix timestamp with time using bigint", () => {
    const result = formatDateWIB(1791777840n);
    expect(result).toContain("WIB");
    expect(result).toMatch(/\d{1,2} \w{3} \d{4}, \d{2}\.\d{2} WIB/);
  });

  it("formats date without time when withTime is false", () => {
    const result = formatDateWIB(1791777840, false);
    expect(result).not.toContain("WIB");
    expect(result).toMatch(/\d{1,2} \w{3} \d{4}/);
  });

  it("formats correctly at midnight UTC", () => {
    // Midnight UTC = 07:00 WIB (UTC+7)
    const result = formatDateWIB(1609459200, true); // 2021-01-01 00:00:00 UTC
    expect(result).toContain("WIB");
  });

  it("formats with correct month abbreviations", () => {
    const monthTests = [
      [1609459200, "01 Jan"], // 2021-01-01
      [1640995200, "01 Jan"], // 2022-01-01 (next year)
    ];
    monthTests.forEach(([unix]) => {
      const result = formatDateWIB(unix as number, false);
      // Just check that month abbreviations are used correctly
      expect(result).toMatch(/[A-Z][a-z]{2}/);
    });
  });

  it("pads hours and minutes with leading zeros", () => {
    const result = formatDateWIB(1609459200, true);
    // Should have padded time format HH.MM
    expect(result).toMatch(/\d{2}\.\d{2} WIB/);
  });

  it("handles zero unix timestamp", () => {
    const result = formatDateWIB(0, true);
    expect(result).toContain("1970");
    expect(result).toContain("WIB");
  });
});

describe("shortHex", () => {
  it("returns dash for undefined", () => {
    expect(shortHex(undefined)).toBe("–");
  });

  it("returns dash for empty string", () => {
    expect(shortHex("")).toBe("–");
  });

  it("returns full hex if length <= head + tail + 1", () => {
    // "0x12345" has length 7, and 7 <= (6+4+1) = 11, so returns unchanged
    expect(shortHex("0x12345")).toBe("0x12345");
  });

  it("shortens long hex string with default head=6, tail=4", () => {
    const result = shortHex("0x123456789abcdef");
    expect(result).toBe("0x1234…cdef");
  });

  it("shortens with custom head parameter", () => {
    const result = shortHex("0x123456789abcdef", 4);
    expect(result).toBe("0x12…cdef");
  });

  it("shortens with custom head and tail parameters", () => {
    const result = shortHex("0x123456789abcdef", 5, 2);
    // h.slice(0, 5) gives first 5 chars: "0x123"
    // h.slice(-2) gives last 2 chars: "ef"
    expect(result).toBe("0x123…ef");
  });

  it("handles very long hex strings", () => {
    const longHex = "0x" + "a".repeat(100);
    const result = shortHex(longHex);
    // h.slice(0, 6) = "0xaaaa" (first 6 chars including "0x")
    // h.slice(-4) = "aaaa" (last 4 chars)
    expect(result).toBe("0xaaaa…aaaa");
    expect(result).toMatch(/^0x[a-f0-9]+…[a-f0-9]+$/);
  });

  it("handles hex without 0x prefix", () => {
    const result = shortHex("123456789abcdef", 6, 4);
    expect(result).toBe("123456…cdef");
  });
});

describe("idHex", () => {
  it("returns dash for undefined", () => {
    expect(idHex(undefined)).toBe("–");
  });

  it("formats bigint to 0x-padded 64-char hex", () => {
    const result = idHex(255n);
    expect(result).toBe("0x00000000000000000000000000000000000000000000000000000000000000ff");
  });

  it("formats zero with proper padding", () => {
    const result = idHex(0n);
    expect(result).toBe("0x0000000000000000000000000000000000000000000000000000000000000000");
  });

  it("formats large bigint correctly", () => {
    const result = idHex(12345678901234567890n);
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.length).toBe(66); // "0x" + 64 hex chars
  });

  it("formats max uint256 value", () => {
    const maxUint256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
    const result = idHex(maxUint256);
    expect(result).toBe("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  });
});

describe("formatCountdown", () => {
  it("formats seconds only (< 60 seconds)", () => {
    expect(formatCountdown(45)).toBe("00:45");
  });

  it("formats zero seconds", () => {
    expect(formatCountdown(0)).toBe("00:00");
  });

  it("formats minutes and seconds", () => {
    expect(formatCountdown(125)).toBe("02:05");
  });

  it("formats hour, minutes and seconds", () => {
    expect(formatCountdown(3661)).toBe("01:01:01");
  });

  it("pads hour with leading zero when < 10", () => {
    expect(formatCountdown(3605)).toBe("01:00:05");
  });

  it("formats days, hours, minutes and seconds", () => {
    expect(formatCountdown(90061)).toBe("1 hari 01:01:01");
  });

  it("formats multiple days", () => {
    expect(formatCountdown(172800)).toBe("2 hari 00:00:00");
  });

  it("formats days with hours but no minutes", () => {
    expect(formatCountdown(86400 + 3600)).toBe("1 hari 01:00:00");
  });

  it("clamps negative values to zero", () => {
    expect(formatCountdown(-100)).toBe("00:00");
  });

  it("floors decimal seconds", () => {
    expect(formatCountdown(45.9)).toBe("00:45");
    expect(formatCountdown(125.5)).toBe("02:05");
  });

  it("handles large countdown values", () => {
    const result = formatCountdown(1000000);
    expect(result).toMatch(/^\d+ hari \d{2}:\d{2}:\d{2}$/);
  });
});

describe("toLocalInput", () => {
  it("converts unix seconds to datetime-local format", () => {
    // 2026-10-11 10:04:00 UTC
    const unix = 1791777840;
    const result = toLocalInput(unix);
    // Result should be in format YYYY-MM-DDTHH:MM (16 chars)
    expect(result).toHaveLength(16);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("handles zero unix timestamp", () => {
    const result = toLocalInput(0);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("handles negative unix timestamp", () => {
    const result = toLocalInput(-86400); // 1 day before epoch
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("preserves local timezone in conversion", () => {
    const unix1 = 1609459200; // 2021-01-01 00:00:00 UTC
    const result = toLocalInput(unix1);
    expect(result).toContain("2021-01-01");
  });
});

describe("fromLocalInput", () => {
  it("converts datetime-local string to unix seconds", () => {
    const input = "2026-10-11T10:04";
    const result = fromLocalInput(input);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("floors result to whole seconds", () => {
    const input = "2021-01-01T00:00";
    const result = fromLocalInput(input);
    expect(Number.isInteger(result)).toBe(true);
  });

  it("handles different times of day", () => {
    const input1 = "2026-10-11T00:00";
    const input2 = "2026-10-11T23:59";
    const result1 = fromLocalInput(input1);
    const result2 = fromLocalInput(input2);
    expect(result2).toBeGreaterThan(result1);
  });

  it("round-trips with toLocalInput", () => {
    const originalUnix = 1609459200;
    const localStr = toLocalInput(originalUnix);
    const reconstructed = fromLocalInput(localStr);
    // Should be close (within same day due to timezone)
    expect(Math.abs(reconstructed - originalUnix)).toBeLessThan(86400);
  });
});

describe("parseRp", () => {
  it("parses formatted rupiah with dots", () => {
    expect(parseRp("14.000.000")).toBe(14000000n);
  });

  it("parses unformatted rupiah", () => {
    expect(parseRp("14000000")).toBe(14000000n);
  });

  it("parses 'jt' suffix (juta)", () => {
    expect(parseRp("14jt")).toBe(14000000n);
  });

  it("parses 'jt' with space", () => {
    expect(parseRp("14 jt")).toBe(14000000n);
  });

  it("parses 'Rp' prefix", () => {
    expect(parseRp("Rp 14000000")).toBe(14000000n);
  });

  it("parses with mixed separators", () => {
    expect(parseRp("14.000_000")).toBe(14000000n);
  });

  it("parses with spaces as separators", () => {
    expect(parseRp("14 000 000")).toBe(14000000n);
  });

  it("parses with commas as separators", () => {
    expect(parseRp("14,000,000")).toBe(14000000n);
  });

  it("parses single digit", () => {
    expect(parseRp("5")).toBe(5n);
  });

  it("parses zero", () => {
    expect(parseRp("0")).toBe(0n);
  });

  it("returns undefined for empty string", () => {
    expect(parseRp("")).toBeUndefined();
  });

  it("returns undefined for whitespace only", () => {
    expect(parseRp("   ")).toBeUndefined();
  });

  it("returns undefined for invalid characters", () => {
    expect(parseRp("14abc")).toBeUndefined();
  });

  it("returns undefined for non-digit characters after removal", () => {
    expect(parseRp("abc.def")).toBeUndefined();
  });

  it("is case-insensitive for 'jt' suffix", () => {
    expect(parseRp("14JT")).toBe(14000000n);
    expect(parseRp("14Jt")).toBe(14000000n);
  });

  it("strips 'Rp' prefix case-insensitively", () => {
    expect(parseRp("rp 100")).toBe(100n);
  });

  it("handles leading/trailing whitespace", () => {
    expect(parseRp("  14000000  ")).toBe(14000000n);
  });

  it("returns undefined for jt pattern without number", () => {
    expect(parseRp("jt")).toBeUndefined();
  });
});

describe("parseBookingId", () => {
  it("parses valid hex string with 0x prefix", () => {
    expect(parseBookingId("0x123abc")).toBe(0x123abcn);
  });

  it("parses hex with uppercase letters", () => {
    expect(parseBookingId("0xABCDEF")).toBe(0xabcdefn);
  });

  it("parses hex with leading zeros", () => {
    expect(parseBookingId("0x0000ff")).toBe(0xffn);
  });

  it("parses up to 64-char hex (uint256)", () => {
    const hex64 = "0x" + "f".repeat(64);
    const result = parseBookingId(hex64);
    expect(result).toBeDefined();
  });

  it("parses decimal string", () => {
    expect(parseBookingId("12345")).toBe(12345n);
  });

  it("parses zero as decimal", () => {
    expect(parseBookingId("0")).toBe(0n);
  });

  it("returns undefined for empty string", () => {
    expect(parseBookingId("")).toBeUndefined();
  });

  it("returns undefined for whitespace only", () => {
    expect(parseBookingId("   ")).toBeUndefined();
  });

  it("returns undefined for invalid hex (non-hex characters)", () => {
    expect(parseBookingId("0xGHIJKL")).toBeUndefined();
  });

  it("returns undefined for hex with more than 64 chars", () => {
    const tooLongHex = "0x" + "f".repeat(65);
    expect(parseBookingId(tooLongHex)).toBeUndefined();
  });

  it("returns undefined for mixed valid/invalid formats", () => {
    expect(parseBookingId("0x123g45")).toBeUndefined();
  });

  it("strips leading/trailing whitespace", () => {
    expect(parseBookingId("  0x123abc  ")).toBe(0x123abcn);
    expect(parseBookingId("  12345  ")).toBe(12345n);
  });

  it("returns undefined for decimal with non-digit chars", () => {
    expect(parseBookingId("123.45")).toBeUndefined();
  });

  it("returns undefined for 0x without any hex chars", () => {
    expect(parseBookingId("0x")).toBeUndefined();
  });

  it("parses 1-char hex", () => {
    expect(parseBookingId("0xf")).toBe(0xfn);
  });

  it("returns undefined when BigInt throws (catch block coverage)", () => {
    // Mock BigInt to throw an error to test the catch block
    const originalBigInt = globalThis.BigInt;
    try {
      let callCount = 0;
      vi.spyOn(globalThis, "BigInt" as any).mockImplementation((value: any) => {
        callCount++;
        // Let the first call (in parseRp) pass through, throw on the second one (in parseBookingId)
        if (callCount === 1 && typeof value === "string" && value.startsWith("0x")) {
          throw new SyntaxError("Mocked BigInt error");
        }
        return originalBigInt(value);
      });

      // This should trigger the catch block because BigInt will throw
      const result = parseBookingId("0x123");
      expect(result).toBeUndefined();
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("LINES constant", () => {
  it("contains correct number of line items", () => {
    expect(LINES).toHaveLength(4);
  });

  it("contains FLIGHT with correct properties", () => {
    const flight = LINES.find(l => l.key === "FLIGHT");
    expect(flight).toBeDefined();
    expect(flight?.id).toBe("Tiket pesawat");
    expect(flight?.en).toBe("Flight ticket");
    expect(flight?.topic).toBe(2);
  });

  it("contains HOTEL with correct properties", () => {
    const hotel = LINES.find(l => l.key === "HOTEL");
    expect(hotel).toBeDefined();
    expect(hotel?.en).toBe("Hotel");
    expect(hotel?.topic).toBe(3);
  });

  it("contains VISA with correct properties", () => {
    const visa = LINES.find(l => l.key === "VISA");
    expect(visa).toBeDefined();
    expect(visa?.topic).toBe(4);
  });

  it("contains MARGIN with correct properties", () => {
    const margin = LINES.find(l => l.key === "MARGIN");
    expect(margin).toBeDefined();
    expect(margin?.topic).toBe(1);
    expect(margin?.en).toBe("Agency fee (ujrah)");
  });

  it("has ruleId for each line", () => {
    LINES.forEach(line => {
      expect(line.ruleId).toBeDefined();
      expect(line.ruleId.length).toBeGreaterThan(0);
    });
  });

  it("has ruleEn for each line", () => {
    LINES.forEach(line => {
      expect(line.ruleEn).toBeDefined();
      expect(line.ruleEn.length).toBeGreaterThan(0);
    });
  });
});

describe("TOPICS constant", () => {
  it("maps topic numbers to names", () => {
    expect(TOPICS[1]).toBe("PPIU");
    expect(TOPICS[2]).toBe("AIRLINE");
    expect(TOPICS[3]).toBe("HOTEL");
    expect(TOPICS[4]).toBe("VISA");
  });

  it("has exactly 4 topics", () => {
    const keys = Object.keys(TOPICS);
    expect(keys).toHaveLength(4);
  });
});

describe("English variants (EN mode)", () => {
  it("inWords spells rupiah in English", async () => {
    const { inWords } = await import("~~/utils/mabrur/format");
    expect(inWords(undefined)).toBe("");
    expect(inWords(null)).toBe("");
    expect(inWords(0n)).toBe("zero rupiah");
    expect(inWords(7)).toBe("seven rupiah");
    expect(inWords(19)).toBe("nineteen rupiah");
    expect(inWords(40)).toBe("forty rupiah");
    expect(inWords(42)).toBe("forty-two rupiah");
    expect(inWords(100)).toBe("one hundred rupiah");
    expect(inWords(809)).toBe("eight hundred nine rupiah");
    expect(inWords(1000)).toBe("one thousand rupiah");
    expect(inWords(32_000_000n)).toBe("thirty-two million rupiah");
    expect(inWords(-520)).toBe("five hundred twenty rupiah");
    expect(inWords(1_002_003_004_005n)).toBe("one trillion two billion three million four thousand five rupiah");
  });

  it("formatDateWIB uses English months and a colon in EN", async () => {
    const { formatDateWIB } = await import("~~/utils/mabrur/format");
    const t = Date.UTC(2026, 9, 11, 3, 4) / 1000; // 10:04 WIB
    expect(formatDateWIB(t)).toBe("11 Okt 2026, 10.04 WIB");
    expect(formatDateWIB(t, true, "en")).toBe("11 Oct 2026, 10:04 WIB");
    expect(formatDateWIB(t, false, "en")).toBe("11 Oct 2026");
    expect(formatDateWIB(Date.UTC(2026, 4, 2) / 1000, false, "en")).toBe("2 May 2026");
  });

  it("formatCountdown says day/days in EN", async () => {
    const { formatCountdown } = await import("~~/utils/mabrur/format");
    expect(formatCountdown(86400 + 3661)).toBe("1 hari 01:01:01");
    expect(formatCountdown(86400 + 3661, "en")).toBe("1 day 01:01:01");
    expect(formatCountdown(2 * 86400, "en")).toBe("2 days 00:00:00");
    expect(formatCountdown(65, "en")).toBe("01:05");
  });
});
