import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import "~~/styles/mabrur.css";
import { LANG_BOOT_SCRIPT } from "~~/utils/mabrur/i18n";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

// Direction v2 "slim + old green": Cormorant Garamond headings, Inter body, JetBrains Mono for amounts/hashes/errors.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
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
    <html suppressHydrationWarning lang="id" className={`${cormorant.variable} ${inter.variable} ${mono.variable}`}>
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
