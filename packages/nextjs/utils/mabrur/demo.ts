/** The two seeded demo bookings on Arbitrum One (decimal ids, as in DEMO.md): linked from /judge and the empty passbook. */
export const AHMAD_ID = "93071288952676167289577516806255635492368093588595261547394544652192346034554";
export const SITI_ID = "38303033312745746094663211795656914215448779063347601464497604008460359611737";

/** The chain the demo bookings and the sample invoices live on (Arbitrum One). */
export const DEMO_CHAIN_ID = 42161;

/** Arbitrum Sepolia: the testnet deployment outside users can try for free (header Mainnet | Testnet toggle). */
export const TESTNET_CHAIN_ID = 421614;

/** Where an outside user gets free Arbitrum Sepolia ETH for gas on the testnet (the Mainnet | Testnet toggle). */
export const TESTNET_FAUCET = "https://faucets.chain.link/arbitrum-sepolia";

/** Names of the demo bookings, known before any RPC answers (so a deep-linked heading never flips on load). */
export const DEMO_NAMES: Record<string, string> = { [AHMAD_ID]: "Pak Ahmad", [SITI_ID]: "Ibu Siti" };

/** Signed sample invoices served from public/demo/: each one is refused by name on Pak Ahmad's booking. */
export const SAMPLE_INVOICES_URL = "/demo/invoices.json";

/** `?contoh` (any value) on /app/agen: the server renders the page with the sample invoices loaded (agen/page.tsx). */
