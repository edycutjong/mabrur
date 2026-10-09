"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Hex, isHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount, useWalletClient } from "wagmi";
import { T } from "~~/components/mabrur/T";
import { AddressChip, Bi, ClaimBadge, ContractsGuard, CopyButton, Label, PageShell, Rp } from "~~/components/mabrur/ui";
import { useT } from "~~/hooks/mabrur/useLang";
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
import type { Bilingual } from "~~/utils/mabrur/i18n";
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
  const t = useT();

  const [mode, setMode] = useState<"burner" | "wallet">("burner");
  const [pk, setPk] = useState<Hex | undefined>();
  const [importPk, setImportPk] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [line, setLine] = useState(1);
  const [amount, setAmount] = useState("9.000.000");
  const [ref, setRef] = useState("INV-HTL-0001");
  const [expiry, setExpiry] = useState(0);
  const [signed, setSigned] = useState<SignedInvoice | undefined>();
  const [err, setErr] = useState<Bilingual | undefined>();
  const [keyNote, setKeyNote] = useState<Bilingual | undefined>();
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
        setKeyNote({
          id: "Kunci burner tersimpan tidak sah dan sudah dihapus; burner baru dibuat.",
          en: "The stored burner key was invalid and has been cleared; a new burner was created.",
        });
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
      setKeyNote({
        id: "Kunci tidak sah: harus 32 byte hex, bukan nol, di bawah orde kurva secp256k1.",
        en: "Invalid key: it must be 32 bytes of hex, non-zero, below the secp256k1 curve order.",
      });
      return;
    }
    setPk(hex);
    storeSet(hex);
    setImportPk("");
    setKeyNote(undefined);
    setErr(undefined);
    setPending(undefined);
    setSigned(undefined);
  };

  const replaceBurner = (next: "new" | "clear") => {
    const fresh = next === "new" ? generatePrivateKey() : undefined;
    setPk(fresh);
    storeSet(fresh);
    // the old output was signed by the old key: never leave it on screen under the new signer
    setSigned(undefined);
    setErr(undefined);
    setKeyNote(
      next === "clear"
        ? { id: "Burner dihapus dari browser ini.", en: "Burner cleared from this browser." }
        : undefined,
    );
    setPending(undefined);
  };

  const refBytes = utf8Length(ref);
  const refErr: Bilingual | undefined =
    refBytes > 32 && !(isHex(ref) && ref.length === 66)
      ? {
          id: `No. faktur ${refBytes} byte (UTF-8), maks. 32`,
          en: `The invoice no. is ${refBytes} bytes (UTF-8); at most 32 fit`,
        }
      : undefined;

  const sign = async () => {
    setErr(undefined);
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
        // the sign button is disabled without a burner; a race surfaces through the catch below
        signature = await burner!.signTypedData(args);
      } else {
        if (!walletClient) return;
        signature = await walletClient.signTypedData(args);
      }
      setSigned({ invoice, signature, refLabel: ref, signer: signerAddr });
    } catch (e) {
      if (e instanceof InvoiceParseError)
        setErr({ id: `Faktur tidak sah: ${e.message}`, en: `Invalid invoice: ${e.message}` });
      else {
        const d = decodeRevert(e);
        setErr({ id: d.id, en: d.en });
      }
    }
  };

  const json = signed ? invoiceToJson(signed, { chainId, verifyingContract: pbm?.address }) : "";
  const L = LINES[line];

  return (
    <PageShell>
      <header className="mb-8 lg:mb-10">
        <Label className="mb-runhead">
          <T id="Vendor berlisensi" en="Licensed vendor" />
        </Label>
        <h1 className="mb-title">
          <T id="Tanda tangani faktur" en="Sign an invoice" />
        </h1>
        <p className="mb-p mb-lede mt-3">
          <T
            id="Tanda tangani faktur dengan kunci Anda sendiri — tidak ada orang lain yang memilih penerima uang."
            en="Sign an invoice with your own key — nobody else chooses the payee."
          />
        </p>
      </header>

      <div className="grid gap-6 xl:gap-8 lg:grid-cols-2 max-w-6xl">
        <div className="mb-sheet flex flex-col gap-4">
          <div>
            <Label>
              <T id="Kunci vendor" en="Your vendor key" />
            </Label>
            <div className="mb-seg mt-2">
              <button
                type="button"
                aria-pressed={mode === "burner"}
                onClick={() => {
                  if (mode !== "burner") setSigned(undefined);
                  setMode("burner");
                }}
              >
                <T id="Burner di browser ini" en="Burner in this browser" />
              </button>
              <button
                type="button"
                aria-pressed={mode === "wallet"}
                onClick={() => {
                  if (mode !== "wallet") setSigned(undefined);
                  setMode("wallet");
                }}
              >
                <T id="Dompet terhubung" en="Connected wallet" />
              </button>
            </div>
          </div>
          <div>
            <Label>
              <T id="Alamat penanda tangan" en="Signer address" />
            </Label>
            {signerAddr ? (
              <AddressChip address={signerAddr} />
            ) : (
              <span className="mb-muted">
                {mode === "burner" ? (
                  <T id="Belum ada burner" en="No burner key yet" />
                ) : (
                  <T id="Hubungkan dompet" en="Connect a wallet" />
                )}
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
              <summary className="cursor-pointer text-sm font-medium text-[var(--returned)] hover:text-[var(--paid-ink)]">
                <T id="Ganti / impor kunci burner" en="Replace / import the burner key" />
              </summary>
              <p className="mb-p text-sm mb-muted mt-2">
                <T
                  id="Kunci hanya disimpan di localStorage browser ini, tidak pernah dikirim."
                  en="The key is kept only in this browser's localStorage and is never sent anywhere."
                />
              </p>
              <div className="flex gap-2 mt-2">
                <input
                  type="password"
                  className="mb-input mb-data text-sm"
                  value={importPk}
                  onChange={e => setImportPk(e.target.value)}
                  placeholder={t("0x… kunci privat vendor", "0x… vendor private key")}
                  aria-label={t("Impor kunci privat", "Import private key")}
                  autoComplete="off"
                />
                <button className="mb-btn mb-btn-ghost mb-btn-sm" onClick={doImport}>
                  <T id="Impor" en="Import" />
                </button>
              </div>
              {!pending ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  <button
                    className="mb-link text-sm"
                    onClick={() => (burner ? setPending("new") : replaceBurner("new"))}
                  >
                    <T id="Buat burner baru" en="Create a new burner" />
                  </button>
                  {burner && (
                    <button className="mb-link text-sm" onClick={() => setPending("clear")}>
                      <T id="Hapus burner" en="Clear burner" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2 rounded-[10px] p-3 mb-wash-before" role="alertdialog">
                  <p className="mb-p text-sm font-bold">
                    <T
                      id={`${pending === "new" ? "Ganti kunci burner?" : "Hapus kunci burner?"} Kunci lama hilang selamanya dari browser ini — salin dulu jika masih perlu.`}
                      en={`${pending === "new" ? "Replace the burner key?" : "Clear the burner key?"} The current key is gone for good from this browser — copy it first if you still need it.`}
                    />
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pk && <CopyButton text={pk} label={<T id="Salin kunci lama" en="Copy the old key" />} />}
                    <button className="mb-btn mb-btn-sm" onClick={() => replaceBurner(pending)}>
                      {pending === "new" ? (
                        <T id="Ya, buat burner baru" en="Yes, create a new burner" />
                      ) : (
                        <T id="Ya, hapus burner" en="Yes, clear the burner" />
                      )}
                    </button>
                    <button className="mb-btn mb-btn-ghost mb-btn-sm" onClick={() => setPending(undefined)}>
                      <T id="Batal" en="Cancel" />
                    </button>
                  </div>
                </div>
              )}
            </details>
          )}
          {keyNote && (
            <p className="mb-p text-sm mb-refused-text" role="status">
              <T id={keyNote.id} en={keyNote.en} />
            </p>
          )}

          <div className="mb-perforation" />

          <div>
            <Label>
              <T id="Id booking" en="Booking id" />
            </Label>
            <input
              className="mb-input mb-data"
              value={bookingId}
              onChange={e => setBookingId(e.target.value.trim())}
              placeholder="0x…"
              aria-label={t("Id booking", "Booking id")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>
                <T id="Pos" en="Line" />
              </Label>
              <select
                className="mb-select"
                value={line}
                onChange={e => setLine(Number(e.target.value))}
                aria-label={t("Pos", "Line")}
              >
                {LINES.slice(0, 3).map((x, i) => (
                  <option key={x.key} value={i}>
                    {t(x.id, x.en)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>
                <T id="Jumlah" en="Amount" />
              </Label>
              <input
                className="mb-input mb-amt text-right"
                inputMode="numeric"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                aria-label={t("Jumlah", "Amount")}
              />
            </div>
          </div>
          {line === 0 && (
            <p className="mb-p text-sm mb-muted">
              <T
                id="Faktur tiket harus melunasi seluruh pos tiket pesawat."
                en="A flight invoice must pay the whole flight line."
              />
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>
                <T id="No. faktur" en="Invoice no." />
              </Label>
              <input
                className="mb-input mb-data"
                value={ref}
                maxLength={66}
                onChange={e => setRef(e.target.value)}
                aria-label={t("Nomor faktur", "Invoice number")}
                aria-invalid={refErr ? true : undefined}
                aria-describedby={refErr ? "ref-err" : undefined}
              />
              {refErr && (
                <p id="ref-err" className="mb-p text-sm mb-refused-text mt-1">
                  <T id={refErr.id} en={refErr.en} />
                </p>
              )}
            </div>
            <div>
              <Label>
                <T id="Berlaku s.d." en="Valid until" />
              </Label>
              <input
                type="datetime-local"
                className="mb-input"
                value={expiry ? toLocalInput(expiry) : ""}
                onChange={e => setExpiry(fromLocalInput(e.target.value))}
                aria-label={t("Kedaluwarsa", "Expiry")}
              />
            </div>
          </div>

          <p className="mb-p font-medium text-[var(--returned)] rounded-[8px] bg-[var(--returned-wash)] px-4 py-3">
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
            <T id="Tanda tangani faktur" en="Sign the invoice" />
          </button>
          {err && (
            <p className="mb-p mb-refused-text text-sm">
              <T id={err.id} en={err.en} />
            </p>
          )}
        </div>

        <div className="mb-sheet mb-slip flex flex-col gap-4 lg:self-start">
          <Label>
            <T id="Faktur bertanda tangan" en="Signed invoice" />
          </Label>
          {!signed ? (
            <p className="mb-p mb-muted">
              <Bi id="Isi formulir lalu tanda tangani." en="Fill the form, then sign." />
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2 items-baseline">
                <span className="mb-label">
                  <T id="No. faktur" en="Invoice no." />
                </span>
                <span className="mb-data font-medium">{signed.refLabel}</span>
                <span className="mb-label">Booking</span>
                <span
                  className="mb-data text-sm whitespace-nowrap overflow-hidden text-ellipsis [word-break:normal] min-w-0"
                  title={idHex(signed.invoice.bookingId)}
                >
                  {shortHex(idHex(signed.invoice.bookingId), 8, 6)}
                </span>
                <span className="mb-label">
                  <T id="Pos" en="Line" />
                </span>
                <span>
                  <T id={L.id} en={L.en} />
                </span>
                <span className="mb-label">
                  <T id="Jumlah" en="Amount" />
                </span>
                <Rp value={signed.invoice.amount} words />
                <span className="mb-label">
                  <T id="Berlaku s.d." en="Valid until" />
                </span>
                <span className="mb-num">
                  <T id={formatDateWIB(signed.invoice.expiry)} en={formatDateWIB(signed.invoice.expiry, true, "en")} />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Label>
                  <T id="JSON untuk konsol agen" en="JSON for the agency console" />
                </Label>
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
