"use client";

import { useEffect, useRef, useState } from "react";
import { Address, Hex, encodeAbiParameters, isAddress, isHex, keccak256, recoverTypedDataAddress } from "viem";
import { useAccount } from "wagmi";
import { RegulatorPanel } from "~~/components/mabrur/RegulatorPanel";
import { AddressChip, Bi, ContractsGuard, Label, PageShell, Stamp, TxLink } from "~~/components/mabrur/ui";
import {
  Booking,
  ZERO,
  eventsFrom,
  useBooking,
  useChainNow,
  useMabrurContracts,
  useMabrurTx,
} from "~~/hooks/mabrur/useMabrur";
import { DecodedRevert, formatErrorCall } from "~~/utils/mabrur/errors";
import {
  LINES,
  formatCountdown,
  formatDateWIB,
  formatRp,
  idHex,
  parseBookingId,
  shortHex,
} from "~~/utils/mabrur/format";
import { INVOICE_TYPES, SignedInvoice, parseInvoices, pbmDomain, refToLabel } from "~~/utils/mabrur/invoice";
import { defaultAgency, getLabel, loadJson, saveJson, setLabel } from "~~/utils/mabrur/names";

type Attempt = {
  at: number;
  kind: "ditolak" | "lunas";
  action: string;
  bookingId: string;
  simulated?: boolean;
  error?: { name: string; call: string; id: string; en: string };
  vendor?: string;
  line?: number;
  amount?: string;
  ref?: string;
  hash?: string;
};

/** wall-clock ms for attempt rows (called from event handlers only) */
const nowMs = () => Date.now();

const ATTEMPTS_KEY = "mabrur.console.attempts";
const BOOKINGS_KEY = "mabrur.console.bookings";

const toAttemptError = (d: DecodedRevert) => ({ name: d.name, call: formatErrorCall(d), id: d.id, en: d.en });

/* ── Left column: one booking row with countdown + permissionless refund ── */
const BookingRow = ({
  id,
  active,
  onSelect,
  onRemove,
  onAttempt,
}: {
  id: bigint;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onAttempt: (a: Attempt) => void;
}) => {
  const { data: b } = useBooking(id);
  const { now } = useChainNow();
  const { pbm } = useMabrurContracts();
  const { run, busy, walletClient } = useMabrurTx();
  const [label, setLabelState] = useState<string>("");
  useEffect(() => setLabelState(getLabel(idHex(id)) ?? (b ? (getLabel(b.pilgrim) ?? "") : "")), [id, b]);

  if (b === null)
    return (
      <div className="mb-sheet text-sm" style={{ padding: 12 }}>
        <span className="mb-data">{shortHex(idHex(id), 8, 6)}</span> — tidak ditemukan
        <button className="mb-link ml-2" onClick={onRemove}>
          hapus
        </button>
      </div>
    );
  if (!b)
    return (
      <div className="mb-sheet text-sm" style={{ padding: 12 }}>
        Memuat…
      </div>
    );

  const total = b.remaining.reduce((x, y) => x + y, 0n);
  const flightPaid = b.flightVendor !== ZERO;
  const deadline = !flightPaid ? Number(b.ticketBy) : Number(b.departBy);
  const deadlineName = !flightPaid ? "batas tiket" : "batas berangkat";
  const left = deadline - now;
  const showCountdown = !b.refunded && left < 3600;
  const canRefund = b.refundable && !b.refunded && total > 0n;

  const doRefund = async () => {
    if (!pbm) return;
    const out = await run({ address: pbm.address, abi: pbm.abi, functionName: "refund", args: [b.id] });
    if (out.kind === "mined") {
      const ev = eventsFrom(out.receipt, pbm.abi, pbm.address).find(e => e.eventName === "Refunded");
      onAttempt({
        at: nowMs(),
        kind: "lunas",
        action: "refund",
        bookingId: idHex(b.id),
        amount: (ev?.args.amount ?? total).toString(),
        hash: out.hash,
        vendor: b.pilgrim,
      });
    } else if (out.kind !== "simulated-ok") {
      onAttempt({
        at: nowMs(),
        kind: "ditolak",
        action: "refund",
        bookingId: idHex(b.id),
        simulated: out.kind === "reverted",
        error: toAttemptError(out.decoded),
      });
    }
  };

  return (
    <div
      className={`mb-sheet flex flex-col gap-1 ${active ? "outline-3 outline-[var(--ink)]" : ""}`}
      style={{ padding: 14 }}
    >
      <button className="text-left flex flex-col gap-1" onClick={onSelect}>
        <span className="font-bold">{label || "Booking"}</span>
        <span className="mb-data text-sm">{shortHex(idHex(b.id), 8, 6)}</span>
        <span className="mb-num font-bold">{formatRp(total)}</span>
        <span>
          {b.refunded ? (
            <span className="mb-chip mb-chip-after">Dikembalikan</span>
          ) : b.refundable ? (
            <span className="mb-chip mb-chip-refused">Bisa refund</span>
          ) : flightPaid ? (
            <span className="mb-chip mb-chip-after">Tiket lunas</span>
          ) : (
            <span className="mb-chip mb-chip-before">Disimpan</span>
          )}
        </span>
      </button>
      {showCountdown && (
        <div className="mt-1">
          <Label>{deadlineName}</Label>
          <div className={`mb-countdown ${left <= 0 ? "mb-refused-text" : ""}`}>{formatCountdown(left)}</div>
          {left <= 0 && <div className="mb-refused-text font-bold text-sm">lewat — siapa pun bisa refund</div>}
        </div>
      )}
      {!showCountdown && !b.refunded && (
        <span className="text-sm mb-muted">
          {deadlineName} {formatDateWIB(deadline)}
        </span>
      )}
      {(canRefund || (showCountdown && left <= 0 && !b.refunded)) && (
        <button className="mb-btn mb-btn-sm mt-1" disabled={!canRefund || busy || !walletClient} onClick={doRefund}>
          {canRefund ? `Kembalikan ${formatRp(total)}` : "Menunggu blok berikutnya…"}
        </button>
      )}
      <div className="flex gap-2 mt-1">
        <input
          className="mb-input text-sm"
          style={{ minHeight: 32, padding: "4px 8px" }}
          placeholder="nama"
          value={label}
          onChange={e => {
            setLabelState(e.target.value);
            setLabel(idHex(b.id), e.target.value);
          }}
          aria-label="Nama booking"
        />
        <button className="mb-link text-sm mb-muted" onClick={onRemove} aria-label="Hapus dari daftar">
          hapus
        </button>
      </div>
    </div>
  );
};

