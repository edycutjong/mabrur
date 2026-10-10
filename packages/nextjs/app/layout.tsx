import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import "~~/styles/mabrur.css";
import { LANG_BOOT_SCRIPT } from "~~/utils/mabrur/i18n";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

// Direction v2 + Amendment v2.1 (projector type): Cormorant Garamond 600/700 headings, Inter 400–600 body,
// JetBrains Mono for amounts/hashes/errors. No 300 weights: they wash out on a Demo Day projector.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal"],
  variable: "--font-cormorant",
  display: "swap",
});
// The italic (terbilang only) is not preloaded: most first screens never use it, and an unused preload is a console
// warning on every route. It loads on first use, same family name. The data face stays preloaded: /judge and the
// console show hashes and amounts in the first paint, and a late swap shifted the /judge proof table (CLS 0.09).
const cormorantItalic = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600"],
  style: ["italic"],
  variable: "--font-cormorant-italic",
  display: "swap",
  preload: false,
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata = getMetadata({
  title: "Mabrur — purpose-bound umrah prepayment",
  description:
    "Uang umrah jamaah dikunci per pos di Arbitrum One: hanya faktur vendor berlisensi yang bisa membayar, siapa pun bisa refund.",
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html
      suppressHydrationWarning
      lang="id"
      className={`${cormorant.variable} ${cormorantItalic.variable} ${inter.variable} ${mono.variable}`}
    >
      <head>
        {/* Before first paint: apply the visitor's ID/EN choice (shared with the landing) so nothing flashes. */}
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOT_SCRIPT }} />
      </head>
      <body className="mabrur">
        <ThemeProvider forcedTheme="light" enableSystem={false}>
          <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
