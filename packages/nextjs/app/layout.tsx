import { Courier_Prime, Plus_Jakarta_Sans, Zilla_Slab } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import "~~/styles/mabrur.css";
import { LANG_BOOT_SCRIPT } from "~~/utils/mabrur/i18n";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

const zilla = Zilla_Slab({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-zilla", display: "swap" });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
  display: "swap",
});
const courier = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-courier",
  display: "swap",
});

export const metadata = getMetadata({
  title: "Mabrur — purpose-bound umrah prepayment",
  description:
    "A pilgrim's umrah prepayment, earmarked per line on-chain: only a licensed vendor's signed invoice can move it, and anyone can refund it after the deadline. tIDR is a test token with no value.",
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning lang="id" className={`${zilla.variable} ${jakarta.variable} ${courier.variable}`}>
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
