"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Abi,
  Address,
  Hash,
  PublicClient,
  TransactionReceipt,
  decodeEventLog,
  encodeAbiParameters,
  isAddress,
  keccak256,
} from "viem";
import { useAccount, useBlock, usePublicClient, useWalletClient } from "wagmi";
import { useDeployedContractInfo, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { DecodedRevert, decodeRevert } from "~~/utils/mabrur/errors";

export type Booking = {
  id: bigint;
  pilgrim: Address;
  agency: Address;
  ticketBy: bigint;
  departBy: bigint;
  departed: boolean;
  marginReleased: boolean;
  refunded: boolean;
  flightVendor: Address;
  remaining: readonly [bigint, bigint, bigint, bigint];
  deposited: bigint;
  refundable: boolean;
};

export const ZERO = "0x0000000000000000000000000000000000000000";

/** Contracts for the chain the app is pointed at (the connected wallet's chain, else the first target network). */
export const useMabrurContracts = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: pbm, isLoading: l1 } = useDeployedContractInfo({ contractName: "MabrurPBM" });
  const { data: tidr, isLoading: l2 } = useDeployedContractInfo({ contractName: "TIDR" });
  const { data: registry, isLoading: l3 } = useDeployedContractInfo({ contractName: "ClaimRegistry" });
  const publicClient = usePublicClient({ chainId: targetNetwork.id });
  return {
    chainId: targetNetwork.id,
    chainName: targetNetwork.name,
    pbm,
    tidr,
    registry,
    publicClient,
    isLoading: l1 || l2 || l3,
    ready: Boolean(pbm && tidr && registry && publicClient),
  };
};

/** Chain time that ticks every second: latest block timestamp, advanced by the wall clock since it was seen. */
export const useChainNow = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: block } = useBlock({ chainId: targetNetwork.id, watch: true });
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [anchor, setAnchor] = useState<{ chain: number; wall: number } | undefined>();
  useEffect(() => {
    if (block?.timestamp !== undefined) setAnchor({ chain: Number(block.timestamp), wall: Date.now() / 1000 });
  }, [block?.timestamp]);
  useEffect(() => {
    const t = setInterval(() => {
      const wall = Date.now() / 1000;
      // the wall clock is the better estimate on live chains; block time wins if it is ahead (e.g. a warped anvil)
      setNow(anchor ? Math.floor(Math.max(wall, anchor.chain + (wall - anchor.wall))) : Math.floor(wall));
    }, 1000);
    return () => clearInterval(t);
  }, [anchor]);
  return { now, blockNumber: block?.number, blockTime: block?.timestamp };
};

const readBooking = async (client: PublicClient, pbm: { address: Address; abi: Abi }, id: bigint) => {
  const [b, refundable] = await Promise.all([
    client.readContract({ address: pbm.address, abi: pbm.abi, functionName: "booking", args: [id] }) as Promise<any>,
    client.readContract({
      address: pbm.address,
      abi: pbm.abi,
      functionName: "refundable",
      args: [id],
    }) as Promise<boolean>,
  ]);
  return { id, ...b, remaining: b.remaining as Booking["remaining"], refundable } as Booking;
};

/** An open booking is re-read at least this often (another device may refund it; the block-keyed read can stall). */
export const BOOKING_REFETCH_MS = 5000;
/** After a ticketBy / departBy deadline passes, re-read every second for this long, until refundable flips true. */
export const DEADLINE_WATCH_S = 30;

/**
 * One booking by id, refreshed every block, polled every BOOKING_REFETCH_MS until it is refunded, and re-read every
 * second right after a deadline lapses so the refund button appears without a reload. Null when the id has no booking.
 */
export const useBooking = (id: bigint | undefined) => {
  const { pbm, publicClient, chainId } = useMabrurContracts();
  const { blockNumber, now } = useChainNow();
  const query = useQuery({
    queryKey: ["mabrur-booking", chainId, pbm?.address, id?.toString(), blockNumber?.toString()],
    enabled: Boolean(pbm && publicClient && id !== undefined),
    placeholderData: prev => prev,
    refetchInterval: q => (q.state.data?.refunded ? false : BOOKING_REFETCH_MS),
    queryFn: async () => {
      const b = await readBooking(publicClient as PublicClient, pbm as any, id as bigint);
      return b.pilgrim === ZERO ? null : b;
    },
  });
  const b = query.data;
  const refetch = query.refetch;
  const lapsing =
    !!b &&
    !b.refunded &&
    !b.refundable &&
    [b.ticketBy, b.departBy].some(d => now >= Number(d) && now - Number(d) <= DEADLINE_WATCH_S);
  useEffect(() => {
    if (lapsing) void refetch();
  }, [lapsing, now, refetch]);
  return query;
};

/** bookingIdOf(pilgrim, nonce) is pure — keccak256(abi.encode(pilgrim, nonce)) — so it is computed locally, not read. */
export const bookingIdOf = (pilgrim: Address, nonce: bigint): bigint =>
  BigInt(keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [pilgrim, nonce])));

