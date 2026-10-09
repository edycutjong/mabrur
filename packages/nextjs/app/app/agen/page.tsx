"use client";

import { useEffect, useRef, useState } from "react";
import { Address, Hex, isAddress, isHex, recoverTypedDataAddress } from "viem";
import { useAccount } from "wagmi";
import { RegulatorPanel } from "~~/components/mabrur/RegulatorPanel";
import {
  AddressChip,
  Bi,
  ContractsGuard,
  ErrorCall,
  Label,
  PageShell,
  Stamp,
  T,
  TxLink,
} from "~~/components/mabrur/ui";
import { useT } from "~~/hooks/mabrur/useLang";
import {
  Booking,
  ZERO,
  bookingIdOf,
  eventsFrom,
  useBooking,
  useChainNow,
  useMabrurContracts,
  useMabrurTx,
} from "~~/hooks/mabrur/useMabrur";
import { DecodedRevert, errorArgParts, formatErrorCall } from "~~/utils/mabrur/errors";
import {
  LINES,
  formatCountdown,
  formatDateWIB,
  formatRp,
  idHex,
  parseBookingId,
  shortHex,
} from "~~/utils/mabrur/format";
import { Bilingual } from "~~/utils/mabrur/i18n";
import {
  INVOICE_TYPES,
  InvoiceParseError,
  MAX_INVOICE_FILE_BYTES,
  SignedInvoice,
  parseInvoices,
  pbmDomain,
  refToLabel,
} from "~~/utils/mabrur/invoice";
import { defaultAgency, getLabel, loadJson, saveJson, setLabel } from "~~/utils/mabrur/names";

