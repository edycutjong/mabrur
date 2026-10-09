import Link from "next/link";
import type { NextPage } from "next";
import { T } from "~~/components/mabrur/T";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "For judges",
  description: "Mabrur in 30 seconds: the claim, the click path, the on-chain receipts and the honest limits.",
});

const SCAN = "https://arbiscan.io";
const PBM = "0x36f1d899d9d4411b2DdfB60Dbbe989220336d2D5";
const REGISTRY = "0xd5B731CD0f2c91D5D64b59d9E4a2A4E4b6315ADb";
const TIDR = "0x66F838be32A624f4C797483a151C7f6209A43448";
const AHMAD_ID = "93071288952676167289577516806255635492368093588595261547394544652192346034554";
const SITI_ID = "38303033312745746094663211795656914215448779063347601464497604008460359611737";

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

const REPRO = `git clone --recursive https://github.com/edycutjong/mabrur.git
cd mabrur/packages/foundry && forge test
`;

const JudgePage: NextPage = () => (
  <div className="w-full max-w-4xl mx-auto px-4 lg:px-8 py-8 lg:py-12 flex flex-col gap-8">
    <header>
      <div className="mb-label">
        <T id="Untuk juri · 30 detik" en="For judges · 30 seconds" />
      </div>
      <h1 className="mb-title mt-1">
        <T
          id="Uang muka jamaah hanya bisa dipakai untuk perjalanannya sendiri."
          en="A pilgrim's prepayment can only be spent on her own trip."
        />
      </h1>
      <p className="mb-p mt-3">
        <T
          id="Mabrur mengunci rupiah setiap jamaah per pos (tiket pesawat, hotel, visa, ujrah agen) di dalam token yang tidak bisa dipindahtangankan di Arbitrum One. Agen hanya bisa membayar faktur bertanda tangan dari vendor yang klaimnya terverifikasi, penerima uangnya selalu si penanda tangan, ujrah baru terbuka setelah keberangkatan, dan siapa pun bisa mengembalikan sisa dana begitu batas tiket lewat tanpa tiket dibeli."
          en="Mabrur earmarks each pilgrim's rupiah per line (flight, hotel, visa, agency fee) inside a non-transferable token on Arbitrum One. The agency can pay only a claim-verified vendor's signed invoice, the payee is always that signer, the fee unlocks only after departure, and anyone can refund the rest once the ticket-by date passes with no ticket bought."
        />
      </p>
    </header>

    <section className="mb-sheet flex flex-col gap-3">
      <h2 className="mb-h2">
        <T id="Jalur 30 detik (tanpa dompet, tanpa instal)" en="The 30-second path (no wallet, no install)" />
      </h2>
      <ol className="list-decimal pl-5 flex flex-col gap-2 mb-p">
        <li>
          <T id="Buka booking Pak Ahmad:" en="Open Pak Ahmad's booking:" />{" "}
          <Link className="link" href={`/app/jamaah?id=${AHMAD_ID}`}>
            /app/jamaah
          </Link>{" "}
          —{" "}
          <T
            id="tiket, hotel, dan visa dibayar ke penanda tangannya masing-masing; ujrah dibuka setelah ia menandatangani keberangkatan."
            en="flight, hotel and visa paid to their signers, fee released after his departure signature."
          />
        </li>
        <li>
          <T id="Buka booking Ibu Siti:" en="Open Ibu Siti's booking:" />{" "}
          <Link className="link" href={`/app/jamaah?id=${SITI_ID}`}>
            /app/jamaah
          </Link>{" "}
          —{" "}
          <T
            id="tiketnya tidak dibeli sampai batas tiket, jadi pihak ketiga mengembalikan setiap rupiah yang belum terpakai."
            en="no ticket bought by her ticket-by date, so a third party refunded every unspent rupiah."
          />
        </li>
        <li>
          <T
            id="Buka empat percobaan yang ditolak di bawah ini di Arbiscan: masing-masing adalah transaksi gagal yang tertambang, lengkap dengan nama error-nya."
            en="Open the four rejected attempts below on Arbiscan: each is a mined, failed transaction with a named error."
          />
        </li>
        <li>
          <T
            id={
              <>
                Minta keputusan kontrak atas faktur Anda sendiri: tanda tangani satu di{" "}
                <Link className="link" href="/app/vendor">
                  halaman vendor
                </Link>
                , tempel JSON-nya di{" "}
                <Link className="link" href="/app/agen">
                  konsol agen
                </Link>{" "}
                (<em>Tempel faktur</em> → <em>Baca faktur</em>), lalu tekan <em>Simulasi saja</em> di sana. Konsol yang
                sama menampilkan panel regulator secara langsung.
              </>
            }
            en={
              <>
                Get the contract&apos;s verdict on your own invoice: sign one on the{" "}
                <Link className="link" href="/app/vendor">
                  vendor page
                </Link>
                , paste its JSON into the{" "}
                <Link className="link" href="/app/agen">
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

    <section className="mb-sheet flex flex-col gap-3">
      <h2 className="mb-h2">
        <T id="Bukti on-chain" en="Receipts" />
      </h2>
      {/* A table on wide screens; below 640px each row stacks into a card (see .mb-receipts in mabrur.css). */}
      <table className="table table-sm mb-receipts" data-testid="receipts">
        <thead>
          <tr>
            <th scope="col">
              <T id="Percobaan yang ditolak" en="Rejected attempt" />
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
              <td className="mb-receipt-err">{err}</td>
              <td>
                <T id={whatId} en={whatEn} />
              </td>
              <td data-label-id="Tx tertambang" data-label-en="Mined tx">
                <a className="link mb-receipt-tx" href={`${SCAN}/tx/${tx}`} target="_blank" rel="noreferrer" title={tx}>
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
      <ul className="list-disc pl-5 mb-p flex flex-col gap-1">
        <li>
          <T
            id={
              <>
                <strong>87 pengujian</strong> dengan cakupan baris, cabang, dan fungsi 100% pada kontrak, termasuk suite
                invarian: 7 invarian × 256 run × kedalaman 100 (Σ pos == suplai token; rupiah yang ditahan ≥ suplai;
                tidak ada pembayaran yang pernah sampai ke alamat tanpa klaim).
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
        <li>
          <T id="Kontrak terverifikasi di Arbiscan:" en="Contracts verified on Arbiscan:" />{" "}
          <a className="link" href={`${SCAN}/address/${PBM}#code`} target="_blank" rel="noreferrer">
            MabrurPBM
          </a>
          ,{" "}
          <a className="link" href={`${SCAN}/address/${REGISTRY}#code`} target="_blank" rel="noreferrer">
            ClaimRegistry
          </a>
          ,{" "}
          <a className="link" href={`${SCAN}/address/${TIDR}#code`} target="_blank" rel="noreferrer">
            TIDR
          </a>
          .
        </li>
      </ul>
    </section>

    <section className="mb-sheet flex flex-col gap-3">
      <h2 className="mb-h2">
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
        <T
          id="cast run <tx mana pun di atas> --rpc-url https://arb1.arbitrum.io/rpc --quick"
          en="cast run <any tx above> --rpc-url https://arb1.arbitrum.io/rpc --quick"
        />
      </pre>
      <p className="mb-p text-sm">
        <T
          id="Setiap skrip demo mengirim transaksi ke Arbitrum One; tidak ada mode mock, offline, atau dry-run."
          en="Every demo script broadcasts to Arbitrum One; there is no mock, offline or dry-run mode."
        />
      </p>
    </section>

    <section className="mb-sheet flex flex-col gap-3">
      <h2 className="mb-h2">
        <T id="Batasan yang jujur" en="Honest limits" />
      </h2>
      <ul className="list-disc pl-5 mb-p flex flex-col gap-1">
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

    <section className="flex flex-wrap gap-3">
      <a className="mb-btn" href="https://github.com/edycutjong/mabrur" target="_blank" rel="noreferrer">
        <T id="Repo GitHub" en="GitHub repo" />
      </a>
      <a
        className="mb-btn mb-btn-ghost"
        href="https://github.com/edycutjong/mabrur/blob/main/DEMO.md"
        target="_blank"
        rel="noreferrer"
      >
        <T id="Buku besar DEMO.md" en="DEMO.md ledger" />
      </a>
      <Link className="mb-btn mb-btn-ghost" href="/app">
        <T id="Buka aplikasi" en="Open the app" />
      </Link>
    </section>
  </div>
);

export default JudgePage;
