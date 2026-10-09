"use client";

import React from "react";
import Link from "next/link";
import { T } from "~~/components/mabrur/T";
import { useT } from "~~/hooks/mabrur/useLang";

const REPO = "https://github.com/edycutjong/mabrur";
const PBM_CODE = "https://arbiscan.io/address/0x36f1d899d9d4411b2DdfB60Dbbe989220336d2D5#code";

/** Site footer: the honesty line, always visible, plus the judge path and the source. */
export const Footer = () => {
  const t = useT();
  return (
    <footer className="border-t border-[var(--rule)] mt-10">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-5 text-sm flex flex-col gap-3">
        <nav className="flex flex-wrap gap-x-5 gap-y-1 font-bold" aria-label={t("Tautan", "Links")}>
          <Link href="/judge" className="mb-link">
            <T id="Untuk juri" en="For judges" />
          </Link>
          <a href={REPO} className="mb-link" target="_blank" rel="noreferrer">
            GitHub: edycutjong/mabrur
          </a>
          <a href={PBM_CODE} className="mb-link mb-muted" target="_blank" rel="noreferrer">
            <T id="Kontrak terverifikasi (Arbiscan)" en="Verified contract (Arbiscan)" />
          </a>
        </nav>
        <div className="mb-muted flex flex-wrap gap-x-6 gap-y-1">
          <span>
            <T id="tIDR = token uji tanpa nilai" en="tIDR = test token, no value" />
          </span>
          <span>
            <T id="Nama agen & vendor fiktif" en="Agency & vendor names are fictional" />
          </span>
          <span>
            <T id="Penerbit klaim = kunci demo" en="Claim issuer = a demo key" />
          </span>
        </div>
      </div>
    </footer>
  );
};
