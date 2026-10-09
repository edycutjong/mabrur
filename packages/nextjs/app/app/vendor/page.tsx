"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Hex, isHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount, useWalletClient } from "wagmi";
import { AddressChip, Bi, ClaimBadge, ContractsGuard, CopyButton, Label, PageShell, Rp } from "~~/components/mabrur/ui";
import { useMabrurContracts } from "~~/hooks/mabrur/useMabrur";
import { decodeRevert } from "~~/utils/mabrur/errors";
import {
  LINES,
  formatDateWIB,
  fromLocalInput,
  idHex,
  parseBookingId,
  parseRp,
  shortHex,
  toLocalInput,
} from "~~/utils/mabrur/format";
import {
  INVOICE_TYPES,
  InvoiceParseError,
  SignedInvoice,
  invoiceToJson,
  pbmDomain,
  refToBytes32,
  utf8Length,
} from "~~/utils/mabrur/invoice";

// The vendor's OWN key: a burner kept only in this browser's storage, or an injected wallet.
const PK_KEY = "mabrur.vendor.burnerPk";

/** secp256k1 group order: a private key must be in [1, N). */
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

/** The account for a key, or undefined for anything that is not a valid secp256k1 private key. Never throws. */
const accountFor = (pk: string | null | undefined) => {
  if (!pk || !isHex(pk) || pk.length !== 66) return undefined;
  const n = BigInt(pk);
  if (n === 0n || n >= SECP256K1_N) return undefined;
  try {
    return privateKeyToAccount(pk);
  } catch {
    return undefined;
  }
};

const storeSet = (v: string | undefined) => {
  try {
    if (v) window.localStorage.setItem(PK_KEY, v);
    else window.localStorage.removeItem(PK_KEY);
  } catch {
    /* storage blocked: the burner is ephemeral */
  }
};

