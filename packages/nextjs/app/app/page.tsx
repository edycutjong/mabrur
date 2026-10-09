import Link from "next/link";
import type { NextPage } from "next";

const ROLES = [
  {
    href: "/app/jamaah",
    eyebrow: "Jamaah · pilgrim",
    title: "Pesan & buku amanah",
    id: "Bayar paket umrah dengan satu tanda tangan. Setiap rupiah disimpan per pos: tiket, hotel, visa, ujrah.",
    en: "Book with one signature. Every rupiah is earmarked per line; anyone can refund after the deadline.",
  },
  {
    href: "/app/agen",
    eyebrow: "Agen · agency",
    title: "Konsol agen",
    id: "Agen hanya bisa membayar faktur yang ditandatangani vendor berlisensi untuk booking ini.",
    en: "The agency can only pay a licensed vendor's signed invoice for this booking. Includes the regulator panel.",
  },
  {
    href: "/app/vendor",
    eyebrow: "Vendor · licensed vendor",
    title: "Tanda tangani faktur",
    id: "Vendor menandatangani faktur dengan kuncinya sendiri — penerima uang adalah penanda tangan.",
    en: "Vendors sign invoices with their own key — the payee is the signer.",
  },
];

const AppHome: NextPage = () => (
  <div className="w-full max-w-6xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
    <div className="mb-label">Mabrur · purpose-bound umrah prepayment</div>
    <h1 className="mb-title mt-1">Dana umrah Anda hanya bisa dipakai untuk umrah Anda.</h1>
    <p className="mb-p mt-3 max-w-3xl">
      Uang muka jamaah dikunci per pos di kontrak. Agen membayar vendor hanya dengan faktur bertanda tangan vendor
      berlisensi; jika tiket tidak dibeli tepat waktu, siapa pun bisa mengembalikan sisa dana ke jamaah.
      <span className="mb-en">
        A pilgrim&apos;s prepayment is earmarked line by line on-chain. The agency pays vendors only with a licensed
        vendor&apos;s signed invoice; if no ticket is bought in time, anyone can return the rest to the pilgrim.
      </span>
    </p>
    <div className="grid gap-5 md:grid-cols-3 mt-8">
      {ROLES.map(r => (
        <Link
          key={r.href}
          href={r.href}
          className="mb-sheet flex flex-col gap-2 hover:-translate-y-0.5 transition-transform"
        >
          <span className="mb-label">{r.eyebrow}</span>
          <span className="mb-h2">{r.title}</span>
          <span className="mb-p">
            {r.id}
            <span className="mb-en">{r.en}</span>
          </span>
          <span className="mt-auto font-bold">Buka →</span>
        </Link>
      ))}
    </div>
    <p className="mb-p mt-8 text-sm mb-muted">
      tIDR adalah token uji tanpa nilai. Semua nama agen dan vendor fiktif (&quot;PT … Contoh …&quot;). Penerbit klaim
      adalah kunci demo.
      <span className="mb-en">
        tIDR is a test token with no value. All agency and vendor names are fictional. The claim issuer is a demo key.
      </span>
    </p>
  </div>
);

export default AppHome;