/* ── One loaded invoice: decode, recover signer, show claim, then simulate → spend ── */
const InvoiceRow = ({
  inv,
  booking,
  onAttempt,
}: {
  inv: SignedInvoice;
  booking?: Booking | null;
  onAttempt: (a: Attempt) => void;
}) => {
  const { pbm, chainId } = useMabrurContracts();
  const { address } = useAccount();
  const { run, busy } = useMabrurTx();
  const [signer, setSigner] = useState<Address | undefined>();
  const L = LINES[inv.invoice.line] ?? LINES[0];

  useEffect(() => {
    if (!pbm) return;
    recoverTypedDataAddress({
      domain: pbmDomain(chainId, pbm.address),
      types: INVOICE_TYPES,
      primaryType: "Invoice",
      message: { ...inv.invoice, line: inv.invoice.line },
      signature: inv.signature,
    })
      .then(setSigner)
      .catch(() => setSigner(undefined));
  }, [inv, pbm, chainId]);

  const forThis = booking && inv.invoice.bookingId === booking.id;

  const pay = async (dryRun: boolean) => {
    if (!pbm || !booking) return;
    const account = (address ?? booking.agency) as Address;
    const out = await run(
      {
        address: pbm.address,
        abi: pbm.abi,
        functionName: "spend",
        args: [booking.id, { ...inv.invoice, line: inv.invoice.line }, inv.signature],
      },
      { dryRun, account },
    );
    const refLabel = inv.refLabel ?? refToLabel(inv.invoice.ref);
    if (out.kind === "reverted" || out.kind === "failed") {
      onAttempt({
        at: nowMs(),
        kind: "ditolak",
        action: `spend · ${refLabel}`,
        bookingId: idHex(booking.id),
        simulated: out.kind === "reverted",
        error: toAttemptError(out.decoded),
      });
    } else if (out.kind === "mined") {
      const ev = eventsFrom(out.receipt, pbm.abi, pbm.address).find(e => e.eventName === "Spent");
      onAttempt({
        at: nowMs(),
        kind: "lunas",
        action: `spend · ${refLabel}`,
        bookingId: idHex(booking.id),
        vendor: ev?.args.vendor ?? signer,
        line: inv.invoice.line,
        amount: (ev?.args.amount ?? inv.invoice.amount).toString(),
        ref: refLabel,
        hash: out.hash,
      });
    } else {
      // dry run passed
      onAttempt({
        at: nowMs(),
        kind: "lunas",
        action: `simulasi · ${refLabel} lolos (belum dikirim)`,
        bookingId: idHex(booking.id),
        simulated: true,
        vendor: signer,
        line: inv.invoice.line,
        amount: inv.invoice.amount.toString(),
        ref: refLabel,
      });
    }
  };

  return (
    <div className="mb-row flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="mb-data">{inv.refLabel ?? refToLabel(inv.invoice.ref)}</span>
          {inv.label && inv.label !== inv.refLabel && <span className="text-sm mb-muted"> · {inv.label}</span>}
        </span>
        <span className="mb-num font-bold">{formatRp(inv.invoice.amount)}</span>
      </div>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="mb-label">Booking</dt>
        <dd>
          <span className="mb-data text-sm">{shortHex(idHex(inv.invoice.bookingId), 8, 6)}</span>{" "}
          {getLabel(idHex(inv.invoice.bookingId)) && <span>({getLabel(idHex(inv.invoice.bookingId))})</span>}{" "}
          {booking &&
            (forThis ? (
              <span className="mb-chip mb-chip-ink">booking ini</span>
            ) : (
              <span className="mb-chip mb-chip-muted">booking lain</span>
            ))}
        </dd>
        <dt className="mb-label">Pos</dt>
        <dd>
          {L.id} <span className="mb-muted">· {L.en}</span>
        </dd>
        <dt className="mb-label">Berlaku s.d.</dt>
        <dd className="mb-num">{formatDateWIB(inv.invoice.expiry)}</dd>
        <dt className="mb-label">Penanda tangan</dt>
        <dd>{signer ? <AddressChip address={signer} topic={L.topic} /> : <span className="mb-muted">–</span>}</dd>
      </dl>
      <div className="text-sm mb-muted">
        Penerima = penanda tangan. Tidak ada kolom alamat penerima. · The payee is the signer; there is no payee field.
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="mb-btn" disabled={!booking || busy} onClick={() => pay(false)}>
          Bayar faktur
        </button>
        <button className="mb-btn mb-btn-ghost" disabled={!booking || busy} onClick={() => pay(true)}>
          Simulasi saja
        </button>
      </div>
    </div>
  );
};

