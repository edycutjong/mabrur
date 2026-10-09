// UI-only labels (never on chain). Public demo addresses may be named via NEXT_PUBLIC_* env vars; anything else a
// user names is kept in this browser's localStorage only.

// Env vars name demo addresses on any chain and always win over the built-in fallbacks below.
const ENV_NAMES: [string | undefined, string][] = [
  [process.env.NEXT_PUBLIC_AGENCY_ADDR, "PT Amanah Contoh Wisata"],
  [process.env.NEXT_PUBLIC_VENDOR_FLIGHT_ADDR, "PT Contoh GSA"],
  [process.env.NEXT_PUBLIC_VENDOR_HOTEL_ADDR, "Hotel Contoh Makkah"],
  [process.env.NEXT_PUBLIC_VENDOR_VISA_ADDR, "PT Contoh Visa"],
  [process.env.NEXT_PUBLIC_DIRECTOR_ADDR, "Direktur PT Amanah (tanpa klaim)"],
  [process.env.NEXT_PUBLIC_AHMAD_ADDR, "Pak Ahmad"],
  [process.env.NEXT_PUBLIC_SITI_ADDR, "Ibu Siti"],
  [process.env.NEXT_PUBLIC_AHMAD_BACKUP_ADDR, "Pak Ahmad (cadangan)"],
];

/** Fallback display names for the public demo keys of the live deployment (fictional names, keys are public). */
const CHAIN_NAMES: Record<number, Record<string, string>> = {
  42161: Object.fromEntries(
    (
      [
        ["0x69bA3e937628201D614e18326F273BB04E7f20C8", "Pak Ahmad"],
        ["0x9539D32c42c823Db72717CA32201B81C791562a8", "Ibu Siti"],
        ["0x2D5DE7156EE4aB02f2222d1791d358115Ac65f7C", "Pak Ahmad (cadangan)"],
        ["0x94BeF04f31131eE837062697fe2302B577c39573", "PT Contoh GSA (maskapai)"],
        ["0x45D023807720E23d3ee5754f2E56F3BD5634e372", "Hotel Contoh Makkah"],
        ["0xf17cF882AA2be9a3bEcB1e131EAFA38D27a36B86", "PT Contoh Visa"],
        ["0x6DD225ef209dF9aED8D34Ff5817352ce8AC2f855", "Direktur PT Amanah (tanpa klaim)"],
        ["0x2e427dD87F7cEd8148de179D1CC9A9e9f13f3A4a", "PT Amanah Contoh Wisata"],
        ["0xA3bA677CCc570f683E59c757Ae8eaAa935dfa450", "Regulator (kunci demo)"],
        ["0x4d22e6a56346addd2D73433AB182B9823db6c215", "Penerbit klaim (kunci demo)"],
        ["0xc0Fcf4b18B3217615ecF8714F6Af2378454e8A32", "Deployer · pihak ketiga"],
      ] as const
    ).map(([a, n]) => [a.toLowerCase(), n]),
  ),
};

/** The chain a caller without a chain id most likely shows: the first target network (see scaffold.config.ts). */
const DEFAULT_CHAIN = process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true" ? 31337 : 42161;

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

export const getLabel = (key: string | undefined, chainId: number = DEFAULT_CHAIN): string | undefined => {
  if (!key) return undefined;
  const k = key.toLowerCase();
  const local = readLocal()[k];
  if (local) return local;
  for (const [addr, name] of ENV_NAMES) if (addr && addr.toLowerCase() === k) return name;
  return CHAIN_NAMES[chainId]?.[k];
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
