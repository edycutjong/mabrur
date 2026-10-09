import Link from "next/link";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "Halaman tidak ditemukan · Page not found",
  description: "This Mabrur page does not exist. Open the app or the 30-second path for judges.",
});

/** 404 in the kuitansi style: a DITOLAK-less, neutral stamp — a missing page is not a refusal of anyone's money. */
export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <section className="mb-sheet w-full max-w-xl flex flex-col gap-4" aria-labelledby="nf-title">
        <div className="mb-label">Kuitansi tidak ditemukan · not found</div>
        <div className="mb-stamp mb-stamp-sim self-start" aria-hidden="true">
          <span className="mb-stamp-word">404</span>
        </div>
        <h1 id="nf-title" className="mb-title">
          Halaman ini tidak ada.
          <span className="mb-en" lang="en">
            This page does not exist.
          </span>
        </h1>
        <p className="mb-p">
          Alamatnya mungkin salah ketik atau sudah dipindah. Dana amanah tetap aman di kontrak.
          <span className="mb-en" lang="en">
            The address may be mistyped or moved. Every earmarked rupiah is still where it was, on chain.
          </span>
        </p>
        <div className="mb-perforation" />
        <div className="flex flex-wrap gap-3">
          <Link className="mb-btn" href="/app">
            Buka aplikasi · Open the app
          </Link>
          <Link className="mb-btn mb-btn-ghost" href="/judge">
            Untuk juri · For judges
          </Link>
        </div>
      </section>
    </div>
  );
}
