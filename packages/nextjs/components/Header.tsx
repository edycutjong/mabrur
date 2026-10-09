"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

export const menuLinks = [
  { label: "Jamaah", href: "/app/jamaah" },
  { label: "Agen", href: "/app/agen" },
  { label: "Vendor", href: "/app/vendor" },
];

/** A round double-ring stamp mark (an empty stamp ring) next to the wordmark. */
// The brand mark (kuitansi + red DITOLAK stamp) — the same public/icon.svg used by the favicon and the landing page.
const Mark = () => <Image src="/icon.svg" alt="" width={32} height={32} priority unoptimized aria-hidden="true" />;

export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--bg)]/95 backdrop-blur">
      {/* At 375px: row 1 = logo + wallet, row 2 = the three roles. From sm up: logo · roles · wallet on one row. */}
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-4 lg:px-8 py-2">
        <Link href="/app" className="mb-logo order-1 flex items-center gap-2" aria-label="Mabrur — beranda aplikasi">
          <Mark />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26 }}>Mabrur</span>
        </Link>
        <nav className="mb-nav order-3 sm:order-2 w-full sm:w-auto flex flex-wrap gap-1 text-[15px]" aria-label="Peran">
          {menuLinks.map(l => (
            <Link key={l.href} href={l.href} aria-current={pathname?.startsWith(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="order-2 sm:order-3 ml-auto flex items-center gap-2">
          <Link
            href="/judge"
            className="mb-link text-sm font-bold px-1 hidden sm:inline"
            aria-current={pathname === "/judge" ? "page" : undefined}
          >
            Untuk juri
          </Link>
          {/* wrapper carries the breakpoint: .mb-chip's own display would beat a utility class */}
          <span className="hidden lg:inline-flex">
            <span className="mb-chip mb-chip-ink text-xs" title="tIDR is a test token with no value">
              {targetNetwork.name} · tIDR tanpa nilai
            </span>
          </span>
          <RainbowKitCustomConnectButton />
          {isLocalNetwork && <FaucetButton />}
        </div>
      </div>
    </header>
  );
};
