"use client";

import { useMemo, useState } from "react";
import { Hex } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { T } from "~~/components/mabrur/T";
import { AddressChip, Bi, CopyButton, Label, RevertStamp, Rp, Stamp, TxLink } from "~~/components/mabrur/ui";
import { deriveLines, useBookingLedger } from "~~/hooks/mabrur/useLedger";
import { Booking, ZERO, eventsFrom, useChainNow, useMabrurContracts, useMabrurTx } from "~~/hooks/mabrur/useMabrur";
import { DecodedRevert, decodeRevert } from "~~/utils/mabrur/errors";
import { LINES, formatCountdown, formatDateWIB, formatRp, idHex, shortHex } from "~~/utils/mabrur/format";
import { DEPARTURE_TYPES, pbmDomain, refToLabel } from "~~/utils/mabrur/invoice";
import { getLabel } from "~~/utils/mabrur/names";

const LineCard = ({ i, st }: { i: number; st: ReturnType<typeof deriveLines>[number] }) => {
  const L = LINES[i];
  const held = st.state === "earmarked" || st.state === "partial";
  const wash = held
    ? "mb-wash-before"
    : st.state === "lunas"
      ? "mb-wash-paid"
      : st.state === "returned"
        ? "mb-wash-returned"
        : "";
  const amtTone = held
    ? "mb-before-text"
    : st.state === "lunas"
      ? "mb-paid-text"
      : st.state === "returned"
        ? "mb-returned-text"
        : "";
  return (
    <div className={`${wash} flex flex-col gap-3`} style={{ minHeight: 170 }}>
      <div className="mb-seal-row">
        <div className="min-w-0">
          <div className="mb-line-name">
            <Bi id={L.id} en={L.en !== L.id ? L.en : undefined} />
          </div>
          <div className="text-sm mb-muted mt-1">
            <Bi id={L.ruleId} en={L.ruleEn} />
          </div>
        </div>
        {held && (
          <span className="mb-held">
            <T id="Disimpan" en="Earmarked" />
          </span>
        )}
      </div>
      <div className={`mt-auto ${st.state === "lunas" ? "mb-seal-row" : ""}`}>
        <div className="min-w-0">
          <Label>
            <T id="Sisa" en="Remaining" />
          </Label>
          <Rp value={st.remaining} className={amtTone} />
          {st.original !== undefined && st.original !== st.remaining && (
            <div className="text-sm mb-muted mb-num">
              <T id={`dari ${formatRp(st.original)}`} en={`of ${formatRp(st.original)}`} />
            </div>
          )}
        </div>
        {st.state === "lunas" && (
          <Stamp kind="lunas" small>
            {st.spent[0] ? formatRp(st.spent[0].amount) : null}
          </Stamp>
        )}
      </div>
      {st.state === "lunas" && (
        <div className="flex flex-col gap-1 border-t border-dashed border-[#c7e2d6] pt-3">
          {st.spent.map(s => (
            <div key={s.hash} className="text-sm flex flex-wrap gap-x-2 gap-y-0.5 items-center">
              {s.to && <AddressChip address={s.to} />}
              {s.ref && <span className="mb-data text-[12.5px]">{refToLabel(s.ref)}</span>}
              {s.hash && <TxLink hash={s.hash} />}
            </div>
          ))}
        </div>
      )}
      {st.state === "returned" && (
        <div className="mb-returned-text font-medium text-sm">
          <T
            id={`Dikembalikan ${st.refunded !== undefined ? formatRp(st.refunded) : ""}`.trim()}
            en={`Returned ${st.refunded !== undefined ? formatRp(st.refunded) : ""}`.trim()}
          />
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
  const named = name ?? getLabel(b.pilgrim, chainId);
  const who = { id: named ?? "Jamaah", en: named ?? "the pilgrim" };

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
  const flightVendor = flightPaid ? (getLabel(b.flightVendor, chainId) ?? shortHex(b.flightVendor)) : "";

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
      <div className="mb-sheet mb-slip">
        <div className="flex items-baseline justify-between gap-3 mb-4 pb-4 border-b border-[var(--rule)]">
          <span className="mb-h2 text-[var(--returned)]">Kuitansi Amanah</span>
          <span className="mb-data mb-muted text-[12.5px]">mUMRAH</span>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <Label>
              <T id="No. kuitansi" en="Receipt no. (booking id)" />
            </Label>
            <div className="mb-data" title={idHex(b.id)}>
              {shortHex(idHex(b.id), 10, 8)} <CopyButton text={idHex(b.id)} label={<T id="Salin id" en="Copy id" />} />
            </div>
          </div>
          <div className="md:text-right">
            <Label>
              <T id="Sudah terima dari" en="Received from" />
            </Label>
            <AddressChip address={b.pilgrim} name={name} />
          </div>
        </div>
        <div className="mt-4">
          <Label>
            <T id="Agen" en="Agency" />
          </Label>
          <AddressChip address={b.agency} topic={1} />
        </div>
        <div className="mb-perforation" />

        <Label>
          <T id="Berangkat paling lambat" en="Depart by" />
        </Label>
        <div className={`mb-big-date ${departPassed ? "mb-strike" : ""}`}>
          <T id={formatDateWIB(b.departBy, false)} en={formatDateWIB(b.departBy, false, "en")} />
        </div>
        <div className="mt-1">
          {b.refunded ? (
            <span className="mb-returned-text font-medium">
              <T id={`Dana sudah dikembalikan ke ${who.id}`} en={`Refunded to ${who.en} — this booking is closed`} />
            </span>
          ) : departed ? (
            <span className="mb-chip mb-chip-paid">
              <T id="Sudah berangkat" en="Departed" />
            </span>
          ) : departPassed ? (
            <span className="mb-refused-text font-medium">
              <T id="Batas berangkat lewat — siapa pun bisa refund" en="Depart-by date passed — anyone can refund" />
            </span>
          ) : (
            <span className="mb-num">
              <T
                id={`${formatDateWIB(b.departBy)} · ${daysLeft} hari lagi`}
                en={`${formatDateWIB(b.departBy, true, "en")} · ${daysLeft} days left`}
              />
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Label>
            <T id="Batas tiket" en="Ticket by" />
          </Label>
          <span className={`mb-num ${ticketPassed ? "mb-strike" : ""}`}>
            <T id={formatDateWIB(b.ticketBy)} en={formatDateWIB(b.ticketBy, true, "en")} />
          </span>
          {flightPaid ? (
            <span className="mb-chip mb-chip-wrap mb-chip-paid">
              <T
                id={`Tiket dibayar ${lines[0].spent[0] ? formatRp(lines[0].spent[0].amount) : ""} ke ${flightVendor}`}
                en={`Ticket paid ${lines[0].spent[0] ? formatRp(lines[0].spent[0].amount) : ""} to ${flightVendor}`}
              />
            </span>
          ) : b.refunded ? (
            <span className="mb-chip mb-chip-wrap mb-chip-returned">
              <T id="Tiket tidak dibeli · dana dikembalikan" en="No ticket bought · money returned" />
            </span>
          ) : ticketPassed ? (
            <span className="mb-chip mb-chip-wrap mb-chip-refused">
              <T id="Batas tiket lewat — tiket belum dibayar" en="Ticket-by date passed — no ticket paid" />
            </span>
          ) : (
            <span className="mb-chip mb-chip-wrap mb-chip-before">
              <T
                id={`Tiket belum dibayar · ${formatCountdown(Number(b.ticketBy) - now)}`}
                en={`Ticket not paid yet · ${formatCountdown(Number(b.ticketBy) - now, "en")}`}
              />
            </span>
          )}
        </div>
        <p className="mb-p mt-3 text-sm mb-muted">
          <T
            id="Jika tiket pesawat belum dibayar sampai batas tiket, atau belum berangkat sampai batas berangkat, siapa pun bisa mengembalikan sisa dana ke jamaah."
            en="If no flight ticket is paid by the ticket-by date, or there is no departure by the depart-by date, anyone can return the remaining money to the pilgrim."
          />
        </p>
      </div>

      {/* Four lines */}
      <div className="mb-lines">
        {lines.map((st, i) => (
          <LineCard key={i} i={i} st={st} />
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 px-1 pb-1 border-b border-[var(--rule)]">
        <Label className="pb-2">
          <T id="Total sisa dana amanah" en="Total remaining prepayment" />
        </Label>
        <Rp value={total} words className="text-right ml-auto" />
      </div>

      {/* Refund */}
      {(canRefund || b.refunded || refundOutcome) && (
        <div className={`mb-sheet ${b.refunded ? "mb-wash-returned" : ""}`}>
          <Label>
            <T id="Pengembalian dana" en="Refund" />
          </Label>
          {canRefund && !refundOutcome && (
            <>
              <p className="mb-p mt-2">
                <Bi
                  id="Siapa pun boleh menekan tombol ini — tetangga, ustaz, atau regulator."
                  en="Anyone may press this — a neighbour, a teacher, or the regulator."
                />
              </p>
              <button className="mb-btn mt-3" disabled={busy || !walletClient} onClick={doRefund}>
                <T id={`Kembalikan ${formatRp(total)} ke ${who.id}`} en={`Return ${formatRp(total)} to ${who.en}`} />
              </button>
              {!walletClient && (
                <div className="text-sm mb-muted mt-1">
                  <T id="Hubungkan dompet apa saja untuk menekan." en="Connect any wallet to press it." />
                </div>
              )}
            </>
          )}
          {(refundOutcome || refundRow) && (
            <div className="mt-3 flex flex-col gap-2 items-start">
              <Stamp kind="dikembalikan">
                <T
                  id={`${formatRp(refundOutcome?.amount ?? refundRow?.amount)} ke ${who.id}`}
                  en={`${formatRp(refundOutcome?.amount ?? refundRow?.amount)} to ${who.en}`}
                />
              </Stamp>
              <div className="text-sm flex flex-wrap gap-2 items-center">
                <span>
                  <T id="Ditekan oleh" en="Pressed by" />
                </span>
                <AddressChip address={refundOutcome?.caller ?? refundRow?.counterparty} />
                <TxLink hash={(refundOutcome?.hash ?? refundRow?.hash) as string} />
              </div>
            </div>
          )}
          {b.refunded && !refundOutcome && !refundRow && (
            <div className="mt-3">
              <Stamp kind="dikembalikan">
                <T id={`ke ${who.id}`} en={`to ${who.en}`} />
              </Stamp>
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
          <Label>
            <T id="Tanda tangan keberangkatan" en="Departure signature" />
          </Label>
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
                  en={`Sign your departure — this unlocks the agency fee of ${formatRp(b.remaining[3])}`}
                />
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <button className="mb-btn" disabled={!isPilgrim || busy} onClick={signDeparture}>
                  <T id="Tanda tangani keberangkatan" en="Sign departure" />
                </button>
                {depSig && (
                  <button className="mb-btn mb-btn-ghost" disabled={busy} onClick={submitRelease}>
                    <T id="Kirim releaseMargin" en="Send releaseMargin" />
                  </button>
                )}
              </div>
              {!isPilgrim && (
                <div className="text-sm mb-muted mt-1">
                  <T id="Hanya dompet jamaah ini yang bisa menandatangani." en="Only this pilgrim's wallet can sign." />
                </div>
              )}
              {depSig && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Label>
                      <T id="Tanda tangan — tempel di konsol agen" en="Signature — paste into the agency console" />
                    </Label>
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
                    <T id="ujrah" en="agency fee" />
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
      <div className="mb-sheet mb-slip">
        <Label>
          <T id="Buku tabungan amanah" en="Passbook" />
        </Label>
        {ledgerError || !ledger ? (
          <p className="mb-p mt-2 text-sm mb-muted">
            {ledgerError ? (
              <T
                id="Riwayat event tidak tersedia dari RPC ini — saldo di atas dibaca langsung dari kontrak."
                en="Event history is not available from this RPC — the balances above are read straight from the contract."
              />
            ) : (
              <T id="Memuat riwayat…" en="Loading history…" />
            )}
          </p>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="mb-ledger sm:min-w-[520px] mt-3">
              <thead>
                <tr>
                  <th>
                    <T id="Tanggal" en="Date" />
                  </th>
                  <th className="!pl-[30px]">
                    <T id="Keterangan" en="Description" />
                  </th>
                  <th className="text-right!">
                    <T id="Keluar" en="Out" />
                  </th>
                  <th className="text-right!">
                    <T id="Sisa" en="Balance" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let bal = 0n;
                  return ledger.map(r => {
                    if (r.kind === "Booked") bal = r.amount;
                    else bal -= r.amount;
                    const spentTo = (): string =>
                      `${getLabel(r.counterparty, chainId) ?? shortHex(r.counterparty)}${r.ref ? ` · ${refToLabel(r.ref)}` : ""}`;
                    const desc =
                      r.kind === "Booked" ? (
                        <T id="Pemesanan" en="Booked" />
                      ) : r.kind === "Spent" ? (
                        <T
                          id={`${LINES[r.line ?? 0].id} → ${spentTo()}`}
                          en={`${LINES[r.line ?? 0].en} → ${spentTo()}`}
                        />
                      ) : r.kind === "MarginReleased" ? (
                        <T id="Ujrah agen setelah berangkat" en="Agency fee after departure" />
                      ) : (
                        <T id={`Dikembalikan ke ${who.id}`} en={`Returned to ${who.en}`} />
                      );
                    const node = r.kind === "Refunded" ? "mb-node-returned" : r.kind === "Booked" ? "" : "mb-node-paid";
                    return (
                      <tr key={`${r.hash}-${r.logIndex}`}>
                        <td className="text-[13px] mb-muted mb-num whitespace-nowrap">
                          {r.timestamp ? (
                            <T id={formatDateWIB(r.timestamp)} en={formatDateWIB(r.timestamp, true, "en")} />
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className={`mb-desc ${node}`}>
                          <span className="block">{desc}</span>
                          <TxLink hash={r.hash} />
                        </td>
                        <td
                          className={`text-right mb-amt ${r.kind === "Refunded" ? "mb-returned-text" : r.kind === "Booked" ? "mb-muted" : "mb-paid-text"}`}
                        >
                          {r.kind === "Booked" ? "–" : formatRp(r.amount)}
                        </td>
                        <td className="text-right mb-amt mb-bal">{formatRp(bal)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
        <p className="mb-p mt-3 text-sm mb-muted">
          <T
            id="Saldo mUMRAH Anda = sisa dana amanah Anda. Tidak bisa dipindah ke orang lain."
            en="Your mUMRAH balance is your remaining prepayment. It cannot be transferred."
          />
        </p>
      </div>
    </article>
  );
};
