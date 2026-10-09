"use client";

import { useMemo, useState } from "react";
import { Hex } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { AddressChip, Bi, CopyButton, Label, RevertStamp, Rp, Stamp, TxLink } from "~~/components/mabrur/ui";
import { deriveLines, useBookingLedger } from "~~/hooks/mabrur/useLedger";
import { Booking, ZERO, eventsFrom, useChainNow, useMabrurContracts, useMabrurTx } from "~~/hooks/mabrur/useMabrur";
import { DecodedRevert, decodeRevert } from "~~/utils/mabrur/errors";
import { LINES, formatCountdown, formatDateWIB, formatRp, idHex, shortHex } from "~~/utils/mabrur/format";
import { DEPARTURE_TYPES, pbmDomain, refToLabel } from "~~/utils/mabrur/invoice";
import { getLabel } from "~~/utils/mabrur/names";

const LineCard = ({ i, st }: { i: number; st: ReturnType<typeof deriveLines>[number] }) => {
  const L = LINES[i];
  const wash =
    st.state === "earmarked" || st.state === "partial" ? "mb-wash-before" : st.state === "empty" ? "" : "mb-wash-after";
  return (
    <div className={`mb-sheet ${wash} flex flex-col gap-2 overflow-hidden`} style={{ minHeight: 170 }}>
      <div className="flex items-start justify-between gap-2">
        <Bi id={<span className="font-bold">{L.id}</span>} en={L.en !== L.id ? L.en : undefined} />
        {(st.state === "earmarked" || st.state === "partial") && (
          <span className="mb-chip mb-chip-before">Disimpan</span>
        )}
      </div>
      <div className="text-sm">
        <Bi id={L.ruleId} en={L.ruleEn} />
      </div>
      <div className="mt-auto">
        <Label>Sisa · remaining</Label>
        <Rp value={st.remaining} />
        {st.original !== undefined && st.original !== st.remaining && (
          <div className="text-sm mb-muted mb-num">dari {formatRp(st.original)}</div>
        )}
      </div>
      {st.state === "lunas" && (
        <div className="flex flex-col gap-1 items-start">
          <Stamp kind="lunas" small>
            {st.spent[0] ? formatRp(st.spent[0].amount) : null}
          </Stamp>
          {st.spent.map(s => (
            <div key={s.hash} className="text-sm flex flex-wrap gap-2 items-center">
              {s.to && <AddressChip address={s.to} />}
              {s.ref && <span className="mb-data text-sm">{refToLabel(s.ref)}</span>}
              {s.hash && <TxLink hash={s.hash} />}
            </div>
          ))}
        </div>
      )}
      {st.state === "returned" && (
        <div className="mb-after-text font-bold text-sm">
          Dikembalikan {st.refunded !== undefined ? formatRp(st.refunded) : ""} · returned
        </div>
      )}
    </div>
  );
};