const AttemptRow = ({ a }: { a: Attempt }) => (
  <div
    className={`mb-row flex flex-col gap-2 px-3 rounded-[10px] ${a.kind === "ditolak" ? "mb-wash-refused" : "mb-wash-after"}`}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <span className="mb-label">
          {new Date(a.at).toLocaleTimeString("id-ID")} · {a.action}
        </span>
        <span className="text-sm">
          booking <span className="mb-data text-sm">{shortHex(a.bookingId, 8, 6)}</span>
          {getLabel(a.bookingId) && ` (${getLabel(a.bookingId)})`}
        </span>
      </div>
      {a.kind === "ditolak" ? (
        <Stamp kind="ditolak" small>
          <span className="mb-data text-sm">{a.error?.call}</span>
        </Stamp>
      ) : a.action === "refund" ? (
        <Stamp kind="dikembalikan" small>
          {formatRp(BigInt(a.amount ?? 0))}
        </Stamp>
      ) : (
        <Stamp kind="lunas" small>
          {formatRp(BigInt(a.amount ?? 0))}
        </Stamp>
      )}
    </div>
    {a.kind === "ditolak" && a.error && (
      <div>
        <span className="mb-refused-text font-bold">{a.error.id}</span>
        <span className="mb-en">{a.error.en}</span>
        {a.simulated && <span className="mb-en">simulateContract — tidak ada transaksi dikirim · nothing sent</span>}
      </div>
    )}
    {a.kind === "lunas" && (
      <div className="flex flex-wrap gap-2 items-center text-sm">
        {a.line !== undefined && <span>{LINES[a.line].id}</span>}
        {a.vendor && (
          <>
            <span>→</span>
            <AddressChip address={a.vendor} />
          </>
        )}
        {a.hash && <TxLink hash={a.hash} />}
      </div>
    )}
  </div>
);

