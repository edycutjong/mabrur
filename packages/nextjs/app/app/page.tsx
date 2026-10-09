import Link from "next/link";
import type { NextPage } from "next";
import { T } from "~~/components/mabrur/T";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Pilih peran",
  description:
    "Mabrur: a pilgrim's umrah prepayment earmarked per line on Arbitrum One. Pick a role — pilgrim, agency or licensed vendor.",
});

const ROLES = [
  {
    href: "/app/jamaah",
    eyebrow: { id: "Jamaah", en: "Pilgrim" },
    title: { id: "Pesan & buku amanah", en: "Book & passbook" },
    id: "Bayar paket umrah dengan satu tanda tangan. Setiap rupiah disimpan per pos: tiket, hotel, visa, ujrah.",
    en: "Book with one signature. Every rupiah is earmarked per line; anyone can refund after the deadline.",
  },
  {
    href: "/app/agen",
    eyebrow: { id: "Agen", en: "Agency" },
    title: { id: "Konsol agen", en: "Agency console" },
    id: "Agen hanya bisa membayar faktur yang ditandatangani vendor berlisensi untuk booking ini.",
    en: "The agency can only pay a licensed vendor's signed invoice for this booking. Includes the regulator panel.",
  },
  {
    href: "/app/vendor",
    eyebrow: { id: "Vendor berlisensi", en: "Licensed vendor" },
    title: { id: "Tanda tangani faktur", en: "Sign an invoice" },
    id: "Vendor menandatangani faktur dengan kuncinya sendiri — penerima uang adalah penanda tangan.",
    en: "Vendors sign invoices with their own key — the payee is the signer.",
  },
];

const AppHome: NextPage = () => (
  <div className="w-full max-w-6xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
    <div className="mb-label">
      <T id="Mabrur · uang muka umrah yang terikat tujuan" en="Mabrur · purpose-bound umrah prepayment" />
    </div>
    <h1 className="mb-title mt-1">
      <T
        id="Dana umrah Anda hanya bisa dipakai untuk umrah Anda."
        en="Your umrah money can only be spent on your umrah."
      />
    </h1>
    <p className="mb-p mt-3 max-w-3xl">
      <T
        id="Uang muka jamaah dikunci per pos di kontrak. Agen membayar vendor hanya dengan faktur bertanda tangan vendor berlisensi; jika tiket tidak dibeli tepat waktu, siapa pun bisa mengembalikan sisa dana ke jamaah."
        en="A pilgrim's prepayment is earmarked line by line on-chain. The agency pays vendors only with a licensed vendor's signed invoice; if no ticket is bought in time, anyone can return the rest to the pilgrim."
      />
    </p>
    <div className="grid gap-5 md:grid-cols-3 mt-8">
      {ROLES.map(r => (
        <Link
          key={r.href}
          href={r.href}
          className="mb-sheet flex flex-col gap-2 hover:-translate-y-0.5 transition-transform"
        >
          <span className="mb-label">
            <T id={r.eyebrow.id} en={r.eyebrow.en} />
          </span>
          <span className="mb-h2">
            <T id={r.title.id} en={r.title.en} />
          </span>
          <span className="mb-p">
            <T id={r.id} en={r.en} />
          </span>
          <span className="mt-auto font-bold">
            <T id="Buka →" en="Open →" />
          </span>
        </Link>
      ))}
    </div>
    <p className="mb-p mt-8 text-sm mb-muted">
      <T
        id="tIDR adalah token uji tanpa nilai. Semua nama agen dan vendor fiktif (“PT … Contoh …”). Penerbit klaim adalah kunci demo."
        en="tIDR is a test token with no value. All agency and vendor names are fictional. The claim issuer is a demo key."
      />
    </p>
  </div>
);

export default AppHome;