export const Passbook = ({ b, name }: { b: Booking; name?: string }) => {
  const { now } = useChainNow();
  const { pbm, chainId } = useMabrurContracts();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { run, busy } = useMabrurTx();
  const { data: ledger, isError: ledgerError } = useBookingLedger(b);
  const lines = useMemo(() => deriveLines(b, ledger), [b, ledger]);
  const who = name ?? getLabel(b.pilgrim, chainId) ?? "Jamaah";

  const [depSig, setDepSig] = useState<Hex | undefined>();
  const [depErr, setDepErr] = useState<DecodedRevert | undefined>();
  const [refundOutcome, setRefundOutcome] = useState<{ amount: bigint; caller: string; hash: string } | undefined>();
  const [refundErr, setRefundErr] = useState<DecodedRevert | undefined>();
  const [releaseHash, setReleaseHash] = useState<string | undefined>();

  const total = b.remaining.reduce((x, y) => x + y, 0n);
  const flightPaid = b.flightVendor !== ZERO;
  const departed = b.departed || b.marginReleased;
  const departPassed = !departed && !b.refunded && now > Number(b.departBy);
  const ticketPassed = !flightPaid && !b.refunded && now > Number(b.ticketBy);
  const daysLeft = Math.ceil((Number(b.departBy) - now) / 86400);
  const canRefund = b.refundable && !b.refunded && total > 0n;
  const isPilgrim = address?.toLowerCase() === b.pilgrim.toLowerCase();
  const refundRow = ledger?.find(r => r.kind === "Refunded");

  const signDeparture = async () => {
    setDepErr(undefined);
    if (!walletClient || !pbm) return;
    try {
      const sig = await walletClient.signTypedData({
        domain: pbmDomain(chainId, pbm.address),
        types: DEPARTURE_TYPES,
        primaryType: "Departure",
        message: { bookingId: b.id },
      });
      setDepSig(sig);
    } catch (e) {
      setDepErr(decodeRevert(e));
    }
  };

  const submitRelease = async () => {
    if (!pbm || !depSig) return;
    setDepErr(undefined);
    const out = await run({ address: pbm.address, abi: pbm.abi, functionName: "releaseMargin", args: [b.id, depSig] });
    if (out.kind === "mined") setReleaseHash(out.hash);
    else if (out.kind === "reverted" || out.kind === "failed") setDepErr(out.decoded);
  };

  const doRefund = async () => {
    if (!pbm) return;
    setRefundErr(undefined);
    const out = await run({ address: pbm.address, abi: pbm.abi, functionName: "refund", args: [b.id] });
    if (out.kind === "mined") {
      const ev = eventsFrom(out.receipt, pbm.abi, pbm.address).find(e => e.eventName === "Refunded");
      setRefundOutcome({ amount: ev?.args.amount ?? total, caller: ev?.args.caller ?? address ?? "", hash: out.hash });
    } else if (out.kind === "reverted" || out.kind === "failed") setRefundErr(out.decoded);
  };

  const depJson = depSig
    ? JSON.stringify({ type: "Departure", bookingId: idHex(b.id), signature: depSig, signer: address }, null, 2)
    : "";

  return (
    <article className="flex flex-col gap-5">
      {/* Header: the kuitansi */}
      <div className="mb-sheet">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <Label>No. kuitansi · booking id</Label>
            <div className="mb-data" title={idHex(b.id)}>
              {shortHex(idHex(b.id), 10, 8)} <CopyButton text={idHex(b.id)} label="Salin id" />
            </div>
          </div>
          <div className="md:text-right">
            <Label>Sudah terima dari</Label>
            <AddressChip address={b.pilgrim} name={name} />
          </div>
        </div>
        <div className="mt-3">
          <Label>Agen</Label>
          <AddressChip address={b.agency} topic={1} />
        </div>
        <div className="mb-perforation" />

        <Label>Berangkat paling lambat · depart by</Label>
        <div className={`mb-big-date ${departPassed ? "mb-strike" : ""}`}>{formatDateWIB(b.departBy, false)}</div>
        <div className="mt-1">
          {b.refunded ? (
            <span className="mb-muted font-bold">
              Dana sudah dikembalikan ke {who} <span className="mb-en">Refunded — this booking is closed</span>
            </span>
          ) : departed ? (
            <span className="mb-chip mb-chip-after">Sudah berangkat · departed</span>
          ) : departPassed ? (
            <span className="mb-refused-text font-bold">Batas berangkat lewat — siapa pun bisa refund</span>
          ) : (
            <span className="mb-num">
              {formatDateWIB(b.departBy)} · {daysLeft} hari lagi <span className="mb-en">{daysLeft} days left</span>
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Label>Batas tiket · ticket by</Label>
          <span className={`mb-num ${ticketPassed ? "mb-strike" : ""}`}>{formatDateWIB(b.ticketBy)}</span>
          {flightPaid ? (
            <span className="mb-chip mb-chip-wrap mb-chip-after">
              Tiket dibayar {lines[0].spent[0] ? formatRp(lines[0].spent[0].amount) : ""} ke{" "}
              {getLabel(b.flightVendor, chainId) ?? shortHex(b.flightVendor)}
            </span>
          ) : b.refunded ? (
            <span className="mb-chip mb-chip-wrap mb-chip-muted">Tiket tidak dibeli · dana dikembalikan</span>
          ) : ticketPassed ? (
            <span className="mb-chip mb-chip-wrap mb-chip-refused">Batas tiket lewat — tiket belum dibayar</span>
          ) : (
            <span className="mb-chip mb-chip-wrap mb-chip-before">
              Tiket belum dibayar · {formatCountdown(Number(b.ticketBy) - now)}
            </span>
          )}
        </div>
        <p className="mb-p mt-2 text-sm mb-muted">
          Jika tiket pesawat belum dibayar sampai batas tiket, atau belum berangkat sampai batas berangkat, siapa pun
          bisa mengembalikan sisa dana ke jamaah.
          <span className="mb-en">
            If no ticket is paid by the ticket-by date, or no departure by the depart-by date, anyone can return the
            remaining money.
          </span>
        </p>
      </div>

      {/* Four lines */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {lines.map((st, i) => (
          <LineCard key={i} i={i} st={st} />
        ))}
      </div>
      <div className="flex flex-wrap items-baseline gap-3">
        <Label>Total sisa dana amanah</Label>
        <Rp value={total} words />
      </div>

      {/* Refund */}
      {(canRefund || b.refunded || refundOutcome) && (
        <div className={`mb-sheet ${b.refunded ? "mb-wash-after" : ""}`}>
          <Label>Pengembalian dana · refund</Label>
          {canRefund && !refundOutcome && (
            <>
              <p className="mb-p mt-2">
                <Bi
                  id="Siapa pun boleh menekan tombol ini — tetangga, ustaz, atau regulator."
                  en="Anyone may press this — a neighbour, a teacher, or the regulator."
                />
              </p>
              <button className="mb-btn mt-3" disabled={busy || !walletClient} onClick={doRefund}>
                Kembalikan {formatRp(total)} ke {who}
              </button>
              {!walletClient && <div className="text-sm mb-muted mt-1">Hubungkan dompet apa saja untuk menekan.</div>}
            </>
          )}
          {(refundOutcome || refundRow) && (
            <div className="mt-3 flex flex-col gap-2 items-start">
              <Stamp kind="dikembalikan">
                {formatRp(refundOutcome?.amount ?? refundRow?.amount)} ke {who}
              </Stamp>
              <div className="text-sm flex flex-wrap gap-2 items-center">
                <span>Ditekan oleh · pressed by</span>
                <AddressChip address={refundOutcome?.caller ?? refundRow?.counterparty} />
                <TxLink hash={(refundOutcome?.hash ?? refundRow?.hash) as string} />
              </div>
            </div>
          )}
          {b.refunded && !refundOutcome && !refundRow && (
            <div className="mt-3">
              <Stamp kind="dikembalikan">ke {who}</Stamp>
            </div>
          )}
          {refundErr && (
            <div className="mt-3">
              <RevertStamp d={refundErr} />
            </div>
          )}
        </div>
      )}

      {/* Departure signature — only after FLIGHT is paid */}
      {!b.refunded && (
        <div className="mb-sheet">
          <Label>Tanda tangan keberangkatan · departure signature</Label>
          {b.marginReleased ? (
            <p className="mb-p mt-2">
              <Bi id="Ujrah agen sudah dibuka setelah keberangkatan." en="The agency fee was released on departure." />
            </p>
          ) : !flightPaid ? (
            <p className="mb-p mt-2 mb-muted">
              <Bi id="Tersedia setelah tiket pesawat lunas." en="Available once the flight ticket is paid." />
            </p>
          ) : (
            <>
              <p className="mb-p mt-2">
                <Bi
                  id={`Tanda tangani keberangkatan — membuka ujrah agen ${formatRp(b.remaining[3])}`}
                  en="Sign your departure — this unlocks the agency fee"
                />
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <button className="mb-btn" disabled={!isPilgrim || busy} onClick={signDeparture}>
                  Tanda tangani keberangkatan
                </button>
                {depSig && (
                  <button className="mb-btn mb-btn-ghost" disabled={busy} onClick={submitRelease}>
                    Kirim releaseMargin
                  </button>
                )}
              </div>
              {!isPilgrim && (
                <div className="text-sm mb-muted mt-1">Hanya dompet jamaah ini yang bisa menandatangani.</div>
              )}
              {depSig && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Label>Tanda tangan · paste into the agency console</Label>
                    <CopyButton text={depJson} />
                  </div>
                  <pre className="mb-textarea whitespace-pre-wrap [overflow-wrap:anywhere]" style={{ minHeight: 0 }}>
                    {depJson}
                  </pre>
                </div>
              )}
              {releaseHash && (
                <div className="mt-3 flex items-center gap-3">
                  <Stamp kind="lunas" small>
                    ujrah
                  </Stamp>
                  <TxLink hash={releaseHash} />
                </div>
              )}
              {depErr && (
                <div className="mt-3">
                  <RevertStamp d={depErr} simulated={depErr.isRevert} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Ledger */}
      <div className="mb-sheet">
        <Label>Buku tabungan amanah · passbook</Label>
        {ledgerError || !ledger ? (
          <p className="mb-p mt-2 text-sm mb-muted">
            {ledgerError
              ? "Riwayat event tidak tersedia dari RPC ini — saldo di atas dibaca langsung dari kontrak."
              : "Memuat riwayat…"}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[480px] mt-2 text-left">
              <thead>
                <tr className="mb-label">
                  <th className="py-2 pr-2">Tanggal</th>
                  <th className="py-2 pr-2">Keterangan</th>
                  <th className="py-2 pr-2 text-right">Keluar</th>
                  <th className="py-2 text-right">Sisa</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let bal = 0n;
                  return ledger.map(r => {
                    if (r.kind === "Booked") bal = r.amount;
                    else bal -= r.amount;
                    const desc =
                      r.kind === "Booked"
                        ? "Pemesanan · booked"
                        : r.kind === "Spent"
                          ? `${LINES[r.line ?? 0].id} → ${getLabel(r.counterparty, chainId) ?? shortHex(r.counterparty)}${r.ref ? ` · ${refToLabel(r.ref)}` : ""}`
                          : r.kind === "MarginReleased"
                            ? "Ujrah agen setelah berangkat"
                            : `Dikembalikan ke ${who}`;
                    return (
                      <tr key={`${r.hash}-${r.logIndex}`} className="border-t border-[var(--rule)] align-top">
                        <td className="py-2 pr-2 text-sm mb-num">{r.timestamp ? formatDateWIB(r.timestamp) : "–"}</td>
                        <td className="py-2 pr-2 text-sm">
                          {desc} <TxLink hash={r.hash} />
                        </td>
                        <td className="py-2 pr-2 text-right mb-num whitespace-nowrap">
                          {r.kind === "Booked" ? "–" : formatRp(r.amount)}
                        </td>
                        <td className="py-2 text-right mb-num font-bold whitespace-nowrap">{formatRp(bal)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
        <p className="mb-p mt-3 text-sm mb-muted">
          Saldo mUMRAH Anda = sisa dana amanah Anda. Tidak bisa dipindah ke orang lain.
          <span className="mb-en">Your mUMRAH balance is your remaining prepayment. It cannot be transferred.</span>
        </p>
      </div>
    </article>
  );
};
