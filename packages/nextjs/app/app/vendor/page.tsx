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
  toLocalInput,
} from "~~/utils/mabrur/format";
import { INVOICE_TYPES, SignedInvoice, invoiceToJson, pbmDomain, refToBytes32 } from "~~/utils/mabrur/invoice";

// The vendor's OWN key: a burner kept only in this browser's storage, or an injected wallet.
const PK_KEY = "mabrur.vendor.burnerPk";

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

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(PK_KEY);
    } catch {
      /* storage blocked */
    }
    if (stored && isHex(stored) && stored.length === 66) setPk(stored);
    else {
      const fresh = generatePrivateKey();
      setPk(fresh);
      try {
        window.localStorage.setItem(PK_KEY, fresh);
      } catch {
        /* ephemeral burner */
      }
    }
    setExpiry(Math.floor(Date.now() / 1000) + 2 * 86400);
  }, []);

  const burner = useMemo(() => (pk ? privateKeyToAccount(pk) : undefined), [pk]);
  const signerAddr = mode === "burner" ? burner?.address : walletAddr;

  const id = parseBookingId(bookingId);
  const amt = parseRp(amount);

  const doImport = () => {
    const v = importPk.trim();
    const hex = (v.startsWith("0x") ? v : `0x${v}`) as Hex;
    if (!isHex(hex) || hex.length !== 66) {
      setErr("Kunci tidak sah (32 byte hex)");
      return;
    }
    setPk(hex);
    try {
      window.localStorage.setItem(PK_KEY, hex);
    } catch {
      /* ephemeral */
    }
    setImportPk("");
    setErr("");
  };

  const newBurner = () => {
    const fresh = generatePrivateKey();
    setPk(fresh);
    try {
      window.localStorage.setItem(PK_KEY, fresh);
    } catch {
      /* ephemeral */
    }
  };

  const sign = async () => {
    setErr("");
    setSigned(undefined);
    if (!pbm || id === undefined || amt === undefined) return;
    const invoice = { bookingId: id, line, amount: amt, ref: refToBytes32(ref), expiry: BigInt(expiry) };
    const args = {
      domain: pbmDomain(chainId, pbm.address),
      types: INVOICE_TYPES,
      primaryType: "Invoice" as const,
      message: invoice,
    };
    try {
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
      setErr(decodeRevert(e).id);
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
                onClick={() => setMode("burner")}
              >
                Burner di browser ini
              </button>
              <button
                className={`mb-btn mb-btn-sm ${mode === "wallet" ? "" : "mb-btn-ghost"}`}
                onClick={() => setMode("wallet")}
              >
                Dompet terhubung
              </button>
            </div>
          </div>
          <div>
            <Label>Alamat penanda tangan · signer</Label>
            {signerAddr ? <AddressChip address={signerAddr} /> : <span className="mb-muted">Hubungkan dompet</span>}
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
              <button className="mb-link text-sm mt-2" onClick={newBurner}>
                Buat burner baru
              </button>
            </details>
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
                maxLength={32}
                onChange={e => setRef(e.target.value)}
                aria-label="Nomor faktur"
              />
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
            disabled={id === undefined || amt === undefined || !signerAddr || !expiry}
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
              <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1">
                <span className="mb-label">No. faktur</span>
                <span className="mb-data">{signed.refLabel}</span>
                <span className="mb-label">Booking</span>
                <span className="mb-data text-sm">{idHex(signed.invoice.bookingId).slice(0, 18)}…</span>
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
