import Link from "next/link";
import type { NextPage } from "next";
import { T } from "~~/components/mabrur/T";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Pilih peran",
  description:
    "Pilih peran: jamaah, agen, atau vendor berlisensi. Uang umrah dikunci per pos onchain; tIDR adalah token uji tanpa nilai.",
});

// Drawn 1.5px-stroke icons (no glyphs): passbook, console with a seal, pen on an invoice.
const ICONS = [
  <svg
    key="j"
    viewBox="0 0 36 36"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 6.5h17.5a3 3 0 013 3V30H10a3 3 0 01-3-3z" />
    <path d="M7 27a3 3 0 013-3h17.5M12 12h10M12 16.5h7" />
  </svg>,
  <svg
    key="a"
    viewBox="0 0 36 36"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="7" width="26" height="19" rx="2.5" />
    <path d="M13 30.5h10M18 26v4.5M10 13h8M10 17.5h5" />
    <rect x="21" y="12.5" width="6.5" height="6.5" rx="1" transform="rotate(-4 24 16)" />
  </svg>,
  <svg
    key="v"
    viewBox="0 0 36 36"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 5.5h13l5 5v20H9z" />
    <path d="M22 5.5v5h5M13 15h9M13 19.5h6" />
    <path d="M13.5 27c2-2.4 3.5-2.4 4.5-.6 1 1.6 2.4 1.4 4.5-.9" />
  </svg>,
];

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
  <div className="w-full max-w-6xl mx-auto px-4 lg:px-8 py-10 lg:py-16">
    <div className="mb-label mb-runhead">
      <T id="Mabrur · uang muka umrah yang terikat tujuan" en="Mabrur · purpose-bound umrah prepayment" />
    </div>
    <h1 className="mb-title max-w-4xl">
      <T
        id={
          <>
            Dana umrah Anda hanya bisa dipakai untuk <span className="mb-swash">umrah Anda.</span>
          </>
        }
        en={
          <>
            Your umrah money can only be spent on <span className="mb-swash">your umrah.</span>
          </>
        }
      />
    </h1>
    <p className="mb-p mb-lede mt-5 max-w-3xl">
      <T
        id="Uang muka jamaah dikunci per pos di kontrak. Agen membayar vendor hanya dengan faktur bertanda tangan vendor berlisensi; jika tiket tidak dibeli tepat waktu, siapa pun bisa mengembalikan sisa dana ke jamaah."
        en="A pilgrim's prepayment is earmarked line by line on-chain. The agency pays vendors only with a licensed vendor's signed invoice; if no ticket is bought in time, anyone can return the rest to the pilgrim."
      />
    </p>
    <div className="mb-roles mt-10 lg:mt-12">
      {ROLES.map((r, i) => (
        <Link key={r.href} href={r.href} className="flex flex-col gap-3 group">
          <span className="mb-role-ico" aria-hidden="true">
            {ICONS[i]}
          </span>
          <span className="mb-label mt-2">
            <T id={r.eyebrow.id} en={r.eyebrow.en} />
          </span>
          <span className="mb-h2">
            <T id={r.title.id} en={r.title.en} />
          </span>
          <span className="mb-p mb-muted text-[15px]">
            <T id={r.id} en={r.en} />
          </span>
          <span className="mb-role-open mb-go">
            <T id="Buka" en="Open" />
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
