"use client";

import { Address, isAddress } from "viem";
import { AddressChip, Bi, Label } from "~~/components/mabrur/ui";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { formatRp, terbilang } from "~~/utils/mabrur/format";

/** Every figure is read from chain state at render time: regulatorView(agency) + conservation(). Nothing hard-coded. */
export const RegulatorPanel = ({ agency }: { agency?: string }) => {
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
    <aside className="mb-sheet flex flex-col gap-4" aria-label="Panel regulator">
      <div>
        <Label>Panel regulator · regulator view</Label>
        <span className="text-sm mb-muted">
          <span className="mb-data text-sm">regulatorView</span> +{" "}
          <span className="mb-data text-sm">conservation()</span>, dibaca langsung dari kontrak · read live from chain
        </span>
      </div>

      <div className={`rounded-[10px] p-4 ${backed ? "mb-wash-after" : backed === false ? "mb-wash-refused" : ""}`}>
        <div className="mb-amount">{formatRp(wrappedSupply)}</div>
        <div className="mb-terbilang">{wrappedSupply !== undefined ? terbilang(wrappedSupply) : ""}</div>
        <p className="mb-p mt-2 font-bold">
          {backed === undefined ? (
            "Memuat…"
          ) : backed ? (
            <Bi
              id="dana jamaah masih tersimpan — 100% dijamin rupiah di dalam kontrak"
              en={`${formatRp(wrappedSupply)} of prepayments outstanding — 100% backed by rupiah held in-contract`}
            />
          ) : (
            <span className="mb-refused-text">Tidak seimbang · not fully backed</span>
          )}
        </p>
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 mb-num">
        <dt>Rupiah di kontrak · held</dt>
        <dd className="text-right font-bold">{formatRp(underlyingHeld)}</dd>
        <dt>mUMRAH beredar · wrapped supply</dt>
        <dd className="text-right font-bold">{formatRp(wrappedSupply)}</dd>
        <dt>Σ pos tersimpan · Σ earmarks</dt>
        <dd className="text-right font-bold">{formatRp(sumEarmarks)}</dd>
        <dt>Surplus (donasi langsung)</dt>
        <dd className="text-right">{formatRp(surplus)}</dd>
      </dl>
      <p className="mb-p text-sm mb-muted">
        Surplus = tIDR yang dikirim langsung ke kontrak tanpa booking; bukan selisih, bukan kewajiban.
        <span className="mb-en">Surplus is tIDR sent to the contract outside a booking — never a gap.</span>
      </p>

      <div className="mb-perforation" style={{ margin: "4px -20px" }} />

      <div>
        <Label>Agen</Label>
        {a ? <AddressChip address={a} topic={1} /> : <span className="mb-muted">Pilih booking / isi alamat agen</span>}
      </div>
      {a && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 mb-num">
          <dt>Booking terbuka · open</dt>
          <dd className="text-right font-bold">{openBookings?.toString() ?? "–"}</dd>
          <dt>Kewajiban ke jamaah · liabilities</dt>
          <dd className="text-right font-bold">{formatRp(liabilities)}</dd>
          <dt>Tersimpan per pos · earmarked</dt>
          <dd className="text-right font-bold">{formatRp(earmarked)}</dd>
        </dl>
      )}
      {a && liabilities !== undefined && earmarked !== undefined && (
        <p className="mb-p text-sm">
          {liabilities === earmarked ? "✓ " : "✗ "}
          Kewajiban (setoran − pembayaran) = Σ pos tersimpan: dua buku independen sama.
          <span className="mb-en">
            Liabilities (deposits − payouts) equal Σ earmarks: two independent ledgers agree.
          </span>
        </p>
      )}
      <p className="mb-p text-sm mb-muted">
        Penerbit klaim: kunci demo, pengganti Kemenag / IATA. tIDR = token uji tanpa nilai.
        <span className="mb-en">
          Claim issuer: a demo key standing in for Kemenag / IATA. tIDR is a valueless test token.
        </span>
      </p>
    </aside>
  );
};
