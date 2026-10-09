"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

export const menuLinks = [
  { label: "Jamaah", href: "/app/jamaah" },
  { label: "Agen", href: "/app/agen" },
  { label: "Vendor", href: "/app/vendor" },
  { label: "Debug", href: "/debug" },
];

/** A round double-ring stamp mark (an empty stamp ring) next to the wordmark. */
const Mark = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <circle cx="15" cy="15" r="13" fill="none" stroke="var(--ink)" strokeWidth="2.5" />
    <circle cx="15" cy="15" r="8.5" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
  </svg>
);

export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--bg)]/95 backdrop-blur">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 lg:px-8 py-2">
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/app" className="flex items-center gap-2">
            <Mark />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26 }}>Mabrur</span>
          </Link>
          <nav className="mb-nav flex flex-wrap gap-1 text-[15px]" aria-label="Peran">
            {menuLinks.map(l => (
              <Link key={l.href} href={l.href} aria-current={pathname?.startsWith(l.href) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="mb-chip mb-chip-ink text-xs" title="tIDR is a test token with no value">
            {targetNetwork.name} · tIDR tanpa nilai
          </span>
          <RainbowKitCustomConnectButton />
          {isLocalNetwork && <FaucetButton />}
        </div>
      </div>
    </header>
  );
};
