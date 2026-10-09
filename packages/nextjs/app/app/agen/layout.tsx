import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Konsol Agen",
  description:
    "Konsol agen: bayar faktur vendor berlisensi dari satu booking, lihat setiap penolakan terdekode, dan baca panel regulator.",
});

export default function AgenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
