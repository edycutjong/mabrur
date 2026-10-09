import React from "react";
import Link from "next/link";

const REPO = "https://github.com/edycutjong/mabrur";

/** Site footer: the honesty line, always visible, plus the judge path and the source. */
export const Footer = () => {
  return (
    <footer className="border-t border-[var(--rule)] mt-10">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-5 text-sm flex flex-col gap-3">
        <nav className="flex flex-wrap gap-x-5 gap-y-1 font-bold" aria-label="Tautan">
          <Link href="/judge" className="mb-link">
            Untuk juri · For judges
          </Link>
          <a href={REPO} className="mb-link" target="_blank" rel="noreferrer">
            GitHub: edycutjong/mabrur
          </a>
          <Link href="/debug" className="mb-link mb-muted">
            Contracts (debug)
          </Link>
        </nav>
        <div className="mb-muted flex flex-wrap gap-x-6 gap-y-1">
          <span>tIDR = token uji tanpa nilai · test token, no value</span>
          <span>Nama agen &amp; vendor fiktif · fictional names</span>
          <span>Penerbit klaim = kunci demo · demo claim issuer</span>
        </div>
      </div>
    </footer>
  );
};