const VendorInner = () => {
  const { pbm, chainId } = useMabrurContracts();
  const { address: walletAddr } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [mode, setMode] = useState<"burner" | "wallet">("burner");
  const [pk, setPk] = useState<Hex | undefined>();
  const [importPk, setImportPk] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [line, setLine] = useState(1);
  const [amount, setAmount] = useState("9.000.000");
  const [ref, setRef] = useState("INV-HTL-0001");
  const [expiry, setExpiry] = useState(0);
  const [signed, setSigned] = useState<SignedInvoice | undefined>();
  const [err, setErr] = useState("");
  const [keyNote, setKeyNote] = useState("");
  // a destructive key action waiting for confirmation (the old key is gone for good once replaced or cleared)
  const [pending, setPending] = useState<"new" | "clear" | undefined>();

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(PK_KEY);
    } catch {
      /* storage blocked */
    }
    if (stored && accountFor(stored)) setPk(stored as Hex);
    else {
      if (stored)
        setKeyNote(
          "Kunci burner tersimpan tidak sah dan sudah dihapus; burner baru dibuat. · The stored burner key was invalid and has been cleared; a new burner was created.",
        );
      const fresh = generatePrivateKey();
      setPk(fresh);
      storeSet(fresh);
    }
    setExpiry(Math.floor(Date.now() / 1000) + 2 * 86400);
  }, []);

  const burner = useMemo(() => accountFor(pk), [pk]);
  const signerAddr = mode === "burner" ? burner?.address : walletAddr;

  const id = parseBookingId(bookingId);
  const amt = parseRp(amount);

  const doImport = () => {
    const v = importPk.trim();
    const hex = (v.startsWith("0x") ? v : `0x${v}`) as Hex;
    if (!accountFor(hex)) {
      setKeyNote(
        "Kunci tidak sah: harus 32 byte hex, bukan nol, di bawah orde kurva secp256k1. · Invalid key: 32-byte hex, non-zero, below the secp256k1 curve order.",
      );
      return;
    }
    setPk(hex);
    storeSet(hex);
    setImportPk("");
    setKeyNote("");
    setErr("");
    setPending(undefined);
    setSigned(undefined);
  };

  const replaceBurner = (next: "new" | "clear") => {
    const fresh = next === "new" ? generatePrivateKey() : undefined;
    setPk(fresh);
    storeSet(fresh);
    // the old output was signed by the old key: never leave it on screen under the new signer
    setSigned(undefined);
    setErr("");
    setKeyNote(next === "clear" ? "Burner dihapus dari browser ini. · Burner cleared from this browser." : "");
    setPending(undefined);
  };

  const refBytes = utf8Length(ref);
  const refErr =
    refBytes > 32 && !(isHex(ref) && ref.length === 66)
      ? `No. faktur ${refBytes} byte (UTF-8), maks. 32 · ref is ${refBytes} bytes, at most 32 fit`
      : "";

  const sign = async () => {
    setErr("");
    setSigned(undefined);
    if (!pbm || id === undefined || amt === undefined) return;
    try {
      const invoice = { bookingId: id, line, amount: amt, ref: refToBytes32(ref), expiry: BigInt(expiry) };
      const args = {
        domain: pbmDomain(chainId, pbm.address),
        types: INVOICE_TYPES,
        primaryType: "Invoice" as const,
        message: invoice,
      };
      let signature: Hex;
      if (mode === "burner") {
        if (!burner) return;
        signature = await burner.signTypedData(args);
      } else {
        if (!walletClient) return;
        signature = await walletClient.signTypedData(args);
      }
      setSigned({ invoice, signature, refLabel: ref, signer: signerAddr });
    } catch (e) {
      setErr(e instanceof InvoiceParseError ? e.message : decodeRevert(e).id);
    }
  };

  const json = signed ? invoiceToJson(signed, { chainId, verifyingContract: pbm?.address }) : "";
  const L = LINES[line];

  return (
    <PageShell>
      <header className="mb-6">
        <Label>Vendor berlisensi · licensed vendor</Label>
        <h1 className="mb-title">Tanda tangani faktur</h1>
        <span className="mb-en">Sign an invoice with your own key — nobody else chooses the payee.</span>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 max-w-6xl">
        <div className="mb-sheet flex flex-col gap-4">
          <div>
            <Label>Kunci vendor · your key</Label>
            <div className="flex gap-2 mt-2">
              <button
                className={`mb-btn mb-btn-sm ${mode === "burner" ? "" : "mb-btn-ghost"}`}
                aria-pressed={mode === "burner"}
                onClick={() => {
                  if (mode !== "burner") setSigned(undefined);
                  setMode("burner");
                }}
              >
                Burner di browser ini
              </button>
              <button
                className={`mb-btn mb-btn-sm ${mode === "wallet" ? "" : "mb-btn-ghost"}`}
                aria-pressed={mode === "wallet"}
                onClick={() => {
                  if (mode !== "wallet") setSigned(undefined);
                  setMode("wallet");
                }}
              >
                Dompet terhubung
              </button>
            </div>
          </div>
          <div>
            <Label>Alamat penanda tangan · signer</Label>
            {signerAddr ? (
              <AddressChip address={signerAddr} />
            ) : (
              <span className="mb-muted">
                {mode === "burner" ? "Belum ada burner · no burner key" : "Hubungkan dompet"}
              </span>
            )}
            {signerAddr && (
              <div className="flex flex-wrap gap-2 mt-2">
                <ClaimBadge address={signerAddr} topic={2} />
                <ClaimBadge address={signerAddr} topic={3} />
                <ClaimBadge address={signerAddr} topic={4} />
              </div>
            )}
          </div>
          {mode === "burner" && (
            <details>
              <summary className="cursor-pointer text-sm font-bold">Ganti / impor kunci burner</summary>
              <p className="mb-p text-sm mb-muted mt-2">
                Kunci hanya disimpan di localStorage browser ini, tidak pernah dikirim. · Stored only in this browser.
              </p>
              <div className="flex gap-2 mt-2">
                <input
                  type="password"
                  className="mb-input mb-data text-sm"
                  value={importPk}
                  onChange={e => setImportPk(e.target.value)}
                  placeholder="0x… kunci privat vendor"
                  aria-label="Impor kunci privat"
                  autoComplete="off"
                />
                <button className="mb-btn mb-btn-ghost mb-btn-sm" onClick={doImport}>
                  Impor
                </button>
              </div>
              {!pending ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  <button
                    className="mb-link text-sm"
                    onClick={() => (burner ? setPending("new") : replaceBurner("new"))}
                  >
                    Buat burner baru
                  </button>
                  {burner && (
                    <button className="mb-link text-sm" onClick={() => setPending("clear")}>
                      Hapus burner
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2 rounded-[10px] p-3 mb-wash-before" role="alertdialog">
                  <p className="mb-p text-sm font-bold">
                    {pending === "new" ? "Ganti kunci burner?" : "Hapus kunci burner?"} Kunci lama hilang selamanya dari
                    browser ini — salin dulu jika masih perlu.
                    <span className="mb-en">
                      The current key is gone for good from this browser — copy it first if you still need it.
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pk && <CopyButton text={pk} label="Salin kunci lama" />}
                    <button className="mb-btn mb-btn-sm" onClick={() => replaceBurner(pending)}>
                      {pending === "new" ? "Ya, buat burner baru" : "Ya, hapus burner"}
                    </button>
                    <button className="mb-btn mb-btn-ghost mb-btn-sm" onClick={() => setPending(undefined)}>
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </details>
          )}
          {keyNote && (
            <p className="mb-p text-sm mb-refused-text" role="status">
              {keyNote}
            </p>
          )}

          <div className="mb-perforation" />

          <div>
            <Label>Id booking</Label>
            <input
              className="mb-input mb-data"
              value={bookingId}
              onChange={e => setBookingId(e.target.value.trim())}
              placeholder="0x…"
              aria-label="Id booking"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Pos · line</Label>
              <select
                className="mb-select"
                value={line}
                onChange={e => setLine(Number(e.target.value))}
                aria-label="Pos"
              >
                {LINES.slice(0, 3).map((x, i) => (
                  <option key={x.key} value={i}>
                    {x.id} · {x.en}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Jumlah · amount</Label>
              <input
                className="mb-input mb-num text-right"
                inputMode="numeric"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                aria-label="Jumlah"
              />
            </div>
          </div>
          {line === 0 && (
            <p className="mb-p text-sm mb-muted">
              Faktur tiket harus melunasi seluruh pos tiket · a flight invoice must pay the whole flight line.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>No. faktur · ref</Label>
              <input
                className="mb-input mb-data"
                value={ref}
                maxLength={66}
                onChange={e => setRef(e.target.value)}
                aria-label="Nomor faktur"
                aria-invalid={refErr ? true : undefined}
                aria-describedby={refErr ? "ref-err" : undefined}
              />
              {refErr && (
                <p id="ref-err" className="mb-p text-sm mb-refused-text mt-1">
                  {refErr}
                </p>
              )}
            </div>
            <div>
              <Label>Berlaku s.d. · expiry</Label>
              <input
                type="datetime-local"
                className="mb-input"
                value={expiry ? toLocalInput(expiry) : ""}
                onChange={e => setExpiry(fromLocalInput(e.target.value))}
                aria-label="Kedaluwarsa"
              />
            </div>
          </div>

          <p className="mb-p font-bold">
            <Bi
              id="Uang hanya bisa dibayarkan ke alamat yang menandatangani faktur ini — alamat Anda."
              en="Money can only be paid to the address that signs this invoice — yours."
            />
          </p>
          <button
            className="mb-btn"
            disabled={id === undefined || amt === undefined || !signerAddr || !expiry || Boolean(refErr)}
            onClick={sign}
          >
            Tanda tangani faktur
          </button>
          {err && <p className="mb-p mb-refused-text text-sm">{err}</p>}
        </div>

        <div className="mb-sheet flex flex-col gap-4">
          <Label>Faktur bertanda tangan · signed invoice</Label>
          {!signed ? (
            <p className="mb-p mb-muted">
              <Bi id="Isi formulir lalu tanda tangani." en="Fill the form, then sign." />
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-1">
                <span className="mb-label">No. faktur</span>
                <span className="mb-data">{signed.refLabel}</span>
                <span className="mb-label">Booking</span>
                <span
                  className="mb-data text-sm whitespace-nowrap overflow-hidden text-ellipsis [word-break:normal] min-w-0"
                  title={idHex(signed.invoice.bookingId)}
                >
                  {shortHex(idHex(signed.invoice.bookingId), 8, 6)}
                </span>
                <span className="mb-label">Pos</span>
                <span>{L.id}</span>
                <span className="mb-label">Jumlah</span>
                <Rp value={signed.invoice.amount} words />
                <span className="mb-label">Berlaku s.d.</span>
                <span className="mb-num">{formatDateWIB(signed.invoice.expiry)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label>JSON untuk konsol agen</Label>
                <CopyButton text={json} />
              </div>
              <pre
                className="mb-textarea whitespace-pre-wrap [overflow-wrap:anywhere] text-xs"
                style={{ minHeight: 0 }}
              >
                {json}
              </pre>
              <div className="bg-white p-3 self-start rounded-[10px] border border-[var(--rule)]">
                <QRCodeSVG value={json} size={260} level="L" />
              </div>
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default function VendorPage() {
  return (
    <ContractsGuard>
      <VendorInner />
    </ContractsGuard>
  );
}