type Attempt = {
  at: number;
  kind: "ditolak" | "lunas";
  action: string;
  bookingId: string;
  simulated?: boolean;
  error?: { name: string; call: string; id: string; en: string; args?: { short: string; full: string }[] };
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

const toAttemptError = (d: DecodedRevert) => ({
  name: d.name,
  call: formatErrorCall(d),
  args: errorArgParts(d),
  id: d.id,
  en: d.en,
});

/** The stamp for one attempt: DITOLAK, DIKEMBALIKAN, LUNAS, or the neutral LOLOS SIMULASI for a passing dry run. */
const AttemptStamp = ({ a }: { a: Attempt }) =>
  a.kind === "ditolak" ? (
    <Stamp kind="ditolak" small>
      <span className="mb-data text-sm">
        {a.error?.args ? <ErrorCall name={a.error.name} args={a.error.args} /> : a.error?.call}
      </span>
    </Stamp>
  ) : a.simulated ? (
    <Stamp kind="simulasi" small>
      {a.amount !== undefined && a.amount !== "0" ? formatRp(BigInt(a.amount)) : null}
    </Stamp>
  ) : a.action === "refund" ? (
    <Stamp kind="dikembalikan" small>
      {formatRp(BigInt(a.amount ?? 0))}
    </Stamp>
  ) : (
    <Stamp kind="lunas" small>
      {formatRp(BigInt(a.amount ?? 0))}
    </Stamp>
  );

/** One-line reason under an attempt stamp. */
const attemptReason = (a: Attempt): Bilingual =>
  a.kind === "ditolak"
    ? {
        id: `${a.error?.id ?? "Ditolak"}${a.simulated ? " · simulasi, tidak ada transaksi dikirim" : ""}`,
        en: `${a.error?.en ?? "Rejected"}${a.simulated ? " · simulated, nothing sent" : ""}`,
      }
    : a.simulated
      ? { id: "Simulasi lolos — belum ada transaksi dikirim.", en: "The contract would accept this; nothing was sent." }
      : a.action === "refund"
        ? { id: "Sisa dana dikembalikan ke jamaah.", en: "Remaining money returned to the pilgrim." }
        : { id: "Dibayar ke penanda tangan.", en: "Paid to the signer." };

/** The attempt's action as shown: a dry run that passed says so; legacy rows already carry their Indonesian label. */
const actionLabel = (a: Attempt): Bilingual =>
  a.simulated && a.kind === "lunas" && !a.action.startsWith("simulasi · ")
    ? { id: `simulasi · ${a.action} lolos (belum dikirim)`, en: `dry run · ${a.action} would pass (not sent)` }
    : { id: a.action, en: a.action };

/** The result of the last click, shown right next to the button that triggered it (the ledger keeps the history). */
const InlineResult = ({ a }: { a?: Attempt }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (a) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [a]);
  if (!a) return null;
  const r = attemptReason(a);
  return (
    <div ref={ref} className="mt-3 flex flex-col gap-4 items-start" aria-live="polite" data-testid="inline-result">
      <AttemptStamp a={a} />
      <div className="text-sm">
        <span
          className={`font-medium ${a.kind === "ditolak" ? "mb-refused-text" : a.action === "refund" ? "mb-returned-text" : a.simulated ? "" : "mb-paid-text"}`}
        >
          <T id={r.id} en={r.en} />
        </span>{" "}
        {a.hash && <TxLink hash={a.hash} />}
      </div>
    </div>
  );
};

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
  const t = useT();
  const [last, setLast] = useState<Attempt | undefined>();
  const report = (a: Attempt) => {
    setLast(a);
    onAttempt(a);
  };
  const [label, setLabelState] = useState<string>("");
  useEffect(() => setLabelState(getLabel(idHex(id)) ?? (b ? (getLabel(b.pilgrim) ?? "") : "")), [id, b]);

  if (b === null)
    return (
      <div className="mb-sheet text-sm" style={{ padding: 12 }}>
        <span className="mb-data">{shortHex(idHex(id), 8, 6)}</span> — <T id="tidak ditemukan" en="not found" />
        <button className="mb-link ml-2" onClick={onRemove}>
          <T id="hapus" en="remove" />
        </button>
      </div>
    );
  if (!b)
    return (
      <div className="mb-sheet text-sm" style={{ padding: 12 }}>
        <T id="Memuat…" en="Loading…" />
      </div>
    );

  const total = b.remaining.reduce((x, y) => x + y, 0n);
  const flightPaid = b.flightVendor !== ZERO;
  const deadline = !flightPaid ? Number(b.ticketBy) : Number(b.departBy);
  const deadlineName: Bilingual = !flightPaid
    ? { id: "batas tiket", en: "ticket-by date" }
    : { id: "batas berangkat", en: "depart-by date" };
  const left = deadline - now;
  // nothing left to refund or the trip is under way: the deadline no longer matters (no stale chip / countdown)
  const settled = b.refunded || b.departed || b.marginReleased || total === 0n;
  const showCountdown = !settled && left < 3600;
  const canRefund = b.refundable && !b.refunded && total > 0n;

  const doRefund = async () => {
    if (!pbm) return;
    const out = await run({ address: pbm.address, abi: pbm.abi, functionName: "refund", args: [b.id] });
    if (out.kind === "mined") {
      const ev = eventsFrom(out.receipt, pbm.abi, pbm.address).find(e => e.eventName === "Refunded");
      report({
        at: nowMs(),
        kind: "lunas",
        action: "refund",
        bookingId: idHex(b.id),
        amount: (ev?.args.amount ?? total).toString(),
        hash: out.hash,
        vendor: b.pilgrim,
      });
    } else if (out.kind !== "simulated-ok") {
      report({
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
    // The whole card selects the booking (the inner button is the keyboard path); its own controls keep their clicks.
    <div
      className={`mb-sheet mb-hover flex flex-col gap-1 cursor-pointer ${active ? "mb-active" : ""}`}
      style={{ padding: 14 }}
      onClick={e => {
        if (!(e.target as HTMLElement).closest("button, a, input, textarea, select, label")) onSelect();
      }}
    >
      <button className="text-left flex flex-col gap-1 cursor-pointer" onClick={onSelect} aria-pressed={active}>
        <span className="font-medium">{label || "Booking"}</span>
        <span className="mb-data mb-muted text-[12.5px]">{shortHex(idHex(b.id), 8, 6)}</span>
        <span className="mb-amt">{formatRp(total)}</span>
        <span className="mt-1">
          {b.refunded ? (
            <span className="mb-chip mb-chip-returned">
              <T id="Dikembalikan" en="Refunded" />
            </span>
          ) : canRefund ? (
            <span className="mb-chip mb-chip-refused">
              <T id="Bisa refund" en="Refundable" />
            </span>
          ) : flightPaid ? (
            <span className="mb-chip mb-chip-paid">
              <T id="Tiket lunas" en="Ticket paid" />
            </span>
          ) : (
            <span className="mb-held">
              <T id="Disimpan" en="Earmarked" />
            </span>
          )}
        </span>
      </button>
      {showCountdown && (
        <div className="mt-1">
          <Label>
            <T id={deadlineName.id} en={deadlineName.en} />
          </Label>
          <div className={`mb-countdown ${left <= 0 ? "mb-refused-text" : ""}`}>
            <T id={formatCountdown(left)} en={formatCountdown(left, "en")} />
          </div>
          {left <= 0 && (
            <div className="mb-refused-text font-medium text-sm">
              <T id="lewat — siapa pun bisa refund" en="passed — anyone can refund" />
            </div>
          )}
        </div>
      )}
      {!showCountdown && !settled && (
        <span className="text-sm mb-muted">
          <T
            id={`${deadlineName.id} ${formatDateWIB(deadline)}`}
            en={`${deadlineName.en} ${formatDateWIB(deadline, true, "en")}`}
          />
        </span>
      )}
      {(canRefund || (showCountdown && left <= 0)) && (
        <button className="mb-btn mb-btn-sm mt-1" disabled={!canRefund || busy || !walletClient} onClick={doRefund}>
          {canRefund ? (
            <T id={`Kembalikan ${formatRp(total)}`} en={`Refund ${formatRp(total)}`} />
          ) : (
            <T id="Menunggu blok berikutnya…" en="Waiting for the next block…" />
          )}
        </button>
      )}
      {canRefund && !walletClient && (
        <div className="text-sm mb-muted">
          <T id="Hubungkan dompet apa saja untuk menekan." en="Connect any wallet to press it." />
        </div>
      )}
      <InlineResult a={last} />
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-dashed border-[var(--rule)]">
        <input
          className="mb-input text-sm"
          style={{ minHeight: 34, padding: "4px 10px" }}
          placeholder={t("nama", "name")}
          value={label}
          onChange={e => {
            setLabelState(e.target.value);
            setLabel(idHex(b.id), e.target.value);
          }}
          aria-label={t("Nama booking", "Booking name")}
        />
        <button
          className="mb-link text-sm mb-muted"
          onClick={onRemove}
          aria-label={t("Hapus dari daftar", "Remove from the list")}
        >
          <T id="hapus" en="remove" />
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
  const [last, setLast] = useState<Attempt | undefined>();
  const report = (a: Attempt) => {
    setLast(a);
    onAttempt(a);
  };
  // parseInvoices only admits lines 0..3; an unknown line is shown as such, never silently treated as the flight line
  const L = LINES[inv.invoice.line] as (typeof LINES)[number] | undefined;

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
      report({
        at: nowMs(),
        kind: "ditolak",
        action: `spend · ${refLabel}`,
        bookingId: idHex(booking.id),
        simulated: out.kind === "reverted",
        error: toAttemptError(out.decoded),
      });
    } else if (out.kind === "mined") {
      const ev = eventsFrom(out.receipt, pbm.abi, pbm.address).find(e => e.eventName === "Spent");
      report({
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
      report({
        at: nowMs(),
        kind: "lunas",
        action: `spend · ${refLabel}`,
        bookingId: idHex(booking.id),
        simulated: true,
        vendor: signer,
        line: inv.invoice.line,
        amount: inv.invoice.amount.toString(),
        ref: refLabel,
      });
    }
  };

  if (!L)
    return (
      <div className="mb-row mb-refused-text text-sm">
        <T
          id={`Pos tidak dikenal (${String(inv.invoice.line)}) — faktur ini diabaikan.`}
          en={`Unknown invoice line (${String(inv.invoice.line)}) — this invoice is ignored.`}
        />
      </div>
    );

  return (
    <div className="mb-row flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="min-w-0">
          <span className="mb-data font-medium text-[14px]">{inv.refLabel ?? refToLabel(inv.invoice.ref)}</span>
          {inv.label && inv.label !== inv.refLabel && <span className="text-sm mb-muted"> · {inv.label}</span>}
        </span>
        <span className="mb-amt text-[16px]">{formatRp(inv.invoice.amount)}</span>
      </div>
      <dl className="grid grid-cols-[minmax(92px,auto)_1fr] gap-x-4 gap-y-2 text-sm items-baseline">
        <dt className="mb-label">Booking</dt>
        <dd>
          <span className="mb-data text-sm">{shortHex(idHex(inv.invoice.bookingId), 8, 6)}</span>{" "}
          {getLabel(idHex(inv.invoice.bookingId)) && <span>({getLabel(idHex(inv.invoice.bookingId))})</span>}{" "}
          {booking &&
            (forThis ? (
              <span className="mb-chip mb-chip-paid">
                <T id="booking ini" en="this booking" />
              </span>
            ) : (
              <span className="mb-chip mb-chip-refused">
                <T id="booking lain" en="another booking" />
              </span>
            ))}
        </dd>
        <dt className="mb-label">
          <T id="Pos" en="Line" />
        </dt>
        <dd>
          <T id={L.id} en={L.en} />
        </dd>
        <dt className="mb-label">
          <T id="Berlaku s.d." en="Valid until" />
        </dt>
        <dd className="mb-num">
          <T id={formatDateWIB(inv.invoice.expiry)} en={formatDateWIB(inv.invoice.expiry, true, "en")} />
        </dd>
        <dt className="mb-label">
          <T id="Penanda tangan" en="Signer" />
        </dt>
        <dd>{signer ? <AddressChip address={signer} topic={L.topic} /> : <span className="mb-muted">–</span>}</dd>
      </dl>
      <div className="text-sm mb-muted">
        <T
          id="Penerima = penanda tangan. Tidak ada kolom alamat penerima."
          en="The payee is the signer; there is no payee field."
        />
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button className="mb-btn" disabled={!booking || busy} onClick={() => pay(false)}>
          <T id="Bayar faktur" en="Pay invoice" />
        </button>
        <button className="mb-btn mb-btn-ghost" disabled={!booking || busy} onClick={() => pay(true)}>
          <T id="Simulasi saja" en="Simulate only" />
        </button>
      </div>
      <InlineResult a={last} />
    </div>
  );
};

const AttemptRow = ({ a }: { a: Attempt }) => {
  const act = actionLabel(a);
  return (
    <div
      className={`mb-row flex flex-col gap-2 px-4 rounded-[10px] border-0! ${a.kind === "ditolak" ? "mb-wash-refused" : a.simulated ? "bg-[var(--surface)]" : a.action === "refund" ? "mb-wash-returned" : "mb-wash-paid"}`}
    >
      <div className="mb-seal-row items-start!">
        <div className="flex flex-col gap-1">
          <span className="mb-label">
            <T
              id={`${new Date(a.at).toLocaleTimeString("id-ID")} · ${act.id}`}
              en={`${new Date(a.at).toLocaleTimeString("en-GB")} · ${act.en}`}
            />
          </span>
          <span className="text-sm">
            booking <span className="mb-data text-sm">{shortHex(a.bookingId, 8, 6)}</span>
            {getLabel(a.bookingId) && ` (${getLabel(a.bookingId)})`}
          </span>
        </div>
        <AttemptStamp a={a} />
      </div>
      {a.kind === "ditolak" && a.error && (
        <div>
          <span className="mb-refused-text font-medium">
            <T id={a.error.id} en={a.error.en} />
          </span>
          {a.simulated && (
            <span className="block text-sm mb-muted">
              <T id="simulateContract — tidak ada transaksi dikirim" en="simulateContract — nothing was sent" />
            </span>
          )}
        </div>
      )}
      {a.kind === "lunas" && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          {a.line !== undefined && LINES[a.line] && (
            <span>
              <T id={LINES[a.line].id} en={LINES[a.line].en} />
            </span>
          )}
          {a.vendor && (
            <>
              <span className="mb-go" aria-hidden="true" />
              <AddressChip address={a.vendor} />
            </>
          )}
          {a.hash && <TxLink hash={a.hash} />}
        </div>
      )}
    </div>
  );
};

const ConsoleInner = () => {
  const { address } = useAccount();
  const { pbm, chainId } = useMabrurContracts();
  const { run, busy } = useMabrurTx();
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useT();

  const [ids, setIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [paste, setPaste] = useState("");
  const [invoices, setInvoices] = useState<SignedInvoice[]>([]);
  const [parseErr, setParseErr] = useState<Bilingual | undefined>();
  const [addPilgrim, setAddPilgrim] = useState("");
  const [addNonce, setAddNonce] = useState("0");
  const [addId, setAddId] = useState("");
  const [depPaste, setDepPaste] = useState("");
  const [agencyOverride, setAgencyOverride] = useState("");
  const [lastRelease, setLastRelease] = useState<Attempt | undefined>();

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
    setParseErr(undefined);
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
        setParseErr({
          id: `Peringatan: file untuk chain ${meta.chainId}, dompet di chain ${chainId}`,
          en: `Warning: file is for chain ${meta.chainId}, wallet is on chain ${chainId}`,
        });
      if (seeded.length) {
        addIds(seeded);
        setSelected(seeded[0]);
      }
      if (!list.length) {
        setParseErr({
          id: "Tidak ada faktur bertanda tangan di JSON ini",
          en: "No signed invoice found in this JSON",
        });
        return;
      }
      setInvoices(list);
      addIds([...seeded, ...list.map(i => idHex(i.invoice.bookingId))]);
    } catch (e) {
      const msg = (e as Error).message;
      setParseErr(
        e instanceof InvoiceParseError
          ? { id: `Faktur ditolak: ${msg}`, en: `Invoice rejected: ${msg}` }
          : { id: `JSON tidak sah: ${msg}`, en: `Invalid JSON: ${msg}` },
      );
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_INVOICE_FILE_BYTES) {
      setParseErr({
        id: `File terlalu besar (maks. ${MAX_INVOICE_FILE_BYTES / 1024} KB)`,
        en: `File too large (max. ${MAX_INVOICE_FILE_BYTES / 1024} KB)`,
      });
      return;
    }
    loadText(await f.text());
  };

  const addByPilgrim = () => {
    if (!isAddress(addPilgrim)) return;
    // bookingIdOf is pure: the same keccak256(abi.encode(pilgrim, nonce)), computed locally
    const id = bookingIdOf(addPilgrim as Address, BigInt(addNonce || "0"));
    addIds([idHex(id)]);
    setSelected(idHex(id));
  };

  const reportRelease = (a: Attempt) => {
    setLastRelease(a);
    pushAttempt(a);
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
      reportRelease({
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
      reportRelease({
        at: nowMs(),
        kind: "ditolak",
        action: "releaseMargin",
        bookingId: idHex(booking.id),
        simulated: out.kind === "reverted",
        error: toAttemptError(out.decoded),
      });
    else if (out.kind === "mined") {
      const ev = eventsFrom(out.receipt, pbm.abi, pbm.address).find(e => e.eventName === "MarginReleased");
      reportRelease({
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
      reportRelease({
        at: nowMs(),
        kind: "lunas",
        action: "releaseMargin",
        bookingId: idHex(booking.id),
        simulated: true,
        line: 3,
        amount: booking.remaining[3].toString(),
      });
  };

  return (
    <PageShell>
      <header className="mb-8 lg:mb-10 flex flex-wrap justify-between gap-4 items-end">
        <div className="w-full">
          <Label className="mb-runhead">
            <T id="Agen" en="Agency" />
          </Label>
          <h1 className="mb-title">
            <T id="Konsol Agen" en="Agency console" />
          </h1>
          <p className="mb-p mb-lede mt-3">
            <T
              id="Agen hanya bisa membayar faktur bertanda tangan vendor untuk booking ini."
              en="The agency can only pay a vendor-signed invoice for this booking."
            />
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {address ? (
            <AddressChip address={address} topic={1} />
          ) : (
            <span className="mb-muted text-sm">
              <T id="Tanpa dompet: simulasi sebagai agen booking" en="No wallet: simulating as the booking's agency" />
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-6 xl:gap-8 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
        {/* Left: bookings */}
        <section className="flex flex-col gap-3" aria-label={t("Booking agen", "Agency bookings")}>
          <Label>
            <T id="Booking agen" en="Agency bookings" />
          </Label>
          {ids.length === 0 && (
            <p className="mb-p text-sm mb-muted">
              <T
                id="Muat invoices.json atau tambah booking di bawah."
                en="Load invoices.json or add a booking below."
              />
            </p>
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
            <Label>
              <T id="Tambah booking" en="Add a booking" />
            </Label>
            <input
              className="mb-input mb-data text-sm"
              placeholder={t("alamat jamaah 0x…", "pilgrim address 0x…")}
              value={addPilgrim}
              onChange={e => setAddPilgrim(e.target.value.trim())}
              aria-label={t("Alamat jamaah", "Pilgrim address")}
            />
            <div className="flex gap-2">
              <input
                className="mb-input mb-num"
                style={{ width: 90 }}
                value={addNonce}
                onChange={e => setAddNonce(e.target.value.replace(/\D/g, ""))}
                aria-label={t("Booking ke- (nonce, mulai 0)", "Booking number (nonce, from 0)")}
                title={t(
                  "Booking ke berapa dari jamaah ini (nonce, mulai 0)",
                  "The pilgrim's booking number (nonce, from 0)",
                )}
              />
              <button
                className="mb-btn mb-btn-ghost mb-btn-sm grow"
                onClick={addByPilgrim}
                disabled={!isAddress(addPilgrim)}
              >
                <T id="Tambah dari alamat" en="Add from address" />
              </button>
            </div>
            <input
              className="mb-input mb-data text-sm"
              placeholder={t("atau id booking 0x…", "or booking id 0x…")}
              value={addId}
              onChange={e => setAddId(e.target.value.trim())}
              aria-label={t("Id booking", "Booking id")}
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
              <T id="Tambah id" en="Add id" />
            </button>
          </div>
        </section>

        {/* Centre: pay from the selected booking */}
        <section className="flex flex-col gap-6 min-w-0">
          <div className="mb-sheet">
            <Label>
              <T id="Bayar dari booking" en="Pay from booking" />
            </Label>
            <h2 className="mb-h2 mt-2">
              {bookingName ??
                (selected ? shortHex(selected, 8, 6) : <T id="— pilih booking —" en="— pick a booking —" />)}
            </h2>
            {booking && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4 gap-px bg-[var(--rule)] border border-[var(--rule)] rounded-[10px] overflow-hidden mt-4">
                {LINES.map((L, i) => (
                  <div
                    key={L.key}
                    className={`p-3.5 flex flex-col gap-1 ${booking.remaining[i] > 0n ? "mb-wash-before" : booking.refunded ? "mb-wash-returned" : "mb-wash-paid"}`}
                  >
                    <div className="text-sm font-medium">
                      <T id={L.id} en={L.en} />
                    </div>
                    <div
                      className={`mb-amt ${booking.remaining[i] > 0n ? "mb-before-text" : booking.refunded ? "mb-returned-text" : "mb-paid-text"}`}
                    >
                      {formatRp(booking.remaining[i])}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {booking && (
              <div className="text-sm mt-3 flex flex-wrap gap-3">
                <span>
                  <T id="Jamaah:" en="Pilgrim:" /> <AddressChip address={booking.pilgrim} />
                </span>
                <span>
                  <T id="Agen:" en="Agency:" /> <AddressChip address={booking.agency} topic={1} />
                </span>
              </div>
            )}

            <div className="mb-perforation" />

            <Label>
              <T id="Faktur vendor" en="Signed vendor invoice" />
            </Label>
            <p className="mb-p text-sm mb-muted mt-1">
              <T
                id={
                  <>
                    Tempel JSON dari halaman vendor, atau pilih <span className="mb-data text-sm">invoices.json</span>.
                    Tidak ada yang diambil dari server.
                  </>
                }
                en={
                  <>
                    Paste the vendor page&apos;s JSON or pick <span className="mb-data text-sm">invoices.json</span> —
                    nothing is fetched from a server.
                  </>
                }
              />
            </p>
            <textarea
              className="mb-textarea mt-2"
              value={paste}
              onChange={e => setPaste(e.target.value)}
              placeholder='{"invoice": {...}, "signature": "0x…"}'
              aria-label={t("Tempel faktur", "Paste invoice")}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className="mb-btn mb-btn-ghost mb-btn-sm"
                onClick={() => loadText(paste)}
                disabled={!paste.trim()}
              >
                <T id="Baca faktur" en="Read invoice" />
              </button>
              <button className="mb-btn mb-btn-ghost mb-btn-sm" onClick={() => fileRef.current?.click()}>
                <T id="Pilih invoices.json" en="Pick invoices.json" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={e => onFile(e.target.files?.[0])}
                aria-label={t("File faktur", "Invoice file")}
              />
              {invoices.length > 0 && (
                <button className="mb-link text-sm" onClick={() => setInvoices([])}>
                  <T id="kosongkan" en="clear" />
                </button>
              )}
            </div>
            {parseErr && (
              <p className="mb-p mt-2 mb-refused-text text-sm">
                <T id={parseErr.id} en={parseErr.en} />
              </p>
            )}
            <div className="mt-3">
              {invoices.map((inv, i) => (
                <InvoiceRow key={`${inv.signature}-${i}`} inv={inv} booking={booking} onAttempt={pushAttempt} />
              ))}
            </div>
          </div>

          <div className="mb-sheet">
            <Label>
              <T id="Ujrah agen" en="Agency fee" /> · releaseMargin
            </Label>
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
              placeholder={t("0x… atau JSON", "0x… or JSON")}
              aria-label={t("Tanda tangan keberangkatan", "Departure signature")}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                className="mb-btn"
                disabled={!booking || !depPaste.trim() || busy}
                onClick={() => releaseMargin(false)}
              >
                <T
                  id={`Buka ujrah ${booking ? formatRp(booking.remaining[3]) : ""}`}
                  en={`Release the fee ${booking ? formatRp(booking.remaining[3]) : ""}`}
                />
              </button>
              <button
                className="mb-btn mb-btn-ghost"
                disabled={!booking || !depPaste.trim() || busy}
                onClick={() => releaseMargin(true)}
              >
                <T id="Simulasi saja" en="Simulate only" />
              </button>
            </div>
            <InlineResult a={lastRelease} />
          </div>

          <div className="mb-sheet">
            <div className="flex justify-between items-center">
              <Label>
                <T id="Catatan percobaan" en="Attempt ledger" />
              </Label>
              {attempts.length > 0 && (
                <button
                  className="mb-link text-sm mb-muted"
                  onClick={() => {
                    setAttempts([]);
                    saveJson(storeKey(ATTEMPTS_KEY), []);
                  }}
                >
                  <T id="bersihkan" en="clear" />
                </button>
              )}
            </div>
            {attempts.length === 0 ? (
              <p className="mb-p text-sm mb-muted mt-2">
                <T id="Belum ada percobaan" en="No attempts yet" />
              </p>
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
            placeholder={t("alamat agen lain (opsional)", "another agency address (optional)")}
            value={agencyOverride}
            onChange={e => setAgencyOverride(e.target.value.trim())}
            aria-label={t("Alamat agen untuk panel regulator", "Agency address for the regulator panel")}
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
