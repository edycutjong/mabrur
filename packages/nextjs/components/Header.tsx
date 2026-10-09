"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { LangToggle } from "~~/components/mabrur/LangToggle";
import { T } from "~~/components/mabrur/T";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useT } from "~~/hooks/mabrur/useLang";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

export const menuLinks = [
  { label: "Jamaah", en: "Pilgrim", href: "/app/jamaah" },
  { label: "Agen", en: "Agency", href: "/app/agen" },
  { label: "Vendor", en: "Vendor", href: "/app/vendor" },
];

// The brand mark (kuitansi + red DITOLAK stamp) — the same public/icon.svg used by the favicon and the landing page.
const Mark = () => <Image src="/icon.svg" alt="" width={32} height={32} priority unoptimized aria-hidden="true" />;

export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const pathname = usePathname();
  const t = useT();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--bg)]/95 backdrop-blur">
      {/* At 375px: row 1 = logo + language + wallet, row 2 = the roles + judges. From sm up: one row. */}
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-4 lg:px-8 py-2">
        <Link
          href="/app"
          className="mb-logo order-1 flex items-center gap-2"
          aria-label={t("Mabrur — beranda aplikasi", "Mabrur — app home")}
        >
          <Mark />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26 }}>Mabrur</span>
        </Link>
        <div className="order-3 sm:order-2 w-full sm:w-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <nav className="mb-nav flex flex-wrap items-center gap-1 text-[15px]" aria-label={t("Peran", "Roles")}>
            {menuLinks.map(l => (
              <Link key={l.href} href={l.href} aria-current={pathname?.startsWith(l.href) ? "page" : undefined}>
                <T id={l.label} en={l.en} />
              </Link>
            ))}
          </nav>
          <Link
            href="/judge"
            className="mb-link text-sm font-bold px-1 ml-auto sm:ml-1"
            aria-current={pathname === "/judge" ? "page" : undefined}
          >
            <T id="Untuk juri" en="For judges" />
          </Link>
        </div>
        <div className="order-2 sm:order-3 ml-auto flex items-center gap-2">
          {/* wrapper carries the breakpoint: .mb-chip's own display would beat a utility class */}
          <span className="hidden lg:inline-flex">
            <span
              className="mb-chip mb-chip-ink text-xs"
              title={t("tIDR adalah token uji tanpa nilai", "tIDR is a test token with no value")}
            >
              {targetNetwork.name} · <T id="tIDR tanpa nilai" en="tIDR, no value" />
            </span>
          </span>
          <LangToggle />
          <RainbowKitCustomConnectButton />
          {isLocalNetwork && <FaucetButton />}
        </div>
      </div>
    </header>
  );
};
