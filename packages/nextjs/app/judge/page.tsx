import Link from "next/link";
import type { NextPage } from "next";
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

const REVERTS = [
  [
    "EarmarkMismatch",
    "Siti's hotel invoice used on another pilgrim's booking",
    "0x9ed30e3802f988fb2219a08c9d184ab779da13d2afbc7f9314d0ab3fa0bbc316",
  ],
  [
    "VendorClaimMissing",
    "Invoice signed by the agency director (no vendor claim)",
    "0x887d6b86d4361666b883edb9624efbd9bef0cdc6e4b0244149433d964beffa61",
  ],
  [
    "InvoiceReplayed",
    "An already-paid invoice submitted again",
    "0x952f30adf9d7cc08982d8128c5e0de85a241d92a2d0e099799df6c7a75b9619a",
  ],
  [
    "NotDeparted",
    "Agency signs its own 'departure' to take its fee",
    "0xe4855ebd72f05a8756a814cc8fbfb963b18f70bdd16856130cff391e1df5291b",
  ],
] as const;

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

const JudgePage: NextPage = () => (
  <div className="w-full max-w-4xl mx-auto px-4 lg:px-8 py-8 lg:py-12 flex flex-col gap-8">
    <header>
      <div className="mb-label">For judges · 30 seconds</div>
      <h1 className="mb-title mt-1">A pilgrim&apos;s prepayment can only be spent on her own trip.</h1>
      <p className="mb-p mt-3">
        Mabrur earmarks each pilgrim&apos;s rupiah per line (flight, hotel, visa, agency fee) inside a non-transferable
        token on Arbitrum One. The agency can pay only a claim-verified vendor&apos;s signed invoice, the payee is
        always that signer, the fee unlocks only after departure, and anyone can refund the rest once the ticket-by date
        passes with no ticket bought.
      </p>
    </header>

    <section className="mb-sheet flex flex-col gap-3">
      <h2 className="mb-h2">The 30-second path (no wallet, no install)</h2>
      <ol className="list-decimal pl-5 flex flex-col gap-2 mb-p">
        <li>
          Open Pak Ahmad&apos;s booking:{" "}
          <Link className="link" href={`/app/jamaah?id=${AHMAD_ID}`}>
            /app/jamaah
          </Link>{" "}
          — flight, hotel and visa paid to their signers, fee released after his departure signature.
        </li>
        <li>
          Open Ibu Siti&apos;s booking:{" "}
          <Link className="link" href={`/app/jamaah?id=${SITI_ID}`}>
            /app/jamaah
          </Link>{" "}
          — no ticket bought by her ticket-by date, so a third party refunded every unspent rupiah.
        </li>
        <li>
          Open the four rejected attempts below on Arbiscan: each is a mined, failed transaction with a named error.
        </li>
        <li>
          Open the{" "}
          <Link className="link" href="/app/agen">
            agency console
          </Link>{" "}
          to read the live regulator panel, or sign your own invoice on the{" "}
          <Link className="link" href="/app/vendor">
            vendor page
          </Link>{" "}
          and press <em>Simulasi saja</em> to see the contract&apos;s verdict.
        </li>
      </ol>
    </section>

    <section className="mb-sheet flex flex-col gap-3">
      <h2 className="mb-h2">Receipts</h2>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Rejected attempt</th>
              <th>What the agency tried</th>
              <th>Mined tx</th>
            </tr>
          </thead>
          <tbody>
            {REVERTS.map(([err, what, tx]) => (
              <tr key={tx}>
                <td className="font-mono">{err}</td>
                <td>{what}</td>
                <td>
                  <a className="link font-mono" href={`${SCAN}/tx/${tx}`} target="_blank" rel="noreferrer">
                    {short(tx)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list-disc pl-5 mb-p flex flex-col gap-1">
        <li>
          <strong>67 tests</strong>, including an invariant suite of 7 invariants × 256 runs × depth 100 (Σ earmarks ==
          token supply; rupiah held ≥ supply; no payment ever reaches an unclaimed address).
        </li>
        <li>
          Cost from the real receipts: a departed pilgrim&apos;s lifecycle is 907,185 gas ≈ Rp 809; a refunded one is
          582,938 gas ≈ Rp 520 (ETH/IDR 44,563,294, CoinGecko, 9 Oct 2026).
        </li>
        <li>
          Contracts verified on Arbiscan:{" "}
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
      <h2 className="mb-h2">Reproduce</h2>
      <pre className="bg-base-200 rounded p-3 text-sm overflow-x-auto">
        {`git clone --recursive https://github.com/edycutjong/mabrur.git
cd mabrur/packages/foundry && forge test
cast run <any tx above> --rpc-url https://arb1.arbitrum.io/rpc --quick`}
      </pre>
      <p className="mb-p text-sm">
        Every demo script broadcasts to Arbitrum One; there is no mock, offline or dry-run mode.
      </p>
    </section>

    <section className="mb-sheet flex flex-col gap-3">
      <h2 className="mb-h2">Honest limits</h2>
      <ul className="list-disc pl-5 mb-p flex flex-col gap-1">
        <li>
          tIDR is a test token with no value: no licensed rupiah token is usable on Arbitrum One. The wrapper takes any
          plain ERC-20.
        </li>
        <li>
          The claim issuer is a demo key standing in for Kemenag / IATA. A captured issuer could certify a fake vendor;
          the damage is bounded to unexpired flight, hotel and visa lines and tested.
        </li>
        <li>Mabrur cannot guarantee a seat: it guarantees a paid ticket, or every unspent rupiah back.</li>
      </ul>
    </section>

    <section className="flex flex-wrap gap-3">
      <a className="btn btn-primary" href="https://github.com/edycutjong/mabrur" target="_blank" rel="noreferrer">
        GitHub repo
      </a>
      <a
        className="btn btn-outline"
        href="https://github.com/edycutjong/mabrur/blob/main/DEMO.md"
        target="_blank"
        rel="noreferrer"
      >
        DEMO.md ledger
      </a>
      <Link className="btn btn-outline" href="/app">
        Open the app
      </Link>
    </section>
  </div>
);

export default JudgePage;
