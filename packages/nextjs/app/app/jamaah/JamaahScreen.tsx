"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Address, isAddress, parseSignature } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { Passbook } from "~~/components/mabrur/Passbook";
import { T } from "~~/components/mabrur/T";
import { AddressChip, Bi, ContractsGuard, Label, PageShell, RevertStamp, Rp, TxLink } from "~~/components/mabrur/ui";
import { useT } from "~~/hooks/mabrur/useLang";
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
import { AHMAD_ID, DEMO_NAMES, SITI_ID, TESTNET_CHAIN_ID, TESTNET_FAUCET } from "~~/utils/mabrur/demo";
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
import type { Bilingual } from "~~/utils/mabrur/i18n";
import { PERMIT_TYPES } from "~~/utils/mabrur/invoice";
import { defaultAgency, getLabel, loadJson, saveJson, setLabel } from "~~/utils/mabrur/names";

const DEFAULT_LINES = ["14.000.000", "9.000.000", "4.000.000", "5.000.000"];
const DAY = 86400;

const BookForm = ({ onBooked }: { onBooked: (id: bigint) => void }) => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { pbm, tidr, publicClient, chainId } = useMabrurContracts();
  const { run, busy } = useMabrurTx();
  const t = useT();

  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [lineStr, setLineStr] = useState<string[]>(DEFAULT_LINES);
  const [departBy, setDepartBy] = useState(0);
  const [ticketBy, setTicketBy] = useState(0);
  const [pre, setPre] = useState<DecodedRevert | undefined>();
  const [err, setErr] = useState<DecodedRevert | undefined>();
  const [step, setStep] = useState<Bilingual | undefined>();
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
      setStep({ id: "Menandatangani permit…", en: "Signing the permit…" });
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
      setStep({ id: "Mengirim book()…", en: "Sending book()…" });
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
      setStep(undefined);
    }
  };

  const needFaucet = address && total !== undefined && (balance ?? 0n) < total;

  return (
    <div className="mb-sheet">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <h2 className="mb-h2">
            <T id="Pesan paket umrah" en="Book an umrah package" />
          </h2>
        </div>
        <div className="text-right">
          <Label>
            <T id="No. kuitansi (berikutnya)" en="Next receipt no." />
          </Label>
          <span className="mb-data" title={nextId !== undefined ? idHex(nextId) : ""}>
            {address && nextId !== undefined ? shortHex(idHex(nextId), 8, 6) : "—"}
          </span>
        </div>
      </div>

      <div className="mb-perforation" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <div>
          <Label>
            <T id="Sudah terima dari" en="Received from" />
          </Label>
          {address ? (
            <AddressChip address={address} />
          ) : (
            <span className="mb-muted">
              <T id="Hubungkan dompet" en="Connect a wallet" />
            </span>
          )}
          <input
            className="mb-input mt-2"
            placeholder={t("Nama (opsional)", "Name (optional)")}
            title={t("Nama disimpan di browser ini saja", "The name stays in this browser only")}
            value={name}
            onChange={e => setName(e.target.value)}
            aria-label={t("Nama jamaah", "Pilgrim name")}
          />
        </div>
        <div>
          <Label>
            <T id="Saldo tIDR Anda" en="Your tIDR balance" />
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <Rp value={address ? (balance ?? 0n) : undefined} />
            {needFaucet && (
              <button
                className="mb-btn mb-btn-ghost mb-btn-sm"
                disabled={fauceting}
                onClick={() => writeTidr({ functionName: "faucet", args: [address] })}
              >
                <T id="Ambil tIDR uji" en="Get test tIDR" />
              </button>
            )}
          </div>
          <div className="text-sm mb-muted">
            <T id="tIDR = token uji, tanpa nilai" en="tIDR = test token, no value" />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Label>
          <T id="Agen (PPIU)" en="Agency (PPIU) address" />
        </Label>
        <input
          className="mb-input mb-data"
          placeholder={t("0x… alamat agen", "0x… agency address")}
          value={agency}
          onChange={e => setAgency(e.target.value.trim())}
          aria-label={t("Alamat agen", "Agency address")}
        />
        <div className="mt-2">{agencyOk && <AddressChip address={agency} topic={1} />}</div>
      </div>

      <div className="mt-5">
        <Label>
          <T id="Untuk pembayaran" en="The four earmarked lines" />
        </Label>
        {LINES.map((L, i) => (
          <div key={L.key} className="mb-row grid gap-2 sm:grid-cols-[1fr_200px] items-center">
            <div>
              <span className="font-medium">
                <T id={L.id} en={L.en} />
              </span>
              <span className="block text-sm mb-muted">
                <T id={L.ruleId} en={L.ruleEn} />
              </span>
            </div>
            <input
              className="mb-input mb-amt text-right"
              inputMode="numeric"
              value={lineStr[i]}
              onChange={e => setLineStr(s => s.map((x, j) => (j === i ? e.target.value : x)))}
              aria-label={t(`Jumlah ${L.id}`, `Amount for ${L.en}`)}
            />
          </div>
        ))}
        <div className="flex flex-wrap justify-between items-end gap-2 mt-3 pt-3 border-t border-[var(--rule)]">
          <Label className="pb-2">
            <T id="Jumlah" en="Total" />
          </Label>
          <Rp value={total} words className="text-right ml-auto" />
        </div>
        <div className="text-sm mb-muted">
          <T id="Ujrah agen maksimal 20% dari paket" en="The agency fee is capped at 20% of the package" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 mt-5">
        <div>
          <Label>
            <T id="Batas tiket" en="Ticket by" />
          </Label>
          <input
            type="datetime-local"
            className="mb-input"
            value={ticketBy ? toLocalInput(ticketBy) : ""}
            onChange={e => setTicketBy(fromLocalInput(e.target.value))}
            aria-label={t("Batas tiket", "Ticket-by date")}
          />
          <button
            className="mb-chip mb-chip-ink mb-hover mt-2 cursor-pointer"
            onClick={() => setTicketBy(Math.floor(Date.now() / 1000) + 600)}
          >
            <T id="Demo: 10 menit" en="Demo: 10 minutes" />
          </button>
          <p className="mb-p text-sm mb-muted mt-2">
            <T
              id="Jika tiket pesawat belum dibayar sampai tanggal ini, siapa pun bisa mengembalikan sisa dana ke Anda."
              en="If no flight ticket is paid by this date, anyone can return your remaining money."
            />
          </p>
        </div>
        <div>
          <Label>
            <T id="Batas berangkat" en="Depart by" />
          </Label>
          <input
            type="datetime-local"
            className="mb-input"
            value={departBy ? toLocalInput(departBy) : ""}
            onChange={e => setDepartBy(fromLocalInput(e.target.value))}
            aria-label={t("Batas berangkat", "Depart-by date")}
          />
          <p className="mb-p text-sm mb-muted mt-2">
            <T
              id="Jika belum berangkat sampai tanggal ini, siapa pun bisa mengembalikan sisa dana ke Anda. Maks. 180 hari."
              en="If you have not departed by this date, anyone can refund you. At most 180 days."
            />
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
          <T id={`Tanda tangani & bayar ${formatRp(total)}`} en={`Sign & pay ${formatRp(total)}`} />
        </button>
        <span className="text-sm mb-muted">
          <T id="1 tanda tangan (permit), tanpa approve terpisah" en="One signature (permit), no separate approve" />
        </span>
        {step && (
          <span className="text-sm">
            <T id={step.id} en={step.en} />
          </span>
        )}
        {lastTx && <TxLink hash={lastTx} />}
        {!address && (
          <span className="text-sm mb-muted">
            <T id="Hubungkan dompet untuk memesan" en="Connect a wallet to book" />
          </span>
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
    <span className="mb-chip mb-chip-returned">
      <T id="Dikembalikan" en="Refunded" />
    </span>
  ) : b.refundable && total > 0n ? (
    <span className="mb-chip mb-chip-refused">
      <T id="Bisa refund" en="Refundable" />
    </span>
  ) : b.flightVendor !== ZERO ? (
    <span className="mb-chip mb-chip-paid">
      <T id="Tiket lunas" en="Ticket paid" />
    </span>
  ) : (
    <span className="mb-chip mb-chip-before">
      <T
        id={`Batas tiket ${formatCountdown(Number(b.ticketBy) - now)}`}
        en={`Ticket by ${formatCountdown(Number(b.ticketBy) - now, "en")}`}
      />
    </span>
  );
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`mb-sheet mb-hover text-left w-full flex flex-col gap-1 cursor-pointer ${active ? "mb-active" : ""}`}
      style={{ padding: 14 }}
    >
      <span className="font-medium">{name ?? shortHex(idHex(b.id), 8, 6)}</span>
      <span className="mb-data mb-muted text-[12.5px]">{shortHex(idHex(b.id), 8, 6)}</span>
      <span className="mb-amt">{formatRp(total)}</span>
      <span className="text-sm mb-muted">
        <T
          id={`berangkat ≤ ${formatDateWIB(b.departBy, false)}`}
          en={`depart ≤ ${formatDateWIB(b.departBy, false, "en")}`}
        />
      </span>
      <span>{chip}</span>
    </button>
  );
};

