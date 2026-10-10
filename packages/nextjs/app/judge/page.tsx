import Link from "next/link";
import type { NextPage } from "next";
import { T } from "~~/components/mabrur/T";
import { AHMAD_ID, SITI_ID } from "~~/utils/mabrur/demo";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "For judges",
  description: "Mabrur in 30 seconds: the claim, the click path, the on-chain receipts and the honest limits.",
});

const SCAN = "https://arbiscan.io";
const PBM = "0x36f1d899d9d4411b2DdfB60Dbbe989220336d2D5";
const REGISTRY = "0xd5B731CD0f2c91D5D64b59d9E4a2A4E4b6315ADb";
const TIDR = "0x66F838be32A624f4C797483a151C7f6209A43448";

/** The four mined refusals: [contract error, what the agency tried (ID), (EN), tx]. Error names stay as-is. */
const REVERTS = [
  [
    "EarmarkMismatch",
    "Faktur hotel Ibu Siti dipakai untuk booking jamaah lain",
    "Siti's hotel invoice used on another pilgrim's booking",
    "0x9ed30e3802f988fb2219a08c9d184ab779da13d2afbc7f9314d0ab3fa0bbc316",
  ],
  [
    "VendorClaimMissing",
    "Faktur ditandatangani direktur agen (tanpa klaim vendor)",
    "Invoice signed by the agency director (no vendor claim)",
    "0x887d6b86d4361666b883edb9624efbd9bef0cdc6e4b0244149433d964beffa61",
  ],
  [
    "InvoiceReplayed",
    "Faktur yang sudah dibayar dikirim ulang",
    "An already-paid invoice submitted again",
    "0x952f30adf9d7cc08982d8128c5e0de85a241d92a2d0e099799df6c7a75b9619a",
  ],
  [
    "NotDeparted",
    "Agen menandatangani “keberangkatan” sendiri demi mengambil ujrahnya",
    "Agency signs its own 'departure' to take its fee",
    "0xe4855ebd72f05a8756a814cc8fbfb963b18f70bdd16856130cff391e1df5291b",
  ],
] as const;

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

// The same command in both languages (copy-pasteable, identical to README / JUDGE.md); the gloss is in the caption.
const REPRO = `git clone --recursive https://github.com/edycutjong/mabrur.git
cd mabrur/packages/foundry && forge test
cast run <any tx above> --rpc-url https://arb1.arbitrum.io/rpc --quick`;

/** The agency console with the sample invoices loaded and Pak Ahmad's booking selected: DITOLAK in two clicks. */
const SAMPLE_CONSOLE = "/app/agen?contoh=1";

/** EN-only gloss under an Indonesian brand seal word (hidden in ID mode). */
const Gloss = ({ en }: { en: string }) => (
  <span className="mb-stamp-gloss t-en" lang="en">
    {en}
  </span>
);

const RULES = [
  [
    "Agen hanya bisa membayar faktur bertanda tangan dari vendor yang klaimnya terverifikasi.",
    "The agency can pay only a claim-verified vendor's signed invoice.",
  ],
  ["Penerima uangnya selalu si penanda tangan.", "The payee is always that signer."],
  ["Ujrah baru terbuka setelah keberangkatan.", "The fee unlocks only after departure."],
  [
    "Siapa pun bisa mengembalikan sisa dana begitu batas tiket lewat tanpa tiket dibeli.",
    "Anyone can refund the rest once the ticket-by date passes with no ticket bought.",
  ],
] as const;

const CONTRACTS = [
  ["MabrurPBM", PBM],
  ["ClaimRegistry", REGISTRY],
  ["TIDR", TIDR],
] as const;

