"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { LangToggle } from "~~/components/mabrur/LangToggle";
import { NetToggle } from "~~/components/mabrur/NetToggle";
import { T } from "~~/components/mabrur/T";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useT } from "~~/hooks/mabrur/useLang";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";

export const menuLinks = [
  { label: "Jamaah", en: "Pilgrim", href: "/app/jamaah" },
  { label: "Agen", en: "Agency", href: "/app/agen" },
  { label: "Vendor", en: "Vendor", href: "/app/vendor" },
];

// The brand mark (kuitansi + DITOLAK seal, v2 colours) — the same public/icon.svg used by the favicon and the landing page.
const Mark = () => <Image src="/icon.svg" alt="" width={32} height={32} priority unoptimized aria-hidden="true" />;

export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const pathname = usePathname();
  const t = useT();

  return (
    <header className="mb-header sticky top-0 z-20 border-b">
      {/* At 375px: row 1 = logo + network toggle, row 2 = language + wallet, row 3 = the roles + judges. From sm up:
          one 72px row. */}
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-x-7 gap-y-0 px-4 lg:px-8 py-2">
        <Link
          href="/app"
          className="mb-logo order-1 flex items-center gap-2.5"
          aria-label={t("Mabrur — beranda aplikasi", "Mabrur — app home")}
        >
          <Mark />
          <span className="mb-wordmark">Mabrur</span>
        </Link>
        <div className="order-3 sm:order-2 w-full sm:w-auto flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-[var(--rule)] sm:border-t-0 mt-2 sm:mt-0 pt-1 sm:pt-0">
          <nav className="mb-nav flex flex-wrap items-center gap-x-6 gap-y-1" aria-label={t("Peran", "Roles")}>
            {menuLinks.map(l => (
              <Link key={l.href} href={l.href} aria-current={pathname?.startsWith(l.href) ? "page" : undefined}>
                <T id={l.label} en={l.en} />
              </Link>
            ))}
          </nav>
          <Link
            href="/judge"
            className="mb-navlink ml-auto sm:ml-0"
            aria-current={pathname === "/judge" ? "page" : undefined}
          >
            <T id="Untuk juri" en="For judges" />
          </Link>
        </div>
        {/* Network chip + Mainnet | Testnet: beside the logo at 375px (so a connected wallet still fits row 2 next to
            the language pill); from sm up it joins the right-hand controls (from xl, on one row, -mr cancels the outer gap to their 10px). */}
        <div className="order-1 ml-auto sm:order-3 xl:-mr-[18px] flex items-center gap-2.5">
          {/* wrapper carries the breakpoint: .mb-chip's own display would beat a utility class */}
          <span className="hidden xl:inline-flex">
            <span
              className="mb-chip mb-chip-muted"
              title={t("tIDR adalah token uji tanpa nilai", "tIDR is a test token with no value")}
            >
              {targetNetwork.name} · <T id="tIDR tanpa nilai" en="tIDR, no value" />
            </span>
          </span>
          <NetToggle />
        </div>
        <div className="order-2 sm:order-3 ml-auto sm:ml-0 flex items-center gap-2.5">
          <LangToggle />
          <RainbowKitCustomConnectButton />
          {isLocalNetwork && <FaucetButton />}
        </div>
      </div>
    </header>
  );
};
