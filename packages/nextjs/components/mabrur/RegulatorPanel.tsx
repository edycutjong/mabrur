"use client";

import { Address, isAddress } from "viem";
import { AddressChip, Bi, CheckIcon, Label, T } from "~~/components/mabrur/ui";
import { useT } from "~~/hooks/mabrur/useLang";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatRp, inWords, terbilang } from "~~/utils/mabrur/format";

const CrossIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="M3 3l6 6M9 3l-6 6" />
  </svg>
);

/** Every figure is read from chain state at render time: regulatorView(agency) + conservation(). Nothing hard-coded. */
export const RegulatorPanel = ({ agency }: { agency?: string }) => {
  const t = useT();
  const a = agency && isAddress(agency) ? (agency as Address) : undefined;
  const { data: rv } = useScaffoldReadContract({
    contractName: "MabrurPBM",
    functionName: "regulatorView",
    args: [a],
  });
  const { data: cons } = useScaffoldReadContract({ contractName: "MabrurPBM", functionName: "conservation" });

  const [openBookings, liabilities, earmarked] = rv ?? [];
  const [sumEarmarks, wrappedSupply, underlyingHeld] = cons ?? [];
  const backed = cons ? underlyingHeld! >= wrappedSupply! && sumEarmarks === wrappedSupply : undefined;
  const surplus = cons ? underlyingHeld! - wrappedSupply! : undefined;

  const ledgersAgree = liabilities !== undefined && earmarked !== undefined && liabilities === earmarked;
  const m = backed ? "mb-match" : "";
  const am = ledgersAgree ? "mb-match" : "";

  return (
    <aside className="mb-sheet flex flex-col gap-4" aria-label={t("Panel regulator", "Regulator panel")}>
      <div className="flex flex-col gap-1">
        <Label>
          <T id="Panel regulator" en="Regulator view" />
        </Label>
        <span className="text-[13px] mb-muted leading-snug">
          <span className="mb-data text-[12.5px] text-(--ink)">regulatorView</span> +{" "}
          <span className="mb-data text-[12.5px] text-(--ink)">conservation()</span>,{" "}
          <T id="dibaca langsung dari kontrak" en="read live from the chain" />
        </span>
      </div>

      <div
        className={`rounded-[10px] p-5 ${backed ? "mb-wash-paid" : backed === false ? "mb-wash-refused" : "bg-[var(--surface)]"}`}
      >
        <div className={`mb-kpi ${backed === false ? "mb-refused-text" : ""}`}>{formatRp(wrappedSupply)}</div>
        <div className="mb-terbilang mt-1">
          {wrappedSupply !== undefined ? <T id={terbilang(wrappedSupply)} en={inWords(wrappedSupply)} /> : ""}
        </div>
        <p className="mb-p mt-3 font-medium leading-snug">
          {backed === undefined ? (
            <T id="Memuat…" en="Loading…" />
          ) : backed ? (
            <Bi
              id="dana jamaah masih tersimpan — 100% dijamin rupiah di dalam kontrak"
              en={`${formatRp(wrappedSupply)} of prepayments outstanding — 100% backed by rupiah held in-contract`}
            />
          ) : (
            <span className="mb-refused-text">
              <T id="Tidak seimbang — tidak dijamin penuh" en="Not fully backed" />
            </span>
          )}
        </p>
      </div>

      <dl className="mb-recon text-[14.5px]">
        <dt className={`min-w-0 leading-tight ${m}`}>
          <T id="Rupiah di kontrak" en="Rupiah held in-contract" />
        </dt>
        <dd className={`mb-amt ${m}`}>{formatRp(underlyingHeld)}</dd>
        <dt className={`min-w-0 leading-tight ${m}`}>
          <T id="mUMRAH beredar" en="mUMRAH supply (wrapped)" />
        </dt>
        <dd className={`mb-amt ${m}`}>{formatRp(wrappedSupply)}</dd>
        <dt className={`min-w-0 leading-tight ${m}`}>
          <T id="Σ pos tersimpan" en="Σ earmarks" />
        </dt>
        <dd className={`mb-amt ${m}`}>{formatRp(sumEarmarks)}</dd>
        <dt className="min-w-0 leading-tight mb-muted">
          <T id="Surplus" en="Surplus" />
        </dt>
        <dd className="mb-amt mb-muted">{formatRp(surplus)}</dd>
      </dl>
      <p className="mb-p text-[13px] mb-muted leading-snug">
        <T
          id="Surplus = tIDR yang dikirim langsung ke kontrak tanpa booking; bukan selisih, bukan kewajiban."
          en="Surplus is tIDR sent to the contract outside a booking — never a gap, never a liability."
        />
      </p>

      <div className="mb-perforation my-1" />

      <div className="flex flex-col gap-1">
        <Label>
          <T id="Agen" en="Agency" />
        </Label>
        {a ? (
          <AddressChip address={a} topic={1} />
        ) : (
          <span className="mb-muted">
            <T id="Pilih booking / isi alamat agen" en="Pick a booking / enter an agency address" />
          </span>
        )}
      </div>
      {a && (
        <dl className="mb-recon text-[14.5px]">
          <dt className="min-w-0 leading-tight">
            <T id="Booking terbuka" en="Open bookings" />
          </dt>
          <dd className="mb-amt">{openBookings?.toString() ?? "–"}</dd>
          <dt className={`min-w-0 leading-tight ${am}`}>
            <T id="Kewajiban ke jamaah" en="Liabilities to pilgrims" />
          </dt>
          <dd className={`mb-amt ${am}`}>{formatRp(liabilities)}</dd>
          <dt className={`min-w-0 leading-tight ${am}`}>
            <T id="Tersimpan per pos" en="Earmarked per line" />
          </dt>
          <dd className={`mb-amt ${am}`}>{formatRp(earmarked)}</dd>
        </dl>
      )}
      {a && liabilities !== undefined && earmarked !== undefined && (
        <p
          className={`mb-p text-[13.5px] leading-snug flex gap-2 items-start ${ledgersAgree ? "mb-paid-text" : "mb-refused-text"}`}
          data-agree={ledgersAgree}
        >
          <span className="mt-[3px] shrink-0 [&_svg]:w-[13px] [&_svg]:h-[13px]">
            {ledgersAgree ? <CheckIcon /> : <CrossIcon />}
          </span>
          <span>
            <span className="sr-only">
              {ledgersAgree ? <T id="Sesuai:" en="Match:" /> : <T id="Tidak sesuai:" en="Mismatch:" />}{" "}
            </span>
            <T
              id="Kewajiban (setoran − pembayaran) = Σ pos tersimpan: dua buku independen sama."
              en="Liabilities (deposits − payouts) equal Σ earmarks: two independent ledgers agree."
            />
          </span>
        </p>
      )}
      <p className="mb-p text-[13px] mb-muted leading-snug">
        <T
          id="Penerbit klaim: kunci demo, pengganti Kemenag / IATA. tIDR = token uji tanpa nilai."
          en="Claim issuer: a demo key standing in for Kemenag / IATA. tIDR = test token, no value."
        />
      </p>
    </aside>
  );
};