// Projector-first: on a wide screen the claim (left) and the on-chain proof (right) share the first screen; the click
// path, the reproduce block and the honest limits follow. On a phone everything stacks in reading order.
const JudgePage: NextPage = () => (
  <div className="mb-judge w-full max-w-[1600px] mx-auto px-4 lg:px-8 py-8 lg:py-12">
    <div className="mb-judge-row">
      <header className="mb-judge-head">
        <h1 className="mb-title mb-judge-title">
          <T
            id="Uang muka jamaah hanya bisa dipakai untuk perjalanannya sendiri."
            en="A pilgrim's prepayment can only be spent on her own trip."
          />
        </h1>
        <p className="mb-p mb-lede mt-5">
          <T
            id="Mabrur mengunci rupiah setiap jamaah per pos (tiket pesawat, hotel, visa, ujrah agen) di dalam token yang tidak bisa dipindahtangankan di Arbitrum One."
            en="Mabrur earmarks each pilgrim's rupiah per line (flight, hotel, visa, agency fee) inside a non-transferable token on Arbitrum One."
          />
        </p>
        <ul className="mb-rules">
          {RULES.map(([id, en]) => (
            <li key={en}>
              <T id={id} en={en} />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link className="mb-btn mb-go" href="/app">
            <T id="Buka aplikasi" en="Open the app" />
          </Link>
          <a
            className="mb-btn mb-btn-ghost mb-ext"
            href="https://github.com/edycutjong/mabrur"
            target="_blank"
            rel="noreferrer"
          >
            <T id="Repo GitHub" en="GitHub repo" />
          </a>
          <a
            className="mb-btn mb-btn-ghost mb-ext"
            href="https://github.com/edycutjong/mabrur/blob/main/DEMO.md"
            target="_blank"
            rel="noreferrer"
          >
            <T id="Buku besar DEMO.md" en="DEMO.md ledger" />
          </a>
        </div>
        <div className="mb-judge-quick">
          <Link className="mb-link mb-judge-step-link" href={SAMPLE_CONSOLE}>
            <T id="Lihat cap DITOLAK sendiri, tanpa dompet" en="See a DITOLAK (rejected) seal yourself, no wallet" />
          </Link>
          <span className="mb-p text-sm mb-ink-soft">
            <T
              id="Konsol agen memuat contoh faktur; tekan Simulasi saja pada faktur mana pun."
              en="The agency console loads sample invoices; press Simulate only on any of them."
            />
          </span>
        </div>
      </header>

      <section className="mb-sheet mb-slip mb-judge-proof flex flex-col gap-4" aria-labelledby="judge-proof">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="mb-h2" id="judge-proof">
            <T id="Bukti on-chain" en="Receipts" />
          </h2>
          <span className="mb-p text-sm mb-muted">
            <T id="Arbitrum One · 4 transaksi gagal yang tertambang" en="Arbitrum One · 4 mined, failed transactions" />
          </span>
        </div>
        {/* A table on wide screens; below 640px each row stacks into a card (see .mb-receipts in mabrur.css). */}
        <table className="mb-receipts" data-testid="receipts">
          <thead>
            <tr>
              <th scope="col">
                <T id="Percobaan ditolak" en="Rejected attempt" />
              </th>
              <th scope="col">
                <T id="Yang dicoba agen" en="What the agency tried" />
              </th>
              <th scope="col">
                <T id="Tx tertambang" en="Mined tx" />
              </th>
            </tr>
          </thead>
          <tbody>
            {REVERTS.map(([err, whatId, whatEn, tx]) => (
              <tr key={tx}>
                <td>
                  <span className="mb-stamp mb-stamp-sm">
                    <span className="mb-stamp-word">Ditolak</span>
                    <Gloss en="rejected" />
                    <span className="mb-stamp-error mb-receipt-err">{err}</span>
                  </span>
                </td>
                <td>
                  <T id={whatId} en={whatEn} />
                </td>
                <td data-label-id="Tx tertambang" data-label-en="Mined tx">
                  <a
                    className="mb-link mb-ext mb-receipt-tx"
                    href={`${SCAN}/tx/${tx}`}
                    target="_blank"
                    rel="noreferrer"
                    title={tx}
                  >
                    <span className="sr-only">
                      <T id={`Transaksi ${err} di Arbiscan:`} en={`${err} transaction on Arbiscan:`} />{" "}
                    </span>
                    {short(tx)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mb-ticks mb-p mb-judge-fine mt-1">
          <li>
            <T
              id={
                <>
                  <strong>87 pengujian</strong> dengan cakupan baris, cabang, dan fungsi 100% pada kontrak, termasuk
                  suite invarian: 7 invarian × 256 run × kedalaman 100 (Σ pos == suplai token; rupiah yang ditahan ≥
                  suplai; tidak ada pembayaran yang pernah sampai ke alamat tanpa klaim).
                </>
              }
              en={
                <>
                  <strong>87 tests</strong> with 100% line, branch and function coverage of the contracts, including an
                  invariant suite of 7 invariants × 256 runs × depth 100 (Σ earmarks == token supply; rupiah held ≥
                  supply; no payment ever reaches an unclaimed address).
                </>
              }
            />
          </li>
          <li>
            <T
              id="Biaya dari tanda terima nyata: satu siklus jamaah yang berangkat 907.185 gas ≈ Rp 809; yang dikembalikan 582.938 gas ≈ Rp 520 (ETH/IDR 44.563.294, CoinGecko, 9 Okt 2026)."
              en="Cost from the real receipts: a departed pilgrim's lifecycle is 907,185 gas ≈ Rp 809; a refunded one is 582,938 gas ≈ Rp 520 (ETH/IDR 44,563,294, CoinGecko, 9 Oct 2026)."
            />
          </li>
        </ul>
        <div className="mb-judge-contracts">
          <span className="mb-label">
            <T id="Kontrak terverifikasi di Arbiscan" en="Contracts verified on Arbiscan" />
          </span>
          <div className="flex flex-wrap gap-2">
            {CONTRACTS.map(([name, addr]) => (
              <a
                key={name}
                className="mb-chip mb-chip-ink mb-ext mb-judge-chip"
                href={`${SCAN}/address/${addr}#code`}
                target="_blank"
                rel="noreferrer"
                title={addr}
              >
                {name} <span className="mb-data">{short(addr)}</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>

    <div className="mb-judge-row mt-10 lg:mt-14">
      <section className="mb-sheet flex flex-col gap-3" aria-labelledby="judge-path">
        <h2 className="mb-h2" id="judge-path">
          <T id="Jalur 30 detik (tanpa dompet, tanpa instal)" en="The 30-second path (no wallet, no install)" />
        </h2>
        <ol className="mb-steps mb-p mt-2">
          <li>
            <Link className="mb-link mb-judge-step-link" href={`/app/jamaah?id=${AHMAD_ID}`}>
              <T id="Buka booking Pak Ahmad" en="Open Pak Ahmad's booking" />
            </Link>{" "}
            <span className="mb-chip mb-chip-paid">
              LUNAS
              <Gloss en="· paid" />
            </span>
            <span className="block mt-1">
              <T
                id="Tiket, hotel, dan visa dibayar ke penanda tangannya masing-masing; ujrah dibuka setelah ia menandatangani keberangkatan."
                en="Flight, hotel and visa paid to their signers, fee released after his departure signature."
              />
            </span>
          </li>
          <li>
            <Link className="mb-link mb-judge-step-link" href={`/app/jamaah?id=${SITI_ID}`}>
              <T id="Buka booking Ibu Siti" en="Open Ibu Siti's booking" />
            </Link>{" "}
            <span className="mb-chip mb-chip-returned">
              DIKEMBALIKAN
              <Gloss en="· refunded" />
            </span>
            <span className="block mt-1">
              <T
                id="Tiketnya tidak dibeli sampai batas tiket, jadi pihak ketiga mengembalikan setiap rupiah yang belum terpakai."
                en="No ticket bought by her ticket-by date, so a third party refunded every unspent rupiah."
              />
            </span>
          </li>
          <li>
            <T
              id="Buka empat percobaan yang ditolak di atas di Arbiscan: masing-masing adalah transaksi gagal yang tertambang, lengkap dengan nama error-nya."
              en="Open the four rejected attempts above on Arbiscan: each is a mined, failed transaction with a named error."
            />
          </li>
          <li>
            <Link className="mb-link mb-judge-step-link" href={SAMPLE_CONSOLE}>
              <T id="Muat contoh faktur di konsol agen" en="Load the sample invoices in the agency console" />
            </Link>
            <span className="block mt-1">
              <T
                id={
                  <>
                    Booking Pak Ahmad sudah terpilih. Tekan <em>Simulasi saja</em> pada faktur hotel Ibu Siti: cap
                    DITOLAK · EarmarkMismatch mendarat tanpa dompet dan tanpa transaksi. Filenya:{" "}
                    <a className="mb-link mb-data text-sm" href="/demo/invoices.json">
                      /demo/invoices.json
                    </a>
                    .
                  </>
                }
                en={
                  <>
                    Pak Ahmad&apos;s booking is already selected. Press <em>Simulate only</em> on Ibu Siti&apos;s hotel
                    invoice: a DITOLAK (rejected) · EarmarkMismatch seal lands with no wallet and no transaction. The
                    file:{" "}
                    <a className="mb-link mb-data text-sm" href="/demo/invoices.json">
                      /demo/invoices.json
                    </a>
                    .
                  </>
                }
              />
            </span>
          </li>
          <li>
            <T
              id={
                <>
                  Minta keputusan kontrak atas faktur Anda sendiri: tanda tangani satu di{" "}
                  <Link className="mb-link" href="/app/vendor">
                    halaman vendor
                  </Link>
                  , tempel JSON-nya di{" "}
                  <Link className="mb-link" href="/app/agen">
                    konsol agen
                  </Link>{" "}
                  (<em>Tempel faktur</em> → <em>Baca faktur</em>), lalu tekan <em>Simulasi saja</em> di sana. Konsol
                  yang sama menampilkan panel regulator secara langsung.
                </>
              }
              en={
                <>
                  Get the contract&apos;s verdict on your own invoice: sign one on the{" "}
                  <Link className="mb-link" href="/app/vendor">
                    vendor page
                  </Link>
                  , paste its JSON into the{" "}
                  <Link className="mb-link" href="/app/agen">
                    agency console
                  </Link>{" "}
                  (<em>Paste invoice</em> → <em>Read invoice</em>), then press <em>Simulate only</em> there. The same
                  console shows the live regulator panel.
                </>
              }
            />
          </li>
        </ol>
      </section>

      <div className="flex flex-col gap-8 min-w-0">
        <section className="mb-sheet flex flex-col gap-3" aria-labelledby="judge-repro">
          <h2 className="mb-h2" id="judge-repro">
            <T id="Reproduksi" en="Reproduce" />
          </h2>
          <span id="repro-label" className="sr-only">
            <T
              id="Perintah reproduksi: clone, jalankan tes Foundry, putar ulang transaksi"
              en="Reproduce commands: clone, run the Foundry tests, replay a transaction"
            />
          </span>
          <pre className="mb-pre" tabIndex={0} role="region" aria-labelledby="repro-label">
            {REPRO}
          </pre>
          <p className="mb-p text-sm mb-muted">
            <T
              id="Ganti <any tx above> dengan hash transaksi mana pun di atas. Setiap skrip demo mengirim transaksi ke Arbitrum One; tidak ada mode mock, offline, atau dry-run."
              en="Every demo script broadcasts to Arbitrum One; there is no mock, offline or dry-run mode."
            />
          </p>
        </section>

        <section className="mb-sheet flex flex-col gap-3" aria-labelledby="judge-limits">
          <h2 className="mb-h2" id="judge-limits">
            <T id="Batasan yang jujur" en="Honest limits" />
          </h2>
          <ul className="mb-ticks mb-p mb-judge-fine">
            <li>
              <T
                id="tIDR adalah token uji tanpa nilai: belum ada token rupiah berizin yang bisa dipakai di Arbitrum One. Pembungkusnya menerima ERC-20 biasa apa pun."
                en="tIDR is a test token with no value: no licensed rupiah token is usable on Arbitrum One. The wrapper takes any plain ERC-20."
              />
            </li>
            <li>
              <T
                id="Penerbit klaim adalah kunci demo yang menggantikan Kemenag / IATA. Penerbit yang dibobol bisa mensertifikasi vendor palsu; kerugiannya terbatas pada pos tiket, hotel, dan visa yang belum kedaluwarsa, dan itu sudah diuji."
                en="The claim issuer is a demo key standing in for Kemenag / IATA. A captured issuer could certify a fake vendor; the damage is bounded to unexpired flight, hotel and visa lines and tested."
              />
            </li>
            <li>
              <T
                id="Mabrur tidak bisa menjamin kursi: yang dijamin adalah tiket yang sudah dibayar, atau setiap rupiah yang belum terpakai kembali."
                en="Mabrur cannot guarantee a seat: it guarantees a paid ticket, or every unspent rupiah back."
              />
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
);

export default JudgePage;