const ConsoleInner = () => {
  const { address } = useAccount();
  const { pbm, chainId } = useMabrurContracts();
  const { run, busy } = useMabrurTx();
  const fileRef = useRef<HTMLInputElement>(null);

  const [ids, setIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [paste, setPaste] = useState("");
  const [invoices, setInvoices] = useState<SignedInvoice[]>([]);
  const [parseErr, setParseErr] = useState("");
  const [addPilgrim, setAddPilgrim] = useState("");
  const [addNonce, setAddNonce] = useState("0");
  const [addId, setAddId] = useState("");
  const [depPaste, setDepPaste] = useState("");
  const [agencyOverride, setAgencyOverride] = useState("");

  const storeKey = (k: string) => `${k}.${chainId}`;
  useEffect(() => {
    setIds(loadJson<string[]>(storeKey(BOOKINGS_KEY), []));
    setAttempts(loadJson<Attempt[]>(storeKey(ATTEMPTS_KEY), []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);
  useEffect(() => {
    if (!selected && ids[0]) setSelected(ids[0]);
  }, [ids, selected]);

  const saveIds = (next: string[]) => {
    setIds(next);
    saveJson(storeKey(BOOKINGS_KEY), next);
  };
  const addIds = (newIds: string[]) => {
    const merged = [...ids];
    for (const id of newIds) if (!merged.includes(id)) merged.push(id);
    saveIds(merged);
  };
  const pushAttempt = (a: Attempt) => {
    setAttempts(prev => {
      const next = [a, ...prev].slice(0, 50);
      saveJson(storeKey(ATTEMPTS_KEY), next);
      return next;
    });
  };

  const selectedId = selected ? parseBookingId(selected) : undefined;
  const { data: booking } = useBooking(selectedId);
  const bookingName = selected ? (getLabel(selected) ?? (booking ? getLabel(booking.pilgrim) : undefined)) : undefined;
  const regulatorAgency = agencyOverride || booking?.agency || defaultAgency(chainId) || address || "";

  const loadText = (text: string) => {
    setParseErr("");
    try {
      const list = parseInvoices(text);
      // script/out/invoices.json (SeedDemo) also names the two demo bookings and the agency
      const meta = JSON.parse(text);
      const seeded: string[] = [];
      for (const [k, name] of [
        ["ahmadBookingId", "Pak Ahmad"],
        ["sitiBookingId", "Ibu Siti"],
      ] as const) {
        const id = meta && typeof meta === "object" ? parseBookingId(String(meta[k] ?? "")) : undefined;
        if (id !== undefined) {
          setLabel(idHex(id), name);
          seeded.push(idHex(id));
        }
      }
      if (meta?.agency && isAddress(meta.agency) && !getLabel(meta.agency))
        setLabel(meta.agency, "PT Amanah Contoh Wisata");
      if (meta?.chainId !== undefined && Number(meta.chainId) !== chainId)
        setParseErr(`Peringatan: file untuk chain ${meta.chainId}, dompet di chain ${chainId}`);
      if (seeded.length) {
        addIds(seeded);
        setSelected(seeded[0]);
      }
      if (!list.length) {
        setParseErr("Tidak ada faktur bertanda tangan di JSON ini · no signed invoice found");
        return;
      }
      setInvoices(list);
      addIds([...seeded, ...list.map(i => idHex(i.invoice.bookingId))]);
    } catch (e) {
      setParseErr(`JSON tidak sah: ${(e as Error).message}`);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    loadText(await f.text());
  };

  const addByPilgrim = () => {
    if (!isAddress(addPilgrim)) return;
    // bookingIdOf is pure: the same keccak256(abi.encode(pilgrim, nonce)), computed locally
    const id = BigInt(
      keccak256(
        encodeAbiParameters(
          [{ type: "address" }, { type: "uint256" }],
          [addPilgrim as Address, BigInt(addNonce || "0")],
        ),
      ),
    );
    addIds([idHex(id)]);
    setSelected(idHex(id));
  };

  const releaseMargin = async (dryRun: boolean) => {
    if (!pbm || !booking) return;
    let sig: string = depPaste.trim();
    try {
      const j = JSON.parse(sig);
      sig = j.signature ?? j.sig ?? sig;
    } catch {
      /* raw hex */
    }
    if (!isHex(sig)) {
      pushAttempt({
        at: nowMs(),
        kind: "ditolak",
        action: "releaseMargin",
        bookingId: idHex(booking.id),
        error: {
          name: "BadInput",
          call: "—",
          id: "Tanda tangan keberangkatan tidak terbaca",
          en: "Could not read the departure signature",
        },
      });
      return;
    }
    const out = await run(
      { address: pbm.address, abi: pbm.abi, functionName: "releaseMargin", args: [booking.id, sig as Hex] },
      { dryRun, account: (address ?? booking.agency) as Address },
    );
    if (out.kind === "reverted" || out.kind === "failed")
      pushAttempt({
        at: nowMs(),
        kind: "ditolak",
        action: "releaseMargin",
        bookingId: idHex(booking.id),
        simulated: out.kind === "reverted",
        error: toAttemptError(out.decoded),
      });
    else if (out.kind === "mined") {
      const ev = eventsFrom(out.receipt, pbm.abi, pbm.address).find(e => e.eventName === "MarginReleased");
      pushAttempt({
        at: nowMs(),
        kind: "lunas",
        action: "releaseMargin",
        bookingId: idHex(booking.id),
        line: 3,
        amount: (ev?.args.amount ?? 0n).toString(),
        vendor: booking.agency,
        hash: out.hash,
      });
    } else
      pushAttempt({
        at: nowMs(),
        kind: "lunas",
        action: "simulasi · releaseMargin lolos (belum dikirim)",
        bookingId: idHex(booking.id),
        simulated: true,
        line: 3,
        amount: booking.remaining[3].toString(),
      });
  };

  return (
    <PageShell>
      <header className="mb-6 flex flex-wrap justify-between gap-4 items-end">
        <div>
          <Label>Agen · agency</Label>
          <h1 className="mb-title">Konsol Agen</h1>
          <span className="mb-en">The agency can only pay a vendor-signed invoice for this booking.</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          {address ? (
            <AddressChip address={address} topic={1} />
          ) : (
            <span className="mb-muted text-sm">Tanpa dompet: simulasi sebagai agen booking</span>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
        {/* Left: bookings */}
        <section className="flex flex-col gap-3" aria-label="Booking">
          <Label>Booking agen</Label>
          {ids.length === 0 && (
            <p className="mb-p text-sm mb-muted">Muat invoices.json atau tambah booking di bawah.</p>
          )}
          {ids.map(id => {
            const big = parseBookingId(id);
            if (big === undefined) return null;
            return (
              <BookingRow
                key={id}
                id={big}
                active={id === selected}
                onSelect={() => setSelected(id)}
                onRemove={() => {
                  saveIds(ids.filter(x => x !== id));
                  if (selected === id) setSelected(undefined);
                }}
                onAttempt={pushAttempt}
              />
            );
          })}
          <div className="mb-sheet flex flex-col gap-2" style={{ padding: 14 }}>
            <Label>Tambah · add booking</Label>
            <input
              className="mb-input mb-data text-sm"
              placeholder="alamat jamaah 0x…"
              value={addPilgrim}
              onChange={e => setAddPilgrim(e.target.value.trim())}
              aria-label="Alamat jamaah"
            />
            <div className="flex gap-2">
              <input
                className="mb-input mb-num"
                style={{ width: 90 }}
                value={addNonce}
                onChange={e => setAddNonce(e.target.value.replace(/\D/g, ""))}
                aria-label="Nonce"
                title="nonce"
              />
              <button
                className="mb-btn mb-btn-ghost mb-btn-sm grow"
                onClick={addByPilgrim}
                disabled={!isAddress(addPilgrim)}
              >
                + nonce
              </button>
            </div>
            <input
              className="mb-input mb-data text-sm"
              placeholder="atau id booking 0x…"
              value={addId}
              onChange={e => setAddId(e.target.value.trim())}
              aria-label="Id booking"
            />
            <button
              className="mb-btn mb-btn-ghost mb-btn-sm"
              disabled={parseBookingId(addId) === undefined}
              onClick={() => {
                const id = idHex(parseBookingId(addId));
                addIds([id]);
                setSelected(id);
                setAddId("");
              }}
            >
              + id
            </button>
          </div>
        </section>

        {/* Centre: pay from the selected booking */}
        <section className="flex flex-col gap-6 min-w-0">
          <div className="mb-sheet">
            <Label>Bayar dari booking</Label>
            <h2 className="mb-h2 mt-1">{bookingName ?? (selected ? shortHex(selected, 8, 6) : "— pilih booking —")}</h2>
            {booking && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {LINES.map((L, i) => (
                  <div
                    key={L.key}
                    className={`rounded-[10px] p-3 ${booking.remaining[i] > 0n ? "mb-wash-before" : "mb-wash-after"}`}
                  >
                    <div className="text-sm font-bold">{L.id}</div>
                    <div className="mb-num font-bold">{formatRp(booking.remaining[i])}</div>
                  </div>
                ))}
              </div>
            )}
            {booking && (
              <div className="text-sm mt-3 flex flex-wrap gap-3">
                <span>
                  Jamaah: <AddressChip address={booking.pilgrim} />
                </span>
                <span>
                  Agen: <AddressChip address={booking.agency} topic={1} />
                </span>
              </div>
            )}

            <div className="mb-perforation" />

            <Label>Faktur vendor · signed invoice</Label>
            <p className="mb-p text-sm mb-muted mt-1">
              Tempel JSON dari halaman vendor, atau pilih <span className="mb-data text-sm">invoices.json</span>. Tidak
              ada yang diambil dari server.
              <span className="mb-en">
                Paste the vendor page&apos;s JSON or pick invoices.json — nothing is fetched from a server.
              </span>
            </p>
            <textarea
              className="mb-textarea mt-2"
              value={paste}
              onChange={e => setPaste(e.target.value)}
              placeholder='{"invoice": {...}, "signature": "0x…"}'
              aria-label="Tempel faktur"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className="mb-btn mb-btn-ghost mb-btn-sm"
                onClick={() => loadText(paste)}
                disabled={!paste.trim()}
              >
                Baca faktur
              </button>
              <button className="mb-btn mb-btn-ghost mb-btn-sm" onClick={() => fileRef.current?.click()}>
                Pilih invoices.json
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={e => onFile(e.target.files?.[0])}
                aria-label="File faktur"
              />
              {invoices.length > 0 && (
                <button className="mb-link text-sm" onClick={() => setInvoices([])}>
                  kosongkan
                </button>
              )}
            </div>
            {parseErr && <p className="mb-p mt-2 mb-refused-text text-sm">{parseErr}</p>}
            <div className="mt-3">
              {invoices.map((inv, i) => (
                <InvoiceRow key={`${inv.signature}-${i}`} inv={inv} booking={booking} onAttempt={pushAttempt} />
              ))}
            </div>
          </div>

          <div className="mb-sheet">
            <Label>Ujrah agen · releaseMargin</Label>
            <p className="mb-p text-sm mt-1">
              <Bi
                id="Tempel tanda tangan keberangkatan (Departure) dari jamaah atau maskapai."
                en="Paste a Departure signature from the pilgrim or the paid airline."
              />
            </p>
            <textarea
              className="mb-textarea mt-2"
              style={{ minHeight: 80 }}
              value={depPaste}
              onChange={e => setDepPaste(e.target.value)}
              placeholder="0x… atau JSON"
              aria-label="Tanda tangan keberangkatan"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className="mb-btn"
                disabled={!booking || !depPaste.trim() || busy}
                onClick={() => releaseMargin(false)}
              >
                Buka ujrah {booking ? formatRp(booking.remaining[3]) : ""}
              </button>
              <button
                className="mb-btn mb-btn-ghost"
                disabled={!booking || !depPaste.trim() || busy}
                onClick={() => releaseMargin(true)}
              >
                Simulasi saja
              </button>
            </div>
          </div>

          <div className="mb-sheet">
            <div className="flex justify-between items-center">
              <Label>Catatan percobaan · attempt ledger</Label>
              {attempts.length > 0 && (
                <button
                  className="mb-link text-sm mb-muted"
                  onClick={() => {
                    setAttempts([]);
                    saveJson(storeKey(ATTEMPTS_KEY), []);
                  }}
                >
                  bersihkan
                </button>
              )}
            </div>
            {attempts.length === 0 ? (
              <p className="mb-p text-sm mb-muted mt-2">Belum ada percobaan · no attempts yet</p>
            ) : (
              <div className="flex flex-col gap-2 mt-2">
                {attempts.map(a => (
                  <AttemptRow key={`${a.at}-${a.action}`} a={a} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: regulator */}
        <section className="flex flex-col gap-3">
          <RegulatorPanel agency={regulatorAgency} />
          <input
            className="mb-input mb-data text-sm"
            placeholder="alamat agen lain (opsional)"
            value={agencyOverride}
            onChange={e => setAgencyOverride(e.target.value.trim())}
            aria-label="Alamat agen untuk panel regulator"
          />
        </section>
      </div>
    </PageShell>
  );
};

export default function AgenPage() {
  return (
    <ContractsGuard>
      <ConsoleInner />
    </ContractsGuard>
  );
}
