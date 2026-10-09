import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Buku Amanah · Jamaah",
  description:
    "Pesan umrah dengan satu tanda tangan dan baca buku amanah Anda: setiap rupiah dikunci per pos, bisa di-refund siapa pun.",
});

export default function JamaahLayout({ children }: { children: React.ReactNode }) {
  return children;
}
