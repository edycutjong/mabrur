import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Faktur Vendor",
  description:
    "A licensed vendor signs an invoice with its own key — the payee is always the signer. Paste the JSON into the agency console.",
});

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
