"use client";

import { Address, isAddress } from "viem";
import { AddressChip, Bi, Label, T } from "~~/components/mabrur/ui";
import { useT } from "~~/hooks/mabrur/useLang";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatRp, inWords, terbilang } from "~~/utils/mabrur/format";

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

  return (
    <aside className="mb-sheet flex flex-col gap-4" aria-label={t("Panel regulator", "Regulator panel")}>
      <div>
        <Label>
          <T id="Panel regulator" en="Regulator view" />
        </Label>
        <span className="text-sm mb-muted">
          <span className="mb-data text-sm">regulatorView</span> +{" "}
          <span className="mb-data text-sm">conservation()</span>,{" "}
          <T id="dibaca langsung dari kontrak" en="read live from the chain" />
        </span>
      </div>

      <div className={`rounded-[10px] p-4 ${backed ? "mb-wash-after" : backed === false ? "mb-wash-refused" : ""}`}>
        <div className="mb-amount">{formatRp(wrappedSupply)}</div>
        <div className="mb-terbilang">
          {wrappedSupply !== undefined ? <T id={terbilang(wrappedSupply)} en={inWords(wrappedSupply)} /> : ""}
        </div>
        <p className="mb-p mt-2 font-bold">
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

      <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-3 mb-num">
        <dt className="min-w-0 leading-tight">
          <T id="Rupiah di kontrak" en="Rupiah held in-contract" />
        </dt>
        <dd className="text-right font-bold whitespace-nowrap">{formatRp(underlyingHeld)}</dd>
        <dt className="min-w-0 leading-tight">
          <T id="mUMRAH beredar" en="mUMRAH supply (wrapped)" />
        </dt>
        <dd className="text-right font-bold whitespace-nowrap">{formatRp(wrappedSupply)}</dd>
        <dt className="min-w-0 leading-tight">
          <T id="Σ pos tersimpan" en="Σ earmarks" />
        </dt>
        <dd className="text-right font-bold whitespace-nowrap">{formatRp(sumEarmarks)}</dd>
        <dt className="min-w-0 leading-tight">
          <T id="Surplus" en="Surplus (direct donations)" />
        </dt>
        <dd className="text-right whitespace-nowrap">{formatRp(surplus)}</dd>
      </dl>
      <p className="mb-p text-sm mb-muted">
        <T
          id="Surplus = tIDR yang dikirim langsung ke kontrak tanpa booking; bukan selisih, bukan kewajiban."
          en="Surplus is tIDR sent to the contract outside a booking — never a gap, never a liability."
        />
      </p>

      <div className="mb-perforation" style={{ margin: "4px -20px" }} />

      <div>
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
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-3 mb-num">
          <dt className="min-w-0 leading-tight">
            <T id="Booking terbuka" en="Open bookings" />
          </dt>
          <dd className="text-right font-bold whitespace-nowrap">{openBookings?.toString() ?? "–"}</dd>
          <dt className="min-w-0 leading-tight">
            <T id="Kewajiban ke jamaah" en="Liabilities to pilgrims" />
          </dt>
          <dd className="text-right font-bold whitespace-nowrap">{formatRp(liabilities)}</dd>
          <dt className="min-w-0 leading-tight">
            <T id="Tersimpan per pos" en="Earmarked per line" />
          </dt>
          <dd className="text-right font-bold whitespace-nowrap">{formatRp(earmarked)}</dd>
        </dl>
      )}
      {a && liabilities !== undefined && earmarked !== undefined && (
        <p className="mb-p text-sm">
          <T
            id={`${liabilities === earmarked ? "✓" : "✗"} Kewajiban (setoran − pembayaran) = Σ pos tersimpan: dua buku independen sama.`}
            en={`${liabilities === earmarked ? "✓" : "✗"} Liabilities (deposits − payouts) equal Σ earmarks: two independent ledgers agree.`}
          />
        </p>
      )}
      <p className="mb-p text-sm mb-muted">
        <T
          id="Penerbit klaim: kunci demo, pengganti Kemenag / IATA. tIDR = token uji tanpa nilai."
          en="Claim issuer: a demo key standing in for Kemenag / IATA. tIDR = test token, no value."
        />
      </p>
    </aside>
  );
};
