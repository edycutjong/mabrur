import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Buku Amanah · Jamaah",
  description:
    "Book an umrah package with one permit signature and read your passbook: every rupiah earmarked per line, refundable by anyone after the deadline.",
});

export default function JamaahLayout({ children }: { children: React.ReactNode }) {
  return children;
}
