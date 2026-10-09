// UI-only labels (never on chain). Public demo addresses may be named via NEXT_PUBLIC_* env vars; anything else a
// user names is kept in this browser's localStorage only.

const ENV_NAMES: [string | undefined, string][] = [
  ["0x2e427dD87F7cEd8148de179D1CC9A9e9f13f3A4a", "PT Amanah Contoh Wisata"],
  [process.env.NEXT_PUBLIC_AGENCY_ADDR, "PT Amanah Contoh Wisata"],
  [process.env.NEXT_PUBLIC_VENDOR_FLIGHT_ADDR, "PT Contoh GSA"],
  [process.env.NEXT_PUBLIC_VENDOR_HOTEL_ADDR, "PT Contoh Hotel Wholesaler"],
  [process.env.NEXT_PUBLIC_VENDOR_VISA_ADDR, "PT Contoh Visa Provider"],
  [process.env.NEXT_PUBLIC_DIRECTOR_ADDR, "Direktur (dompet pribadi)"],
  [process.env.NEXT_PUBLIC_AHMAD_ADDR, "Pak Ahmad"],
  [process.env.NEXT_PUBLIC_SITI_ADDR, "Ibu Siti"],
  [process.env.NEXT_PUBLIC_AHMAD_BACKUP_ADDR, "Pak Ahmad (cadangan)"],
];

/** Public demo agency per chain (PT Amanah Contoh Wisata). An env var wins; local anvil has no default. */
const AGENCY_BY_CHAIN: Record<number, string> = {
  42161: "0x2e427dD87F7cEd8148de179D1CC9A9e9f13f3A4a",
};
export const defaultAgency = (chainId: number): string =>
  process.env.NEXT_PUBLIC_AGENCY_ADDR ?? AGENCY_BY_CHAIN[chainId] ?? "";

const KEY = "mabrur.labels";

const readLocal = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
};

export const getLabel = (key: string | undefined): string | undefined => {
  if (!key) return undefined;
  const k = key.toLowerCase();
  const local = readLocal()[k];
  if (local) return local;
  for (const [addr, name] of ENV_NAMES) if (addr && addr.toLowerCase() === k) return name;
  return undefined;
};

export const setLabel = (key: string, name: string) => {
  if (typeof window === "undefined") return;
  try {
    const all = readLocal();
    if (name.trim()) all[key.toLowerCase()] = name.trim();
    else delete all[key.toLowerCase()];
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable: labels are a convenience only */
  }
};

export const loadJson = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const saveJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};
