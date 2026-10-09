"use client";

import { useQuery } from "@tanstack/react-query";
import { Address, Hash, PublicClient } from "viem";
import { Booking, useMabrurContracts } from "~~/hooks/mabrur/useMabrur";

export type LedgerRow = {
  kind: "Booked" | "Spent" | "MarginReleased" | "Refunded";
  blockNumber: bigint;
  logIndex: number;
  hash: Hash;
  timestamp?: bigint;
  line?: number;
  amount: bigint;
  counterparty?: Address;
  ref?: `0x${string}`;
  lines?: readonly bigint[];
};

/**
 * Best-effort passbook for ONE booking: event logs filtered by the indexed booking id, from the deploy block.
 * Core screens never depend on it (a2a F18) — if the RPC refuses the range, the screen falls back to struct reads.
 */
export const useBookingLedger = (b: Booking | null | undefined) => {
  const { pbm, publicClient, chainId } = useMabrurContracts();
  const stateKey = b ? `${b.remaining.join(",")}|${b.refunded}|${b.marginReleased}` : "";
  return useQuery({
    queryKey: ["mabrur-ledger", chainId, pbm?.address, b?.id.toString(), stateKey],
    enabled: Boolean(pbm && publicClient && b),
    retry: false,
    staleTime: Infinity,
    queryFn: async (): Promise<LedgerRow[]> => {
      const client = publicClient as PublicClient;
      const c = pbm as any;
      const fromBlock = BigInt(c.deployedOnBlock ?? 0);
      const names = ["Booked", "Spent", "MarginReleased", "Refunded"] as const;
      const logs = (
        await Promise.all(
          names.map(eventName =>
            client.getContractEvents({ address: c.address, abi: c.abi, eventName, args: { id: b!.id }, fromBlock }),
          ),
        )
      ).flat() as any[];
      const rows: LedgerRow[] = logs.map(l => {
        const a = l.args;
        const base = {
          blockNumber: l.blockNumber as bigint,
          logIndex: l.logIndex as number,
          hash: l.transactionHash as Hash,
        };
        switch (l.eventName) {
          case "Booked":
            return {
              ...base,
              kind: "Booked",
              amount: (a.lines as bigint[]).reduce((x, y) => x + y, 0n),
              lines: a.lines,
              counterparty: a.agency,
            };
          case "Spent":
            return {
              ...base,
              kind: "Spent",
              amount: a.amount,
              line: Number(a.line),
              counterparty: a.vendor,
              ref: a.ref,
            };
          case "MarginReleased":
            return { ...base, kind: "MarginReleased", amount: a.amount, line: 3, counterparty: a.agency };
          default:
            return { ...base, kind: "Refunded", amount: a.amount, counterparty: a.caller };
        }
      });
      rows.sort((x, y) =>
        x.blockNumber === y.blockNumber ? x.logIndex - y.logIndex : Number(x.blockNumber - y.blockNumber),
      );
      const blocks = Array.from(new Set(rows.map(r => r.blockNumber)));
      const stamps = new Map<bigint, bigint>();
      await Promise.all(
        blocks.map(async bn => {
          try {
            const blk = await client.getBlock({ blockNumber: bn });
            stamps.set(bn, blk.timestamp);
          } catch {
            /* timestamp optional */
          }
        }),
      );
      return rows.map(r => ({ ...r, timestamp: stamps.get(r.blockNumber) }));
    },
  });
};

export type LineState = {
  original?: bigint;
  remaining: bigint;
  spent: { amount: bigint; to?: Address; hash?: Hash; ref?: `0x${string}` }[];
  refunded?: bigint;
  state: "earmarked" | "lunas" | "returned" | "empty" | "partial";
};

export const deriveLines = (b: Booking, ledger?: LedgerRow[]): LineState[] => {
  const booked = ledger?.find(r => r.kind === "Booked");
  return [0, 1, 2, 3].map(i => {
    const remaining = b.remaining[i];
    const spent = (ledger ?? [])
      .filter(r => (r.kind === "Spent" || r.kind === "MarginReleased") && r.line === i)
      .map(r => ({ amount: r.amount, to: r.counterparty, hash: r.hash, ref: r.ref }));
    const original = booked?.lines?.[i];
    const spentSum = spent.reduce((x, s) => x + s.amount, 0n);
    let refunded: bigint | undefined;
    if (b.refunded && original !== undefined) refunded = original - spentSum;
    let state: LineState["state"];
    if (remaining > 0n) state = spentSum > 0n ? "partial" : "earmarked";
    else if (
      b.refunded &&
      (refunded === undefined
        ? !(i === 0 && b.flightVendor !== "0x0000000000000000000000000000000000000000") &&
          !(i === 3 && b.marginReleased)
        : refunded > 0n)
    )
      state = "returned";
    else if (
      spentSum > 0n ||
      (i === 0 && b.flightVendor !== "0x0000000000000000000000000000000000000000") ||
      (i === 3 && b.marginReleased)
    )
      state = "lunas";
    else state = original === 0n ? "empty" : "lunas";
    return { original, remaining, spent, refunded, state };
  });
};
