// Formatting helpers. tIDR has decimals = 0, so every amount is whole rupiah.
import type { Lang } from "~~/utils/mabrur/i18n";

export const LINES = [
  {
    key: "FLIGHT",
    id: "Tiket pesawat",
    en: "Flight ticket",
    topic: 2,
    ruleId: "Hanya dibayar ke maskapai berlisensi",
    ruleEn: "Only paid to a licensed airline",
  },
  {
    key: "HOTEL",
    id: "Hotel",
    en: "Hotel",
    topic: 3,
    ruleId: "Hanya dibayar ke hotel berlisensi",
    ruleEn: "Only paid to a licensed hotel vendor",
  },
  {
    key: "VISA",
    id: "Visa",
    en: "Visa",
    topic: 4,
    ruleId: "Hanya dibayar ke penyedia visa berlisensi",
    ruleEn: "Only paid to a licensed visa provider",
  },
  {
    key: "MARGIN",
    id: "Ujrah agen",
    en: "Agency fee (ujrah)",
    topic: 1,
    ruleId: "Terbuka setelah Anda berangkat",
    ruleEn: "Unlocks after you depart",
  },
] as const;

export const TOPICS: Record<number, string> = { 1: "PPIU", 2: "AIRLINE", 3: "HOTEL", 4: "VISA" };

export const formatRp = (v: bigint | number | undefined | null): string => {
  if (v === undefined || v === null) return "Rp –";
  const n = BigInt(v);
  const neg = n < 0n;
  const s = (neg ? -n : n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "−" : ""}Rp ${s}`;
};

const SATUAN = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

const below1000 = (n: number): string => {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const r = n % 10;
    return `${SATUAN[t]} puluh${r ? " " + SATUAN[r] : ""}`;
  }
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h === 1 ? "seratus" : `${SATUAN[h]} ratus`;
  return r ? `${head} ${below1000(r)}` : head;
};

/** Indonesian amount in words: 32000000 → "tiga puluh dua juta rupiah". */
export const terbilang = (v: bigint | number | undefined | null): string => {
  if (v === undefined || v === null) return "";
  let n = BigInt(v);
  if (n === 0n) return "nol rupiah";
  if (n < 0n) n = -n;
  const units: [bigint, string][] = [
    [1_000_000_000_000n, "triliun"],
    [1_000_000_000n, "miliar"],
    [1_000_000n, "juta"],
    [1_000n, "ribu"],
  ];
  const parts: string[] = [];
  for (const [size, name] of units) {
    if (n >= size) {
      const q = Number(n / size);
      n = n % size;
      if (name === "ribu" && q === 1) parts.push("seribu");
      else parts.push(`${below1000(q)} ${name}`);
    }
  }
  if (n > 0n) parts.push(below1000(Number(n)));
  return `${parts.join(" ")} rupiah`;
};

const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const enBelow1000 = (n: number): string => {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? "-" + ONES[n % 10] : ""}`;
  const r = n % 100;
  return `${ONES[Math.floor(n / 100)]} hundred${r ? " " + enBelow1000(r) : ""}`;
};

/** English amount in words, the kuitansi's Terbilang for EN readers: 32000000 → "thirty-two million rupiah". */
export const inWords = (v: bigint | number | undefined | null): string => {
  if (v === undefined || v === null) return "";
  let n = BigInt(v);
  if (n === 0n) return "zero rupiah";
  if (n < 0n) n = -n;
  const units: [bigint, string][] = [
    [1_000_000_000_000n, "trillion"],
    [1_000_000_000n, "billion"],
    [1_000_000n, "million"],
    [1_000n, "thousand"],
  ];
  const parts: string[] = [];
  for (const [size, name] of units) {
    if (n >= size) {
      parts.push(`${enBelow1000(Number(n / size))} ${name}`);
      n = n % size;
    }
  }
  if (n > 0n) parts.push(enBelow1000(Number(n)));
  return `${parts.join(" ")} rupiah`;
};

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Unix seconds → "11 Okt 2026, 10.04 WIB" (Asia/Jakarta); in English "11 Oct 2026, 10:04 WIB". */
export const formatDateWIB = (unix: bigint | number | undefined, withTime = true, lang: Lang = "id"): string => {
  if (unix === undefined) return "–";
  const d = new Date(Number(unix) * 1000 + 7 * 3600 * 1000); // shift to UTC+7, read UTC fields
  const date = `${d.getUTCDate()} ${(lang === "en" ? MONTHS : BULAN)[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (!withTime) return date;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${date}, ${hh}${lang === "en" ? ":" : "."}${mm} WIB`;
};

export const shortHex = (h: string | undefined, head = 6, tail = 4): string => {
  if (!h) return "–";
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
};

/** Booking ids are uint256 hashes; show them as 0x-hex. */
export const idHex = (id: bigint | undefined): string =>
  id === undefined ? "–" : `0x${id.toString(16).padStart(64, "0")}`;

/** "2 hari 03:04:05" / "2 days 03:04:05", "03:04:05", "04:05". */
export const formatCountdown = (secs: number, lang: Lang = "id"): string => {
  const s = Math.max(0, Math.floor(secs));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  if (d > 0) return `${d} ${lang === "en" ? (d === 1 ? "day" : "days") : "hari"} ${String(h).padStart(2, "0")}:${mmss}`;
  if (h > 0) return `${String(h).padStart(2, "0")}:${mmss}`;
  return mmss;
};

/** <input type="datetime-local"> value (local time) ↔ unix seconds. */
export const toLocalInput = (unix: number): string => {
  const d = new Date(unix * 1000);
  const off = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string): number => Math.floor(new Date(v).getTime() / 1000);

/** Parse a user-typed rupiah amount: "14.000.000", "14000000", "14jt". */
export const parseRp = (v: string): bigint | undefined => {
  const t = v.trim().toLowerCase();
  if (!t) return undefined;
  const jt = t.match(/^(\d+)\s*jt$/);
  if (jt) return BigInt(jt[1]) * 1_000_000n;
  const digits = t.replace(/^rp\s*/, "").replace(/[.\s,_]/g, "");
  if (!/^\d+$/.test(digits)) return undefined;
  return BigInt(digits);
};

export const parseBookingId = (v: string): bigint | undefined => {
  const t = v.trim();
  if (!t) return undefined;
  try {
    if (/^0x[0-9a-fA-F]{1,64}$/.test(t)) return BigInt(t);
    if (/^\d+$/.test(t)) return BigInt(t);
  } catch {
    return undefined;
  }
  return undefined;
};
