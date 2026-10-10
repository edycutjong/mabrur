"use client";

import React from "react";
import Link from "next/link";
import { getAddress } from "viem";
import { T } from "~~/components/mabrur/T";
import { useT } from "~~/hooks/mabrur/useLang";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { TESTNET_CHAIN_ID } from "~~/utils/mabrur/demo";
import { contracts } from "~~/utils/scaffold-eth/contract";

const REPO = "https://github.com/edycutjong/mabrur";
const PBM_CODE = "https://arbiscan.io/address/0x36f1d899d9d4411b2DdfB60Dbbe989220336d2D5#code";

/** Site footer: the honesty line, always visible, plus the judge path and the source. */
export const Footer = () => {
  const t = useT();
  // The verified MabrurPBM of the network the Mainnet | Testnet toggle points at (mainnet when there is no explorer).
  const { targetNetwork } = useTargetNetwork();
  const pbm = contracts?.[targetNetwork.id]?.MabrurPBM?.address;
  const scan = targetNetwork.blockExplorers?.default.url;
  const pbmCode = pbm && scan ? `${scan}/address/${getAddress(pbm)}#code` : PBM_CODE;
  const testnet = pbm && scan && targetNetwork.id === TESTNET_CHAIN_ID;
  return (
    <footer className="mb-footer mt-16">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 pt-10 pb-12 text-[13px] flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-5">
          <span className="mb-wordmark">Mabrur</span>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label={t("Tautan", "Links")}>
            <Link href="/judge">
              <T id="Untuk juri" en="For judges" />
            </Link>
            <a href={REPO} className="mb-ext" target="_blank" rel="noreferrer">
              GitHub: edycutjong/mabrur
            </a>
            <a href={pbmCode} className="mb-ext" target="_blank" rel="noreferrer" data-testid="footer-contract">
              {testnet ? (
                <T id="Kontrak terverifikasi (Arbiscan, testnet)" en="Verified contract (Arbiscan, testnet)" />
              ) : (
                <T id="Kontrak terverifikasi (Arbiscan)" en="Verified contract (Arbiscan)" />
              )}
            </a>
          </nav>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[rgba(249,246,240,0.14)] pt-5">
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
