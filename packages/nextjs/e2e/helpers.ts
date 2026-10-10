import { Page, expect } from "@playwright/test";

/** Pak Ahmad's demo booking on Arbitrum One (decimal id, as linked from /judge). */
export const AHMAD_ID = "93071288952676167289577516806255635492368093588595261547394544652192346034554";

/**
 * Console noise that is not ours: third-party wallet SDK telemetry/allow-list checks and public-RPC hiccups.
 * Anything else logged at "error" level fails the test.
 */
const IGNORED = [
  /walletconnect|reown|web3modal|coinbase|cca-lite|pulse\.walletconnect/i,
  /Origin .* not (found|on|in) .*allow ?list/i,
  /Failed to load resource: the server responded with a status of 4(03|29)/i,
  /Failed to load resource: net::ERR_/i,
  /Lit is in dev mode/i,
  // arb1.arbitrum.io intermittently answers with a doubled Access-Control-Allow-Origin ("*,*"); the browser blocks that
  // one response and viem's fallback transport retries the next public RPC (services/web3/wagmiConfig.tsx).
  /Access to fetch at 'https:\/\/[a-z0-9.-]*(arbitrum|publicnode|drpc|blastapi)[^']*' .* blocked by CORS policy/i,
];

export const collectConsoleErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", msg => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!IGNORED.some(r => r.test(text))) errors.push(text);
  });
  page.on("pageerror", e => errors.push(`pageerror: ${e.message}`));
  return errors;
};

/** True when the page scrolls sideways (the document is wider than the viewport). */
export const horizontalOverflow = (page: Page) =>
  page.evaluate(() => {
    const el = document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });

export const expectNoHorizontalOverflow = async (page: Page) => {
  const { scrollWidth, clientWidth } = await horizontalOverflow(page);
  expect(scrollWidth, `scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(clientWidth);
};