type Params = { get: (key: string) => string | null };
const NO_PARAMS: Params = { get: () => null };

const JamaahInner = ({ params }: { params: Params }) => {
  const { address } = useAccount();
  const { chainId, chainName } = useMabrurContracts();
  const netName = chainId === TESTNET_CHAIN_ID ? chainName : "Arbitrum One";
  const router = useRouter();
  const t = useT();
  const idParam = params.get("id") ?? "";
  const pilgrimParam = params.get("pilgrim") ?? "";

  const [lookup, setLookup] = useState("");
  const [selected, setSelected] = useState<bigint | undefined>(parseBookingId(idParam));
  const pilgrim = (isAddress(pilgrimParam) ? pilgrimParam : address) as Address | undefined;
  const { data: mine } = useBookingsOf(pilgrim);
  const oneQuery = useBooking(selected);
  const one = oneQuery.data;

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
  const onBooked = (id: bigint) => setSelected(id);
  // The demo bookings are named before any RPC answers, so a deep-linked heading never flips once data lands (CLS).
  const name = useMemo(
    () =>
      (one ? (getLabel(idHex(one.id), chainId) ?? getLabel(one.pilgrim, chainId)) : undefined) ?? DEMO_NAMES[idParam],
    [one, chainId, idParam],
  );
  const { isError: oneError, refetch: refetchOne } = oneQuery;
  // A deep link that is still loading reserves the passbook's height instead of showing the empty picker.
  const loadingDeepLink = Boolean(idParam) && selected !== undefined && one === undefined;

  return (
    <PageShell>
      <header className="mb-8 lg:mb-10">
        <h1 className="mb-title">
          {name ? (
            <T id={`Buku Amanah ${name}`} en={`${name}'s passbook`} />
          ) : (
            <T id="Buku Amanah Jamaah" en="Pilgrim's passbook" />
          )}
        </h1>
        <p className="mb-p mb-lede mt-3">
          <T
            id="Uang muka Anda, disimpan per pos. Hanya faktur vendor berlisensi yang bisa memindahkannya."
            en="Your prepayment, earmarked line by line. Only a licensed vendor's invoice can move it."
          />
        </p>
      </header>

      {/* With a deep link the passbook is the point (a judge on a projector): it leads at every width and the booking
          form moves to the narrow side column. */}
      <div
        className={`grid grid-cols-1 gap-6 xl:gap-8 ${
          deepLink ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]" : "xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]"
        }`}
      >
        <div className="flex flex-col gap-6 min-w-0">
          {deepLink && !address ? (
            <details className="mb-sheet mb-disclosure">
              <summary className="mb-h2 cursor-pointer">
                <T id="Pesan paket baru" en="Book a new package" />
              </summary>
              <div className="mt-4">
                <BookForm onBooked={onBooked} />
              </div>
            </details>
          ) : (
            <BookForm onBooked={onBooked} />
          )}
          <div className="mb-sheet">
            <Label>
              <T id="Lihat booking" en="Look up a booking" />
            </Label>
            <p className="mb-p text-sm mb-muted mt-1">
              <T
                id="Alamat jamaah atau id booking. Refund boleh ditekan siapa pun."
                en="A pilgrim address or a booking id. Anyone may press refund."
              />
            </p>
            <div className="flex gap-2 mt-2">
              <input
                className="mb-input mb-data"
                value={lookup}
                onChange={e => setLookup(e.target.value)}
                placeholder="0x…"
                aria-label={t("Alamat atau id booking", "Pilgrim address or booking id")}
              />
              <button className="mb-btn mb-btn-ghost" onClick={go}>
                <T id="Lihat" en="View" />
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
              <p className="mb-p mt-3 text-sm mb-muted">
                <T
                  id={`Belum ada booking untuk ${shortHex(pilgrim)}.`}
                  en={`No bookings yet for ${shortHex(pilgrim)}.`}
                />
              </p>
            )}
          </div>
        </div>
        <div className={`min-w-0 ${deepLink ? "order-first" : ""}`}>
          {one ? (
            <Passbook b={one} name={name} />
          ) : loadingDeepLink ? (
            <div className="mb-sheet mb-passbook-skel" aria-busy="true" data-testid="passbook-loading">
              {oneError ? (
                <div className="flex flex-col gap-3 items-start">
                  <p className="mb-p">
                    <T
                      id={`Jaringan lambat: booking ini belum terbaca dari ${netName}.`}
                      en={`Slow network: this booking has not been read from ${netName} yet.`}
                    />
                  </p>
                  <button type="button" className="mb-btn mb-btn-ghost mb-btn-sm" onClick={() => void refetchOne()}>
                    <T id="Coba lagi" en="Retry" />
                  </button>
                </div>
              ) : (
                <p className="mb-p mb-muted">
                  <T id={`Membaca booking dari ${netName}…`} en={`Reading the booking from ${netName}…`} />
                </p>
              )}
            </div>
          ) : (
            <div className="mb-sheet mb-empty">
              <Bi
                id={selected !== undefined && one === null ? "Booking tidak ditemukan." : "Pilih atau buat booking."}
                en={selected !== undefined && one === null ? "No booking with this id." : "Pick or create a booking."}
              />
              <p className="mb-p mt-4 mb-muted text-sm">
                <T id={`Atau buka booking contoh di ${netName}:`} en={`Or open a demo booking on ${netName}:`} />
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <Link className="mb-btn mb-btn-ghost mb-go" href={`/app/jamaah?id=${AHMAD_ID}`}>
                  <T id="Buku Amanah Pak Ahmad" en="Pak Ahmad's passbook" />
                </Link>
                <Link className="mb-btn mb-btn-ghost mb-go" href={`/app/jamaah?id=${SITI_ID}`}>
                  <T id="Buku Amanah Ibu Siti" en="Ibu Siti's passbook" />
                </Link>
              </div>
              {chainId === TESTNET_CHAIN_ID && (
                <p className="mb-p mt-4 mb-muted text-sm">
                  <T
                    id={`Testnet ${chainName}: ambil ETH uji gratis dari faucet, lalu buat booking sendiri di kiri.`}
                    en={`${chainName} testnet: get free test ETH from a faucet, then make your own booking on the left.`}
                  />{" "}
                  <a className="mb-link" href={TESTNET_FAUCET} target="_blank" rel="noreferrer">
                    Faucet ↗
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
};

const JamaahWithParams = () => <JamaahInner params={useSearchParams()} />;

/** Params the server already knows (page.tsx reads searchParams), so the first HTML is the deep-linked page. */
export const paramsOf = (initial: { id?: string; pilgrim?: string }): Params => ({
  get: key => (key === "id" ? (initial.id ?? null) : key === "pilgrim" ? (initial.pilgrim ?? null) : null),
});

// The Suspense fallback renders with the params the server read from the URL, so the server HTML already carries the
// deep-linked heading and the reserved passbook (LCP on first paint, no layout jump on hydrate).
export default function JamaahScreen({ initialId, initialPilgrim }: { initialId?: string; initialPilgrim?: string }) {
  const initial = initialId || initialPilgrim ? paramsOf({ id: initialId, pilgrim: initialPilgrim }) : NO_PARAMS;
  return (
    <ContractsGuard>
      <Suspense fallback={<JamaahInner params={initial} />}>
        <JamaahWithParams />
      </Suspense>
    </ContractsGuard>
  );
}
