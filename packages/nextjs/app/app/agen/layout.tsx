import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Konsol Agen",
  description:
    "The agency console: pay a licensed vendor's signed invoice from one booking, see every refusal decoded, and read the regulator panel.",
});

export default function AgenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
