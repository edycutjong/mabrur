import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Faktur Vendor",
  description:
    "Vendor berlisensi menandatangani faktur dengan kuncinya sendiri: penerima uang selalu penanda tangan faktur.",
});

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
