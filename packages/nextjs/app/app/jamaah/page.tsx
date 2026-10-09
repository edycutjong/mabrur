"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Address, isAddress, parseSignature } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { Passbook } from "~~/components/mabrur/Passbook";
import { AddressChip, Bi, ContractsGuard, Label, PageShell, RevertStamp, Rp, TxLink } from "~~/components/mabrur/ui";
import {
  Booking,
  ZERO,
  eventsFrom,
  useBooking,
  useBookingsOf,
  useChainNow,
  useMabrurContracts,
  useMabrurTx,
} from "~~/hooks/mabrur/useMabrur";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { DecodedRevert, decodeRevert } from "~~/utils/mabrur/errors";
import {
  LINES,
  formatCountdown,
  formatDateWIB,
  formatRp,
  fromLocalInput,
  idHex,
  parseBookingId,
  parseRp,
  shortHex,
  toLocalInput,
} from "~~/utils/mabrur/format";
import { PERMIT_TYPES } from "~~/utils/mabrur/invoice";
import { defaultAgency, getLabel, loadJson, saveJson, setLabel } from "~~/utils/mabrur/names";

const DEFAULT_LINES = ["14.000.000", "9.000.000", "4.000.000", "5.000.000"];
const DAY = 86400;

const BookForm = ({ onBooked }: { onBooked: (id: bigint) => void }) => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { pbm, tidr, publicClient, chainId } = useMabrurContracts();
  const { run, busy } = useMabrurTx();

  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [lineStr, setLineStr] = useState<string[]>(DEFAULT_LINES);
  const [departBy, setDepartBy] = useState(0);
  const [ticketBy, setTicketBy] = useState(0);
  const [pre, setPre] = useState<DecodedRevert | undefined>();
  const [err, setErr] = useState<DecodedRevert | undefined>();
  const [step, setStep] = useState<string>("");
  const [lastTx, setLastTx] = useState<string | undefined>();

  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    setDepartBy(now + 30 * DAY);
    setTicketBy(now + 20 * DAY);
  }, []);
  useEffect(() => {
    setAgency(loadJson<string>(`mabrur.agency.${chainId}`, "") || defaultAgency(chainId));
  }, [chainId]);
  useEffect(() => {
    if (address) setName(getLabel(address) ?? "");
  }, [address]);

  const lines = lineStr.map(s => parseRp(s));
  const linesOk = lines.every(l => l !== undefined);
  const total = linesOk ? (lines as bigint[]).reduce((a, b) => a + b, 0n) : undefined;
  const agencyOk = isAddress(agency);

  const { data: balance } = useScaffoldReadContract({
    contractName: "TIDR",
    functionName: "balanceOf",
    args: [address],
  });
  const { data: nonce } = useScaffoldReadContract({
    contractName: "MabrurPBM",
    functionName: "bookingNonce",
    args: [address],
  });
  const { data: nextId } = useScaffoldReadContract({
    contractName: "MabrurPBM",
    functionName: "bookingIdOf",
    args: [address, nonce],
  });
  const { writeContractAsync: writeTidr, isMining: fauceting } = useScaffoldWriteContract({ contractName: "TIDR" });

  // Preflight: simulate book() with an empty permit. Every check before the token pull (licence, dates, split) fires
  // here; ERC20InsufficientAllowance only means "not signed yet", which is the expected state.
  useEffect(() => {
    if (!pbm || !publicClient || !agencyOk || !linesOk || !departBy || !ticketBy) return;
    const t = setTimeout(async () => {
      try {
        await publicClient.simulateContract({
          address: pbm.address,
          abi: pbm.abi,
          functionName: "book",
          args: [
            agency as Address,
            lines as unknown as readonly [bigint, bigint, bigint, bigint],
            BigInt(ticketBy),
            BigInt(departBy),
            0n,
            0,
            `0x${"0".repeat(64)}`,
            `0x${"0".repeat(64)}`,
          ],
          account: (address ?? "0x000000000000000000000000000000000000dEaD") as Address,
        });
        setPre(undefined);
      } catch (e) {
        const d = decodeRevert(e);
        setPre(
          d.name === "ERC20InsufficientAllowance" || d.name === "ERC20InsufficientBalance" || !d.isRevert
            ? undefined
            : d,
        );
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pbm, publicClient, agency, lineStr.join("|"), departBy, ticketBy, address]);

  const book = async () => {
    if (!pbm || !tidr || !publicClient || !walletClient || !address || total === undefined) return;
    setErr(undefined);
    setLastTx(undefined);
    try {
      saveJson(`mabrur.agency.${chainId}`, agency);
      if (name) setLabel(address, name);
      setStep("Menandatangani permit…");
      const [, tokenName, version, domainChainId, verifyingContract] = (await publicClient.readContract({
        address: tidr.address,
        abi: tidr.abi,
        functionName: "eip712Domain",
      })) as readonly [string, string, string, bigint, Address, string, readonly bigint[]];
      const permitNonce = (await publicClient.readContract({
        address: tidr.address,
        abi: tidr.abi,
        functionName: "nonces",
        args: [address],
      })) as bigint;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sig = await walletClient.signTypedData({
        domain: { name: tokenName, version, chainId: Number(domainChainId), verifyingContract },
        types: PERMIT_TYPES,
        primaryType: "Permit",
        message: { owner: address, spender: pbm.address, value: total, nonce: permitNonce, deadline },
      });
      const { r, s, v, yParity } = parseSignature(sig);
      const vNum = v !== undefined ? Number(v) : 27 + (yParity ?? 0);
      setStep("Mengirim book()…");
      const out = await run({
        address: pbm.address,
        abi: pbm.abi,
        functionName: "book",
        args: [agency, lines, BigInt(ticketBy), BigInt(departBy), deadline, vNum, r, s],
      });
      if (out.kind === "mined") {
        setLastTx(out.hash);
        const ev = eventsFrom(out.receipt, pbm.abi, pbm.address).find(e => e.eventName === "Booked");
        const id: bigint | undefined = ev?.args.id ?? (out.result as bigint | undefined);
        if (id !== undefined) {
          if (name) setLabel(idHex(id), name);
          onBooked(id);
        }
      } else if (out.kind === "reverted" || out.kind === "failed") setErr(out.decoded);
    } catch (e) {
      setErr(decodeRevert(e));
    } finally {
      setStep("");
    }
  };

  const needFaucet = address && total !== undefined && (balance ?? 0n) < total;

  return (
    <div className="mb-sheet">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <h2 className="mb-title">Pesan paket umrah</h2>
          <span className="mb-en">Book an umrah package — one permit signature</span>
        </div>
        <div className="text-right">
          <Label>No. kuitansi (berikutnya)</Label>
          <span className="mb-data" title={nextId !== undefined ? idHex(nextId) : ""}>
            {address && nextId !== undefined ? shortHex(idHex(nextId), 8, 6) : "—"}
          </span>
        </div>
      </div>

      <div className="mb-perforation" />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Sudah terima dari · pilgrim</Label>
          {address ? <AddressChip address={address} /> : <span className="mb-muted">Hubungkan dompet</span>}
          <input
            className="mb-input mt-2"
            placeholder="Nama (disimpan di browser ini saja)"
            value={name}
            onChange={e => setName(e.target.value)}
            aria-label="Nama jamaah"
          />
        </div>
        <div>
          <Label>Saldo tIDR Anda</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Rp value={address ? (balance ?? 0n) : undefined} />
            {needFaucet && (
              <button
                className="mb-btn mb-btn-ghost mb-btn-sm"
                disabled={fauceting}
                onClick={() => writeTidr({ functionName: "faucet", args: [address] })}
              >
                Ambil tIDR uji
              </button>
            )}
          </div>
          <div className="text-sm mb-muted">tIDR = token uji, tanpa nilai · test token, no value</div>
        </div>
      </div>

      <div className="mt-4">
        <Label>Agen (PPIU) · agency address</Label>
        <input
          className="mb-input mb-data"
          placeholder="0x… alamat agen"
          value={agency}
          onChange={e => setAgency(e.target.value.trim())}
          aria-label="Alamat agen"
        />
        <div className="mt-2">{agencyOk && <AddressChip address={agency} topic={1} />}</div>
      </div>

      <div className="mt-5">
        <Label>Untuk pembayaran · the four earmarked lines</Label>
        {LINES.map((L, i) => (
          <div key={L.key} className="mb-row grid gap-2 sm:grid-cols-[1fr_200px] items-center">
            <div>
              <span className="font-bold">{L.id}</span>
              <span className="mb-en">
                {L.ruleId} · {L.ruleEn}
              </span>
            </div>
            <input
              className="mb-input mb-num text-right"
              inputMode="numeric"
              value={lineStr[i]}
              onChange={e => setLineStr(s => s.map((x, j) => (j === i ? e.target.value : x)))}
              aria-label={`Jumlah ${L.id}`}
            />
          </div>
        ))}
        <div className="flex flex-wrap justify-between items-baseline gap-2 mt-3">
          <Label>Jumlah</Label>
          <Rp value={total} words />
        </div>
        <div className="text-sm mb-muted">Ujrah agen maksimal 20% dari paket · fee capped at 20%</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-5">
        <div>
          <Label>Batas tiket · ticket by</Label>
          <input
            type="datetime-local"
            className="mb-input"
            value={ticketBy ? toLocalInput(ticketBy) : ""}
            onChange={e => setTicketBy(fromLocalInput(e.target.value))}
            aria-label="Batas tiket"
          />
          <button
            className="mb-chip mb-chip-ink mt-2 cursor-pointer"
            onClick={() => setTicketBy(Math.floor(Date.now() / 1000) + 600)}
          >
            Demo: 10 menit
          </button>
          <p className="mb-p text-sm mt-2">
            Jika tiket pesawat belum dibayar sampai tanggal ini, siapa pun bisa mengembalikan sisa dana ke Anda.
            <span className="mb-en">
              If no flight ticket is paid by this date, anyone can return your remaining money.
            </span>
          </p>
        </div>
        <div>
          <Label>Berangkat paling lambat · depart by</Label>
          <input
            type="datetime-local"
            className="mb-input"
            value={departBy ? toLocalInput(departBy) : ""}
            onChange={e => setDepartBy(fromLocalInput(e.target.value))}
            aria-label="Batas berangkat"
          />
          <p className="mb-p text-sm mt-2">
            Jika belum berangkat sampai tanggal ini, siapa pun bisa mengembalikan sisa dana ke Anda. Maks. 180 hari.
            <span className="mb-en">If you have not departed by this date, anyone can refund you. Max 180 days.</span>
          </p>
        </div>
      </div>

      {pre && (
        <div className="mt-4">
          <RevertStamp d={pre} simulated />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-1 items-start">
        <button
          className="mb-btn"
          disabled={!walletClient || !agencyOk || total === undefined || !!pre || busy || !!step || Boolean(needFaucet)}
          onClick={book}
        >
          Tanda tangani & bayar {formatRp(total)}
        </button>
        <span className="text-sm mb-muted">
          1 tanda tangan (permit) · tanpa approve terpisah · one signature, no separate approve
        </span>
        {step && <span className="text-sm">{step}</span>}
        {lastTx && <TxLink hash={lastTx} />}
        {!address && (
          <span className="text-sm mb-muted">Hubungkan dompet untuk memesan · connect a wallet to book</span>
        )}
      </div>

      {err && (
        <div className="mt-4">
          <RevertStamp d={err} simulated={err.isRevert} />
        </div>
      )}
    </div>
  );
};

/** A booking "has activity" once any line moved: a payout, a refund, or the margin release. */
const hasActivity = (b: Booking) =>
  b.refunded || b.marginReleased || b.flightVendor !== ZERO || b.remaining.reduce((x, y) => x + y, 0n) < b.deposited;

/** ?pilgrim= default: the newest booking with activity, else the newest booking (list is newest-first). */
const pickMeaningful = (bookings: Booking[]) => (bookings.find(hasActivity) ?? bookings[0])?.id;

const BookingTab = ({ b, active, onClick }: { b: Booking; active: boolean; onClick: () => void }) => {
  const { now } = useChainNow();
  const { chainId } = useMabrurContracts();
  const total = b.remaining.reduce((x, y) => x + y, 0n);
  const name = getLabel(idHex(b.id), chainId) ?? getLabel(b.pilgrim, chainId);
  const chip = b.refunded ? (
    <span className="mb-chip mb-chip-after">Dikembalikan</span>
  ) : b.refundable && total > 0n ? (
    <span className="mb-chip mb-chip-refused">Bisa refund</span>
  ) : b.flightVendor !== ZERO ? (
    <span className="mb-chip mb-chip-after">Tiket lunas</span>
  ) : (
    <span className="mb-chip mb-chip-before">Batas tiket {formatCountdown(Number(b.ticketBy) - now)}</span>
  );
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`mb-sheet mb-hover text-left w-full flex flex-col gap-1 cursor-pointer ${active ? "outline-3 outline-[var(--ink)]" : ""}`}
      style={{ padding: 14 }}
    >
      <span className="font-bold">{name ?? shortHex(idHex(b.id), 8, 6)}</span>
      <span className="mb-data text-sm">{shortHex(idHex(b.id), 8, 6)}</span>
      <span className="mb-num font-bold">{formatRp(total)}</span>
      <span className="text-sm mb-muted">berangkat ≤ {formatDateWIB(b.departBy, false)}</span>
      <span>{chip}</span>
    </button>
  );
};

const JamaahInner = () => {
  const { address } = useAccount();
  const { chainId } = useMabrurContracts();
  const router = useRouter();
  const params = useSearchParams();
  const idParam = params.get("id") ?? "";
  const pilgrimParam = params.get("pilgrim") ?? "";

  const [lookup, setLookup] = useState("");
  const [selected, setSelected] = useState<bigint | undefined>(parseBookingId(idParam));
  const pilgrim = (isAddress(pilgrimParam) ? pilgrimParam : address) as Address | undefined;
  const { data: mine } = useBookingsOf(pilgrim);
  const { data: one } = useBooking(selected);

  useEffect(() => {
    const id = parseBookingId(idParam);
    if (id !== undefined) setSelected(id);
  }, [idParam]);
  // A new ?pilgrim= (lookup) drops the previous pick so the next pilgrim's best booking is chosen.
  const lastPilgrim = useRef(pilgrimParam);
  useEffect(() => {
    if (lastPilgrim.current === pilgrimParam) return;
    lastPilgrim.current = pilgrimParam;
    if (parseBookingId(idParam) === undefined) setSelected(undefined);
  }, [pilgrimParam, idParam]);
  useEffect(() => {
    if (selected === undefined && mine?.bookings.length) setSelected(pickMeaningful(mine.bookings));
  }, [mine, selected]);

  const go = () => {
    const t = lookup.trim();
    if (isAddress(t)) router.push(`/app/jamaah?pilgrim=${t}`);
    else if (parseBookingId(t) !== undefined) router.push(`/app/jamaah?id=${t}`);
  };

  const deepLink = Boolean(idParam || pilgrimParam);
  const name = useMemo(
    () => (one ? (getLabel(idHex(one.id), chainId) ?? getLabel(one.pilgrim, chainId)) : undefined),
    [one, chainId],
  );

  return (
    <PageShell>
      <header className="mb-6">
        <Label>Jamaah · pilgrim</Label>
        <h1 className="mb-title">{name ? `Buku Amanah ${name}` : "Buku Amanah Jamaah"}</h1>
        <span className="mb-en">
          Your prepayment, earmarked line by line. Only a licensed vendor&apos;s invoice can move it.
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6 min-w-0">
          <BookForm onBooked={id => setSelected(id)} />
          <div className="mb-sheet">
            <Label>Lihat booking · look up</Label>
            <p className="mb-p text-sm mb-muted mt-1">
              Alamat jamaah atau id booking. Refund boleh ditekan siapa pun.
              <span className="mb-en">A pilgrim address or a booking id. Anyone may press refund.</span>
            </p>
            <div className="flex gap-2 mt-2">
              <input
                className="mb-input mb-data"
                value={lookup}
                onChange={e => setLookup(e.target.value)}
                placeholder="0x…"
                aria-label="Alamat atau id booking"
              />
              <button className="mb-btn mb-btn-ghost" onClick={go}>
                Lihat
              </button>
            </div>
            {mine && mine.bookings.length > 0 && (
              <div className="grid gap-3 mt-4 sm:grid-cols-2">
                {mine.bookings.map(b => (
                  <BookingTab
                    key={b.id.toString()}
                    b={b}
                    active={b.id === selected}
                    onClick={() => setSelected(b.id)}
                  />
                ))}
              </div>
            )}
            {pilgrim && mine && mine.bookings.length === 0 && (
              <p className="mb-p mt-3 text-sm mb-muted">Belum ada booking untuk {shortHex(pilgrim)}.</p>
            )}
          </div>
        </div>
        {/* With a deep link the passbook is the point: on narrow screens it comes before the booking form. */}
        <div className={`min-w-0 ${deepLink ? "order-first xl:order-none" : ""}`}>
          {one ? (
            <Passbook b={one} name={name} />
          ) : (
            <div className="mb-sheet">
              <Bi
                id={selected !== undefined && one === null ? "Booking tidak ditemukan." : "Pilih atau buat booking."}
                en={selected !== undefined && one === null ? "No booking with this id." : "Pick or create a booking."}
              />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default function JamaahPage() {
  return (
    <ContractsGuard>
      <Suspense>
        <JamaahInner />
      </Suspense>
    </ContractsGuard>
  );
}
