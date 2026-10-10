import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AgenPage, { sampleSigners } from "~~/app/app/agen/page";
import sample from "~~/public/demo/invoices.json";

// The client console is tested on its own (app__app__agen__page.test.tsx); here only what the server passes it.
vi.mock("~~/app/app/agen/AgenConsole", () => ({
  default: ({ initialSample, initialSigners }: { initialSample?: string; initialSigners?: (string | undefined)[] }) => (
    <div
      data-testid="console"
      data-sample={initialSample ?? ""}
      data-signers={JSON.stringify(initialSigners ?? null)}
    />
  ),
}));

const TEXT = JSON.stringify(sample);

describe("app/app/agen/page.tsx (server)", () => {
  it("passes nothing without ?contoh", async () => {
    render(await AgenPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByTestId("console")).toHaveAttribute("data-sample", "");
    expect(screen.getByTestId("console")).toHaveAttribute("data-signers", "null");
  });

  it("with ?contoh passes the sample and the real recovered signer of each invoice", async () => {
    render(await AgenPage({ searchParams: Promise.resolve({ contoh: "1" }) }));
    const el = screen.getByTestId("console");
    expect(JSON.parse(el.getAttribute("data-sample")!)).toEqual(sample);
    const signers = JSON.parse(el.getAttribute("data-signers")!);
    // EarmarkMismatch: Ibu Siti's hotel invoice, signed by the licensed hotel; VendorClaimMissing: the agency director
    expect(signers[0]).toBe("0x45D023807720E23d3ee5754f2E56F3BD5634e372");
    expect(signers[1]).toBe("0x6DD225ef209dF9aED8D34Ff5817352ce8AC2f855");
    expect(signers).toHaveLength(3);
  });

  it("returns no signers for a chain without a deployment, and undefined for an unrecoverable signature", async () => {
    expect(await sampleSigners(TEXT, 1)).toEqual([]);
    const bad = JSON.parse(TEXT);
    bad.earmarkMismatch.signature = `0x${"00".repeat(64)}1b`;
    const out = await sampleSigners(JSON.stringify(bad));
    expect(out[0]).toBeUndefined();
  });
});