/** How often a pilgrim's booking list is re-read (a deadline lapsing or someone else's refund must show within seconds; a mined tx invalidates at once). */
export const BOOKINGS_OF_REFETCH_MS = 6000;

/** Every booking of one pilgrim: ids are bookingIdOf(pilgrim, 0..bookingNonce-1). No log scan, one nonce read. */
export const useBookingsOf = (pilgrim: Address | undefined) => {
  const { pbm, publicClient, chainId } = useMabrurContracts();
  return useQuery({
    queryKey: ["mabrur-bookings-of", chainId, pbm?.address, pilgrim],
    enabled: Boolean(pbm && publicClient && pilgrim),
    placeholderData: prev => prev,
    refetchInterval: BOOKINGS_OF_REFETCH_MS,
    queryFn: async () => {
      const client = publicClient as PublicClient;
      const c = pbm as any;
      const nonce = (await client.readContract({
        address: c.address,
        abi: c.abi,
        functionName: "bookingNonce",
        args: [pilgrim],
      })) as bigint;
      const ids = Array.from({ length: Number(nonce) }, (_, i) => bookingIdOf(pilgrim as Address, BigInt(i)));
      const bookings = await Promise.all(ids.map(id => readBooking(client, c, id)));
      return { nonce, bookings: bookings.reverse() };
    },
  });
};

export type TxOutcome =
  | { kind: "reverted"; decoded: DecodedRevert; simulated: true }
  | { kind: "failed"; decoded: DecodedRevert; simulated: false }
  | { kind: "mined"; hash: Hash; receipt: TransactionReceipt; result?: unknown };

/**
 * simulateContract first (a revert becomes a decoded DITOLAK stamp, nothing is sent);
 * only a clean simulation is signed and sent. `dryRun` stops after the simulation.
 */
export const useMabrurTx = () => {
  const { publicClient } = useMabrurContracts();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const run = useCallback(
    async (
      params: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] },
      opts: { dryRun?: boolean; account?: Address } = {},
    ): Promise<TxOutcome | { kind: "simulated-ok"; result: unknown }> => {
      if (!publicClient) throw new Error("no RPC client");
      const account = opts.account ?? address;
      setBusy(true);
      try {
        let request: any;
        let result: unknown;
        try {
          const sim = await publicClient.simulateContract({ ...(params as any), account });
          request = sim.request;
          result = sim.result;
        } catch (e) {
          return { kind: "reverted", decoded: decodeRevert(e), simulated: true };
        }
        if (opts.dryRun) return { kind: "simulated-ok", result };
        if (!walletClient) {
          return {
            kind: "failed",
            simulated: false,
            decoded: {
              name: "NoWallet",
              args: [],
              argNames: [],
              id: "Hubungkan dompet dulu",
              en: "Connect a wallet first",
              isRevert: false,
            },
          };
        }
        try {
          const hash = await walletClient.writeContract(request);
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") {
            return {
              kind: "failed",
              simulated: false,
              decoded: {
                name: "Reverted",
                args: [],
                argNames: [],
                id: `Transaksi gagal (${hash})`,
                en: "Transaction reverted",
                isRevert: true,
              },
            };
          }
          // refresh every booking / balance read right away instead of waiting for the next block poll
          void queryClient.invalidateQueries({ queryKey: ["mabrur-booking"] });
          void queryClient.invalidateQueries({ queryKey: ["mabrur-bookings-of"] });
          void queryClient.invalidateQueries({ queryKey: ["readContract"] });
          return { kind: "mined", hash, receipt, result };
        } catch (e) {
          return { kind: "failed", decoded: decodeRevert(e), simulated: false };
        }
      } finally {
        setBusy(false);
      }
    },
    [publicClient, walletClient, address, queryClient],
  );

  return { run, busy, walletClient, address };
};

/** Decode this contract's events out of a receipt (Spent / Refunded / MarginReleased / Booked). */
export const eventsFrom = (receipt: TransactionReceipt, abi: Abi, address: Address) =>
  receipt.logs
    .filter(l => l.address.toLowerCase() === address.toLowerCase())
    .map(l => {
      try {
        return decodeEventLog({ abi, data: l.data, topics: l.topics }) as { eventName: string; args: any };
      } catch {
        return undefined;
      }
    })
    .filter(Boolean) as { eventName: string; args: any }[];

export const explorerTx = (chainId: number, hash: string, base?: string) =>
  chainId === 31337 ? `/blockexplorer/transaction/${hash}` : base ? `${base}/tx/${hash}` : "";

// Only a well-formed address ever reaches an href (addresses can come from pasted invoice JSON).
export const explorerAddr = (chainId: number, addr: string, base?: string) =>
  !isAddress(addr, { strict: false })
    ? ""
    : chainId === 31337
      ? `/blockexplorer/address/${addr}`
      : base
        ? `${base}/address/${addr}`
        : "";
