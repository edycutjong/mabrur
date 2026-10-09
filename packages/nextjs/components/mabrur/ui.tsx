"use client";

import { ReactNode, useEffect, useState } from "react";
import { Address } from "viem";
import { T } from "~~/components/mabrur/T";
import { useT } from "~~/hooks/mabrur/useLang";
import { explorerAddr, explorerTx, useMabrurContracts } from "~~/hooks/mabrur/useMabrur";
import { useCopyToClipboard, useScaffoldReadContract, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { DecodedRevert, errorArgParts } from "~~/utils/mabrur/errors";
import { TOPICS, formatRp, inWords, shortHex, terbilang } from "~~/utils/mabrur/format";
import { getLabel } from "~~/utils/mabrur/names";

export { T };

/** A bilingual span: Indonesian in ID mode, English in EN mode (see <T/>). Without `en` the text is the same in both. */
export const Bi = ({ id, en, className = "" }: { id: ReactNode; en?: ReactNode; className?: string }) => (
  <span className={className}>{en ? <T id={id} en={en} /> : id}</span>
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
        <T id={`Terbilang: ${terbilang(value)}`} en={`In words: ${inWords(value)}`} />
      </span>
    )}
  </span>
);

export type StampKind = "ditolak" | "lunas" | "dikembalikan" | "simulasi";

/** `Name(arg, arg)` with each shortened arg carrying its full value on hover. */
export const ErrorCall = ({ name, args }: { name: string; args: { short: string; full: string }[] }) => (
  <span>
    {name}(
    {args.map((a, i) => (
      <span key={i}>
        {i > 0 && ", "}
        {a.short !== a.full ? (
          <abbr title={a.full} className="no-underline cursor-help">
            {a.short}
          </abbr>
        ) : (
          a.short
        )}
      </span>
    ))}
    )
  </span>
);

// DITOLAK / LUNAS / DIKEMBALIKAN are the brand: the same seal in both languages. Only the neutral dry-run
// stamp (never a real outcome) is translated.
const STAMP_WORD: Record<StampKind, { id: string; en: string }> = {
  ditolak: { id: "Ditolak", en: "Ditolak" },
  lunas: { id: "Lunas", en: "Lunas" },
  dikembalikan: { id: "Dikembalikan", en: "Dikembalikan" },
  simulasi: { id: "Lolos simulasi", en: "Would pass" },
};

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
  const t = useT();
  const w = STAMP_WORD[kind];
  const word = t(w.id, w.en);
  const tone = kind === "simulasi" ? "mb-stamp-sim" : `mb-stamp-${kind}`;
  return (
    <div
      className={`mb-stamp ${tone} ${small ? "mb-stamp-sm" : ""} ${className}`}
      role="status"
      aria-label={error ? `${word}: ${error.name}` : word}
    >
      <div className="mb-stamp-word">
        <T id={w.id} en={w.en} />
      </div>
      {kind === "simulasi" && (
        <div className="mb-stamp-note">
          <T id="simulasi · belum dikirim" en="dry run · not sent" />
        </div>
      )}
      {error && (
        <div className="mb-stamp-error">
          <ErrorCall name={error.name} args={errorArgParts(error)} />
        </div>
      )}
      {children && <div className="mb-stamp-detail">{children}</div>}
    </div>
  );
};

/** DITOLAK stamp + error name + the reason in the reader's language. */
export const RevertStamp = ({ d, simulated }: { d: DecodedRevert; simulated?: boolean }) => (
  <div className="flex flex-col gap-2">
    <Stamp kind="ditolak" error={d} />
    <div className="flex flex-col gap-0.5">
      <span className="mb-refused-text font-medium">
        <T id={d.id} en={d.en} />
      </span>
      {simulated && (
        <span className="text-sm mb-muted">
          <T
            id={
              <>
                Pratinjau <span className="mb-data text-sm">simulateContract</span> — tidak ada transaksi dikirim
              </>
            }
            en={
              <>
                <span className="mb-data text-sm">simulateContract</span> preview — nothing was sent
              </>
            }
          />
        </span>
      )}
    </div>
  </div>
);

/** Drawn 1.5px-stroke check (no ✓ glyph as an icon). */
export const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="M2.5 6.3l2.2 2.2 4.8-5" strokeLinejoin="round" />
  </svg>
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
    <span className="mb-chip mb-chip-paid" title="registry.hasValidClaim = true">
      {TOPICS[topic] === "PPIU" ? <T id="Berizin PPIU" en="PPIU licensed" /> : TOPICS[topic]}
      <CheckIcon />
    </span>
  ) : (
    <span className="mb-chip mb-chip-muted" title="registry.hasValidClaim = false">
      <T id={`tanpa klaim ${TOPICS[topic]}`} en={`no ${TOPICS[topic]} claim`} />
    </span>
  );
};

export const AddressChip = ({ address, topic, name }: { address?: string; topic?: number; name?: string }) => {
  const { chainId } = useMabrurContracts();
  const { targetNetwork } = useTargetNetwork();
  const [label, setLabelState] = useState<string | undefined>(name);
  useEffect(() => setLabelState(name ?? getLabel(address, chainId)), [address, name, chainId]);
  if (!address) return <span className="mb-muted">–</span>;
  const href = explorerAddr(chainId, address, targetNetwork.blockExplorers?.default?.url);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {label && <span className="font-medium">{label}</span>}
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
      className="mb-data mb-link mb-muted text-[12.5px] whitespace-nowrap [word-break:normal]"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={hash}
    >
      tx {shortHex(hash, 8, 6)}
    </a>
  ) : (
    <span className="mb-data mb-muted text-[12.5px]">tx {shortHex(hash, 8, 6)}</span>
  );
};

export const CopyButton = ({ text, label }: { text: string; label?: ReactNode }) => {
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();
  return (
    <button type="button" className="mb-btn mb-btn-ghost mb-btn-sm" onClick={() => copyToClipboard(text)}>
      {isCopiedToClipboard ? (
        <>
          <T id="Tersalin" en="Copied" />
          <CheckIcon />
        </>
      ) : (
        (label ?? <T id="Salin" en="Copy" />)
      )}
    </button>
  );
};

/** Shown instead of a screen when the connected chain has no Mabrur deployment. */
export const ContractsGuard = ({ children }: { children: ReactNode }) => {
  const { ready, isLoading, chainName, chainId } = useMabrurContracts();
  if (ready) return <>{children}</>;
  return (
    <div className="mb-sheet max-w-2xl mx-auto mt-10">
      <Label>
        <T id="Jaringan" en="Network" />
      </Label>
      <p className="mb-p mt-2">
        {isLoading ? (
          <T id="Memuat kontrak…" en="Loading contracts…" />
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
