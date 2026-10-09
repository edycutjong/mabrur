"use client";

import { ReactNode, useEffect, useState } from "react";
import { Address } from "viem";
import { explorerAddr, explorerTx, useMabrurContracts } from "~~/hooks/mabrur/useMabrur";
import { useCopyToClipboard, useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { DecodedRevert, formatErrorCall } from "~~/utils/mabrur/errors";
import { TOPICS, formatRp, shortHex, terbilang } from "~~/utils/mabrur/format";
import { getLabel } from "~~/utils/mabrur/names";

export const Bi = ({ id, en, className = "" }: { id: ReactNode; en?: ReactNode; className?: string }) => (
  <span className={className}>
    {id}
    {en && <span className="mb-en">{en}</span>}
  </span>
);

export const Label = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`mb-label ${className}`}>{children}</div>
);

export const Rp = ({
  value,
  words = false,
  className = "",
}: {
  value?: bigint;
  words?: boolean;
  className?: string;
}) => (
  <span className={className}>
    <span className="mb-amount">{formatRp(value)}</span>
    {words && value !== undefined && (
      <span className="mb-terbilang block">
        Terbilang: <span>{terbilang(value)}</span>
      </span>
    )}
  </span>
);

export type StampKind = "ditolak" | "lunas" | "dikembalikan";

export const Stamp = ({
  kind,
  error,
  children,
  small = false,
  className = "",
}: {
  kind: StampKind;
  error?: DecodedRevert;
  children?: ReactNode;
  small?: boolean;
  className?: string;
}) => {
  const word = kind === "ditolak" ? "Ditolak" : kind === "lunas" ? "Lunas" : "Dikembalikan";
  return (
    <div
      className={`mb-stamp ${kind === "ditolak" ? "" : "mb-stamp-after"} ${small ? "mb-stamp-sm" : ""} ${className}`}
      role="status"
      aria-label={error ? `${word}: ${error.name}` : word}
    >
      <div className="mb-stamp-word">{word}</div>
      {error && <div className="mb-stamp-error">{formatErrorCall(error)}</div>}
      {children && <div className="text-sm font-bold mt-1">{children}</div>}
    </div>
  );
};

/** DITOLAK stamp + error name + Indonesian reason + English line. */
export const RevertStamp = ({ d, simulated }: { d: DecodedRevert; simulated?: boolean }) => (
  <div className="flex flex-col gap-2">
    <Stamp kind="ditolak" error={d} />
    <div>
      <span className="mb-refused-text font-bold">{d.id}</span>
      <span className="mb-en">{d.en}</span>
      {simulated && (
        <span className="mb-en">
          Pratinjau <span className="mb-data text-sm">simulateContract</span> — tidak ada transaksi dikirim · simulated,
          nothing sent
        </span>
      )}
    </div>
  </div>
);

export const ClaimBadge = ({ address, topic }: { address?: string; topic: number }) => {
  const { data: ok, isLoading } = useScaffoldReadContract({
    contractName: "ClaimRegistry",
    functionName: "hasValidClaim",
    args: [address as Address | undefined, BigInt(topic)],
    query: { enabled: Boolean(address) },
  });
  if (!address) return null;
  if (isLoading || ok === undefined) return <span className="mb-chip mb-chip-muted">{TOPICS[topic]} …</span>;
  return ok ? (
    <span className="mb-chip mb-chip-ink" title="registry.hasValidClaim = true">
      {TOPICS[topic] === "PPIU" ? "Berizin PPIU" : TOPICS[topic]} ✓
    </span>
  ) : (
    <span className="mb-chip mb-chip-muted" title="registry.hasValidClaim = false">
      tanpa klaim {TOPICS[topic]}
    </span>
  );
};

export const AddressChip = ({ address, topic, name }: { address?: string; topic?: number; name?: string }) => {
  const { chainId } = useMabrurContracts();
  const { targetNetwork } = useTargetNetwork();
  const [label, setLabelState] = useState<string | undefined>(name);
  useEffect(() => setLabelState(name ?? getLabel(address)), [address, name]);
  if (!address) return <span className="mb-muted">–</span>;
  const href = explorerAddr(chainId, address, targetNetwork.blockExplorers?.default?.url);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {label && <span className="font-bold">{label}</span>}
      {href ? (
        <a className="mb-data mb-link" href={href} target="_blank" rel="noreferrer" title={address}>
          {shortHex(address)}
        </a>
      ) : (
        <span className="mb-data" title={address}>
          {shortHex(address)}
        </span>
      )}
      {topic !== undefined && <ClaimBadge address={address} topic={topic} />}
    </span>
  );
};

export const TxLink = ({ hash }: { hash: string }) => {
  const { chainId } = useMabrurContracts();
  const { targetNetwork } = useTargetNetwork();
  const href = explorerTx(chainId, hash, targetNetwork.blockExplorers?.default?.url);
  return href ? (
    <a
      className="mb-data mb-link text-sm whitespace-nowrap [word-break:normal]"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={hash}
    >
      tx {shortHex(hash, 8, 6)}
    </a>
  ) : (
    <span className="mb-data text-sm">tx {shortHex(hash, 8, 6)}</span>
  );
};

export const CopyButton = ({ text, label = "Salin" }: { text: string; label?: string }) => {
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();
  return (
    <button type="button" className="mb-btn mb-btn-ghost mb-btn-sm" onClick={() => copyToClipboard(text)}>
      {isCopiedToClipboard ? "Tersalin ✓" : label}
    </button>
  );
};

/** Shown instead of a screen when the connected chain has no Mabrur deployment. */
export const ContractsGuard = ({ children }: { children: ReactNode }) => {
  const { ready, isLoading, chainName, chainId } = useMabrurContracts();
  if (ready) return <>{children}</>;
  return (
    <div className="mb-sheet max-w-2xl mx-auto mt-10">
      <Label>Jaringan · network</Label>
      <p className="mb-p mt-2">
        {isLoading ? (
          "Memuat kontrak… · loading contracts…"
        ) : (
          <Bi
            id={`Kontrak Mabrur belum ada di ${chainName} (${chainId}). Pindahkan dompet ke jaringan yang didukung.`}
            en={`No Mabrur deployment on ${chainName} (${chainId}). Switch your wallet to a supported network.`}
          />
        )}
      </p>
    </div>
  );
};

export const PageShell = ({ children }: { children: ReactNode }) => (
  <div className="w-full max-w-[1600px] mx-auto px-4 lg:px-8 py-6 lg:py-10">{children}</div>
);
