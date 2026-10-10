import AgenConsole from "./AgenConsole";
import { Address, recoverTypedDataAddress } from "viem";
import deployedContracts from "~~/contracts/deployedContracts";
import sampleInvoices from "~~/public/demo/invoices.json";
import { DEMO_CHAIN_ID } from "~~/utils/mabrur/demo";
import { INVOICE_TYPES, parseInvoices, pbmDomain } from "~~/utils/mabrur/invoice";

type Search = Record<string, string | string[] | undefined>;

const SAMPLE = JSON.stringify(sampleInvoices);

/**
 * The signer of each sample invoice, recovered on the server for the chain the sample was signed on, so the first
 * HTML already carries the vendor chip at its final width (on a phone it wraps to three lines; arriving late, that
 * pushed "Simulasi saja" down). The client recovers again for its own chain and keeps the result if it differs.
 */
export const sampleSigners = async (text: string, chainId: number = DEMO_CHAIN_ID) => {
  const pbm = (deployedContracts as unknown as Record<number, { MabrurPBM?: { address: Address } }>)[chainId]
    ?.MabrurPBM;
  if (!pbm) return [];
  return Promise.all(
    parseInvoices(text).map(inv =>
      recoverTypedDataAddress({
        domain: pbmDomain(chainId, pbm.address),
        types: INVOICE_TYPES,
        primaryType: "Invoice",
        message: inv.invoice,
        signature: inv.signature,
      }).catch(() => undefined),
    ),
  );
};

// Rendered per request: with ?contoh (the /judge link) the server already puts the sample invoices into the first
// HTML, so the invoice rows and their "Simulasi saja" buttons never arrive late and push the page down (CLS).
export default async function AgenPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  if (sp.contoh === undefined) return <AgenConsole />;
  return <AgenConsole initialSample={SAMPLE} initialSigners={await sampleSigners(SAMPLE)} />;
}
