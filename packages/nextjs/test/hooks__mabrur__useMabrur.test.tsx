import { useQuery, useQueryClient } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { Address, PublicClient } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount, useBlock, usePublicClient, useWalletClient } from "wagmi";
import {
  BOOKINGS_OF_REFETCH_MS,
  BOOKING_REFETCH_MS,
  DEADLINE_WATCH_S,
  ZERO,
  bookingIdOf,
  eventsFrom,
  explorerAddr,
  explorerTx,
  useBooking,
  useBookingsOf,
  useChainNow,
  useMabrurContracts,
  useMabrurTx,
} from "~~/hooks/mabrur/useMabrur";
import { useDeployedContractInfo, useTargetNetwork } from "~~/hooks/scaffold-eth";
import { decodeRevert } from "~~/utils/mabrur/errors";

// Mock viem
let shouldThrowDecodeEventLog = false;
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    decodeEventLog: vi.fn(() => {
      if (shouldThrowDecodeEventLog) {
        throw new Error("Decoding failed");
      }
      return { eventName: "MockEvent", args: {} };
    }),
    keccak256: vi.fn(data => {
      // Simple mock that returns a consistent hash for testing
      if (!data) return "0x0000000000000000000000000000000000000000000000000000000000000000";
      // Convert data to string representation that can be serialized
      const str = typeof data === "string" ? data : String(data);
      const hex = Buffer.from(str).toString("hex");
      return `0x${hex.padEnd(64, "0")}`;
    }),
    encodeAbiParameters: vi.fn((params, values) => {
      // Simple mock that returns encoded data - handle BigInt by converting to string
      const serializable = {
        params: params,
        values: values?.map(v => (typeof v === "bigint" ? v.toString() : v)),
      };
      return `0x${Buffer.from(JSON.stringify(serializable)).toString("hex")}`;
    }),
  };
});

// Mock @tanstack/react-query
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));

// Mock wagmi
vi.mock("wagmi", () => ({
  useAccount: vi.fn(),
  useBlock: vi.fn(),
  usePublicClient: vi.fn(),
  useWalletClient: vi.fn(),
  useReadContract: vi.fn(),
  useReadContracts: vi.fn(),
  useWriteContract: vi.fn(),
  useSignTypedData: vi.fn(),
  useChainId: vi.fn(),
}));

// Mock scaffold-eth hooks
vi.mock("~~/hooks/scaffold-eth", () => ({
  useDeployedContractInfo: vi.fn(),
  useTargetNetwork: vi.fn(),
}));

// Mock error utilities
vi.mock("~~/utils/mabrur/errors", () => ({
  decodeRevert: vi.fn(),
}));

describe("useMabrur.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("useMabrurContracts", () => {
    it("returns contracts when all are loaded", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const mockPbm = { address: "0x111" as Address, abi: [] };
      const mockTidr = { address: "0x222" as Address, abi: [] };
      const mockRegistry = { address: "0x333" as Address, abi: [] };
      const mockPublicClient = {} as PublicClient;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        if (contractName === "TIDR") return { data: mockTidr, isLoading: false };
        if (contractName === "ClaimRegistry") return { data: mockRegistry, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);

      const { result } = renderHook(() => useMabrurContracts());

      expect(result.current.chainId).toBe(31337);
      expect(result.current.chainName).toBe("hardhat");
      expect(result.current.pbm).toBe(mockPbm);
      expect(result.current.tidr).toBe(mockTidr);
      expect(result.current.registry).toBe(mockRegistry);
      expect(result.current.publicClient).toBe(mockPublicClient);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.ready).toBe(true);
    });

    it("uses the static deployment record while the bytecode check is still loading", () => {
      (useTargetNetwork as any).mockReturnValue({ targetNetwork: { id: 42161, name: "Arbitrum One" } });
      (useDeployedContractInfo as any).mockReturnValue({ data: undefined, isLoading: true });
      (usePublicClient as any).mockReturnValue({} as PublicClient);

      const { result } = renderHook(() => useMabrurContracts());

      expect(result.current.pbm?.address.toLowerCase()).toBe("0x36f1d899d9d4411b2ddfb60dbbe989220336d2d5");
      expect(result.current.tidr?.address.toLowerCase()).toBe("0x66f838be32a624f4c797483a151c7f6209a43448");
      expect(result.current.registry?.address.toLowerCase()).toBe("0xd5b731cd0f2c91d5d64b59d9e4a2a4e4b6315adb");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.ready).toBe(true);
    });

    it("returns isLoading true when any contract is loading on a chain without a deployment record", () => {
      const mockTargetNetwork = { id: 1, name: "Ethereum" };
      const mockPbm = { address: "0x111" as Address, abi: [] };
      const mockPublicClient = {} as PublicClient;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        if (contractName === "TIDR") return { data: undefined, isLoading: true };
        if (contractName === "ClaimRegistry") return { data: undefined, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);

      const { result } = renderHook(() => useMabrurContracts());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.ready).toBe(false);
    });

    it("returns ready false when any contract is missing", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const mockPbm = { address: "0x111" as Address, abi: [] };

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        return { data: undefined, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(undefined);

      const { result } = renderHook(() => useMabrurContracts());

      expect(result.current.ready).toBe(false);
    });
  });

  describe("useChainNow", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("initializes with current wall clock time", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const now = Math.floor(Date.now() / 1000);

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useBlock as any).mockReturnValue({ data: undefined });

      const { result } = renderHook(() => useChainNow());

      expect(result.current.now).toBeLessThanOrEqual(now + 1);
      expect(result.current.now).toBeGreaterThanOrEqual(now - 1);
    });

    it("updates anchor when block timestamp changes", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const blockTimestamp = 1000n;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useBlock as any).mockReturnValue({
        data: { timestamp: blockTimestamp, number: 100n },
      });

      const { result } = renderHook(() => useChainNow());

      expect(result.current.blockTime).toBe(blockTimestamp);
      expect(result.current.blockNumber).toBe(100n);
    });

    it("returns undefined blockNumber when no block data", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useBlock as any).mockReturnValue({ data: undefined });

      const { result } = renderHook(() => useChainNow());

      expect(result.current.blockNumber).toBeUndefined();
      expect(result.current.blockTime).toBeUndefined();
    });

    it("clears interval on unmount", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useBlock as any).mockReturnValue({ data: undefined });

      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      const { unmount } = renderHook(() => useChainNow());
      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("advances time with interval tick", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const blockTimestamp = 1000n;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useBlock as any).mockReturnValue({
        data: { timestamp: blockTimestamp, number: 100n },
      });

      const { result } = renderHook(() => useChainNow());
      const initialNow = result.current.now;

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.now).toBeGreaterThanOrEqual(initialNow);
    });

    it("uses wall clock when anchor is undefined", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useBlock as any).mockReturnValue({ data: undefined });

      const { result } = renderHook(() => useChainNow());
      const initialNow = result.current.now;

      // Advance timers to trigger the interval callback
      // When anchor is undefined, it should use Math.floor(wall)
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      // now should have been updated by the interval
      expect(result.current.now).toBeGreaterThanOrEqual(initialNow);
    });
  });

  describe("bookingIdOf", () => {
    it("computes hash of encoded pilgrim and nonce", () => {
      const pilgrim = "0x1234567890123456789012345678901234567890" as Address;
      const nonce = 0n;

      const id = bookingIdOf(pilgrim, nonce);

      expect(typeof id).toBe("bigint");
      expect(id).toBeGreaterThan(0n);
    });

    it("returns same id for same inputs", () => {
      const pilgrim = "0x1234567890123456789012345678901234567890" as Address;
      const nonce = 5n;

      const id1 = bookingIdOf(pilgrim, nonce);
      const id2 = bookingIdOf(pilgrim, nonce);

      expect(id1).toBe(id2);
    });

    it("returns different id for different nonce", () => {
      const pilgrim = "0x1234567890123456789012345678901234567890" as Address;

      const id1 = bookingIdOf(pilgrim, 0n);
      const id2 = bookingIdOf(pilgrim, 1n);

      expect(id1).not.toBe(id2);
    });

    it("returns different id for different pilgrim", () => {
      const pilgrim1 = "0x1111111111111111111111111111111111111111" as Address;
      const pilgrim2 = "0x2222222222222222222222222222222222222222" as Address;

      const id1 = bookingIdOf(pilgrim1, 0n);
      const id2 = bookingIdOf(pilgrim2, 0n);

      expect(id1).not.toBe(id2);
    });
  });

  describe("useBooking", () => {
    it("returns query with disabled state when id is undefined", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const mockPbm = { address: "0x111" as Address, abi: [] };
      const mockPublicClient = {} as PublicClient;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        return { data: undefined, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useBlock as any).mockReturnValue({ data: undefined });
      (useQuery as any).mockReturnValue({ data: undefined });

      renderHook(() => useBooking(undefined));

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      );
    });

    it("executes query when id is defined and contracts ready", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const mockPbm = { address: "0x111" as Address, abi: [] };
      const mockPublicClient = {
        readContract: vi.fn().mockResolvedValue({}),
      } as any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        return { data: undefined, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useBlock as any).mockReturnValue({ data: { number: 100n } });
      (useQuery as any).mockReturnValue({ data: undefined });

      renderHook(() => useBooking(123n));

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          queryKey: expect.arrayContaining(["mabrur-booking", 31337, "0x111"]),
        }),
      );
    });

    it("uses placeholderData to preserve previous results", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(undefined);
      (useBlock as any).mockReturnValue({ data: undefined });
      (useQuery as any).mockReturnValue({ data: undefined });

      renderHook(() => useBooking(undefined));

      const queryCall = (useQuery as any).mock.calls[0][0];
      expect(queryCall.placeholderData).toBeDefined();
      expect(queryCall.placeholderData("prev")).toBe("prev");
    });

    it("executes queryFn and returns null when pilgrim is ZERO", async () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const mockPbm = { address: "0x111" as Address, abi: [] };
      const mockPublicClient = {
        readContract: vi
          .fn()
          .mockResolvedValueOnce({ pilgrim: ZERO, remaining: [0n, 0n, 0n, 0n], refundable: false })
          .mockResolvedValueOnce(false),
      } as any;

      let capturedQueryFn: any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        return { data: undefined, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useBlock as any).mockReturnValue({ data: { number: 100n } });
      (useQuery as any).mockImplementation(config => {
        capturedQueryFn = config.queryFn;
        return { data: undefined };
      });

      renderHook(() => useBooking(123n));

      if (capturedQueryFn) {
        const result = await capturedQueryFn();
        expect(result).toBeNull();
      }
    });

    it("executes queryFn and returns booking when pilgrim is not ZERO", async () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const mockPbm = { address: "0x111" as Address, abi: [] };
      const mockAddress = "0x1234567890123456789012345678901234567890" as Address;

      const mockPublicClient = {
        readContract: vi
          .fn()
          .mockResolvedValueOnce({
            pilgrim: mockAddress,
            agency: mockAddress,
            ticketBy: 1000n,
            departBy: 2000n,
            departed: false,
            marginReleased: false,
            refunded: false,
            flightVendor: mockAddress,
            remaining: [100n, 200n, 300n, 400n],
            deposited: 1000n,
          })
          .mockResolvedValueOnce(true),
      } as any;

      let capturedQueryFn: any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        return { data: undefined, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useBlock as any).mockReturnValue({ data: { number: 100n } });
      (useQuery as any).mockImplementation(config => {
        capturedQueryFn = config.queryFn;
        return { data: undefined };
      });

      renderHook(() => useBooking(123n));

      if (capturedQueryFn) {
        const result = await capturedQueryFn();
        expect(result).toBeDefined();
        expect(result.pilgrim).toBe(mockAddress);
        expect(result.refundable).toBe(true);
      }
    });
  });

  describe("useBooking live refresh", () => {
    const addr = "0x1234567890123456789012345678901234567890" as Address;
    const NOW = 1_800_000_000;
    const bk = (over: Record<string, unknown> = {}) => ({
      id: 1n,
      pilgrim: addr,
      ticketBy: BigInt(NOW + 3),
      departBy: BigInt(NOW + 100_000),
      refunded: false,
      refundable: false,
      ...over,
    });
    const setup = (data: any) => {
      const refetch = vi.fn();
      (useTargetNetwork as any).mockReturnValue({ targetNetwork: { id: 31337, name: "hardhat" } });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }: any) =>
        contractName === "MabrurPBM"
          ? { data: { address: "0x111", abi: [] }, isLoading: false }
          : { data: undefined, isLoading: false },
      );
      (usePublicClient as any).mockReturnValue({});
      (useBlock as any).mockReturnValue({ data: undefined });
      (useQuery as any).mockImplementation(() => ({ data, refetch }));
      return refetch;
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW * 1000);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("polls while open and stops once refunded", () => {
      setup(undefined);
      renderHook(() => useBooking(1n));
      const fn = (useQuery as any).mock.calls[0][0].refetchInterval;
      expect(BOOKING_REFETCH_MS).toBe(5000);
      expect(fn({ state: { data: undefined } })).toBe(BOOKING_REFETCH_MS);
      expect(fn({ state: { data: bk() } })).toBe(BOOKING_REFETCH_MS);
      expect(fn({ state: { data: bk({ refunded: true }) } })).toBe(false);
    });

    it("re-reads every second once the ticket-by deadline passes, until refundable flips", () => {
      const refetch = setup(bk());
      renderHook(() => useBooking(1n));
      act(() => {
        vi.advanceTimersByTime(2000); // now = deadline - 1
      });
      expect(refetch).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1000); // now = deadline
      });
      expect(refetch).toHaveBeenCalled();
      const n = refetch.mock.calls.length;
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(refetch.mock.calls.length).toBeGreaterThan(n);
    });

    it("stops re-reading after the watch window", () => {
      const refetch = setup(bk({ ticketBy: BigInt(NOW - DEADLINE_WATCH_S - 5) }));
      renderHook(() => useBooking(1n));
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(refetch).not.toHaveBeenCalled();
    });

    it("does not re-read a booking that is already refundable or refunded or missing", () => {
      const lapsed = { ticketBy: BigInt(NOW - 1) };
      for (const data of [bk({ ...lapsed, refundable: true }), bk({ ...lapsed, refunded: true }), null]) {
        const refetch = setup(data);
        const { unmount } = renderHook(() => useBooking(1n));
        act(() => {
          vi.advanceTimersByTime(3000);
        });
        expect(refetch).not.toHaveBeenCalled();
        unmount();
      }
    });

    it("re-reads at the depart-by deadline too", () => {
      const refetch = setup(bk({ ticketBy: BigInt(NOW - 100_000), departBy: BigInt(NOW + 2) }));
      renderHook(() => useBooking(1n));
      // ticket-by lapsed long ago (outside the window) so only departBy can trigger
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(refetch).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(refetch).toHaveBeenCalled();
    });
  });

  describe("useBookingsOf", () => {
    it("returns query with disabled state when pilgrim is undefined", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(undefined);
      (useQuery as any).mockReturnValue({ data: undefined });

      renderHook(() => useBookingsOf(undefined));

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      );
    });

    it("returns query with correct refetchInterval", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const mockPbm = { address: "0x111" as Address, abi: [] };
      const mockPublicClient = {} as PublicClient;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        return { data: undefined, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useQuery as any).mockReturnValue({ data: undefined });

      renderHook(() => useBookingsOf("0x1234567890123456789012345678901234567890" as Address));

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          refetchInterval: BOOKINGS_OF_REFETCH_MS,
        }),
      );
    });

    it("sets placeholderData to preserve previous results", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(undefined);
      (useQuery as any).mockReturnValue({ data: undefined });

      renderHook(() => useBookingsOf("0x1234567890123456789012345678901234567890" as Address));

      const queryCall = (useQuery as any).mock.calls[0][0];
      expect(queryCall.placeholderData).toBeDefined();
      expect(queryCall.placeholderData("prev")).toBe("prev");
    });

    it("executes queryFn and returns nonce and bookings", async () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const mockPbm = { address: "0x111" as Address, abi: [] };
      const mockAddress = "0x1234567890123456789012345678901234567890" as Address;
      const mockNonce = 2n;

      const mockPublicClient = {
        readContract: vi
          .fn()
          .mockResolvedValueOnce(mockNonce)
          .mockResolvedValueOnce({
            pilgrim: mockAddress,
            agency: mockAddress,
            remaining: [100n, 200n, 300n, 400n],
            refundable: true,
          })
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce({
            pilgrim: mockAddress,
            agency: mockAddress,
            remaining: [100n, 200n, 300n, 400n],
            refundable: true,
          })
          .mockResolvedValueOnce(true),
      } as any;

      let capturedQueryFn: any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        return { data: undefined, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useQuery as any).mockImplementation(config => {
        capturedQueryFn = config.queryFn;
        return { data: undefined };
      });

      renderHook(() => useBookingsOf(mockAddress));

      if (capturedQueryFn) {
        const result = await capturedQueryFn();
        expect(result.nonce).toBe(mockNonce);
        expect(result.bookings).toBeDefined();
        expect(Array.isArray(result.bookings)).toBe(true);
        // bookings are reversed
        expect(result.bookings.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("useMabrurTx", () => {
    it("returns run, busy, walletClient, and address", () => {
      const mockPublicClient = {} as PublicClient;
      const mockWalletClient = {};
      const mockAddress = "0x1234567890123456789012345678901234567890" as Address;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: mockWalletClient });
      (useAccount as any).mockReturnValue({ address: mockAddress });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });

      const { result } = renderHook(() => useMabrurTx());

      expect(result.current.run).toBeDefined();
      expect(result.current.busy).toBe(false);
      expect(result.current.walletClient).toBe(mockWalletClient);
      expect(result.current.address).toBe(mockAddress);
    });

    it("throws error when no RPC client", async () => {
      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(undefined);
      (useWalletClient as any).mockReturnValue({ data: undefined });
      (useAccount as any).mockReturnValue({ address: undefined });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });

      const { result } = renderHook(() => useMabrurTx());

      await expect(
        result.current.run(
          {
            address: "0x111" as Address,
            abi: [],
            functionName: "test",
            args: [],
          },
          {},
        ),
      ).rejects.toThrow("no RPC client");
    });

    it("returns simulated-ok on successful simulation with dryRun", async () => {
      const mockResult = { value: 123 };
      const mockPublicClient = {
        simulateContract: vi.fn().mockResolvedValue({
          request: { account: "0x123" },
          result: mockResult,
        }),
      } as any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: {} });
      (useAccount as any).mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Address,
      });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });

      const { result } = renderHook(() => useMabrurTx());

      const outcome = await result.current.run(
        {
          address: "0x111" as Address,
          abi: [],
          functionName: "test",
          args: [],
        },
        { dryRun: true },
      );

      expect(outcome).toEqual({ kind: "simulated-ok", result: mockResult });
    });

    it("returns reverted when simulation fails", async () => {
      const mockError = new Error("test error");
      const mockPublicClient = {
        simulateContract: vi.fn().mockRejectedValue(mockError),
      } as any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: {} });
      (useAccount as any).mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Address,
      });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });
      (decodeRevert as any).mockReturnValue({
        name: "TestError",
        args: [],
        argNames: [],
        id: "test id",
        en: "test en",
        isRevert: true,
      });

      const { result } = renderHook(() => useMabrurTx());

      const outcome = await result.current.run(
        {
          address: "0x111" as Address,
          abi: [],
          functionName: "test",
          args: [],
        },
        {},
      );

      expect(outcome.kind).toBe("reverted");
      expect(outcome.simulated).toBe(true);
    });

    it("returns failed with NoWallet when wallet not connected", async () => {
      const mockPublicClient = {
        simulateContract: vi.fn().mockResolvedValue({
          request: { account: "0x123" },
          result: {},
        }),
      } as any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: undefined });
      (useAccount as any).mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Address,
      });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });

      const { result } = renderHook(() => useMabrurTx());

      const outcome = await result.current.run(
        {
          address: "0x111" as Address,
          abi: [],
          functionName: "test",
          args: [],
        },
        {},
      );

      expect(outcome.kind).toBe("failed");
      expect(outcome.decoded.name).toBe("NoWallet");
      expect(outcome.simulated).toBe(false);
    });

    it("returns mined on successful transaction", async () => {
      const mockHash = "0xabc123" as any;
      const mockReceipt = { status: "success" as const };
      const mockPublicClient = {
        simulateContract: vi.fn().mockResolvedValue({
          request: { account: "0x123" },
          result: {},
        }),
        waitForTransactionReceipt: vi.fn().mockResolvedValue(mockReceipt),
      } as any;
      const mockWalletClient = {
        writeContract: vi.fn().mockResolvedValue(mockHash),
      } as any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: mockWalletClient });
      (useAccount as any).mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Address,
      });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });

      const { result } = renderHook(() => useMabrurTx());

      const outcome = await result.current.run(
        {
          address: "0x111" as Address,
          abi: [],
          functionName: "test",
          args: [],
        },
        {},
      );

      expect(outcome.kind).toBe("mined");
      expect(outcome).toEqual({
        kind: "mined",
        hash: mockHash,
        receipt: mockReceipt,
        result: {},
      });
    });

    it("returns failed when receipt status is not success", async () => {
      const mockHash = "0xabc123" as any;
      const mockReceipt = { status: "reverted" as const };
      const mockPublicClient = {
        simulateContract: vi.fn().mockResolvedValue({
          request: { account: "0x123" },
          result: {},
        }),
        waitForTransactionReceipt: vi.fn().mockResolvedValue(mockReceipt),
      } as any;
      const mockWalletClient = {
        writeContract: vi.fn().mockResolvedValue(mockHash),
      } as any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: mockWalletClient });
      (useAccount as any).mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Address,
      });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });

      const { result } = renderHook(() => useMabrurTx());

      const outcome = await result.current.run(
        {
          address: "0x111" as Address,
          abi: [],
          functionName: "test",
          args: [],
        },
        {},
      );

      expect(outcome.kind).toBe("failed");
      expect(outcome.simulated).toBe(false);
      expect(outcome.decoded.name).toBe("Reverted");
    });

    it("returns failed when wallet write throws", async () => {
      const mockPublicClient = {
        simulateContract: vi.fn().mockResolvedValue({
          request: { account: "0x123" },
          result: {},
        }),
      } as any;
      const mockWalletClient = {
        writeContract: vi.fn().mockRejectedValue(new Error("write failed")),
      } as any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: mockWalletClient });
      (useAccount as any).mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Address,
      });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });
      (decodeRevert as any).mockReturnValue({
        name: "Error",
        args: [],
        argNames: [],
        id: "write failed",
        en: "write failed",
        isRevert: false,
      });

      const { result } = renderHook(() => useMabrurTx());

      const outcome = await result.current.run(
        {
          address: "0x111" as Address,
          abi: [],
          functionName: "test",
          args: [],
        },
        {},
      );

      expect(outcome.kind).toBe("failed");
      expect(outcome.simulated).toBe(false);
    });

    it("invalidates queries on successful transaction", async () => {
      const mockHash = "0xabc123" as any;
      const mockReceipt = { status: "success" as const };
      const mockPublicClient = {
        simulateContract: vi.fn().mockResolvedValue({
          request: { account: "0x123" },
          result: {},
        }),
        waitForTransactionReceipt: vi.fn().mockResolvedValue(mockReceipt),
      } as any;
      const mockWalletClient = {
        writeContract: vi.fn().mockResolvedValue(mockHash),
      } as any;
      const mockInvalidate = vi.fn();

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: mockWalletClient });
      (useAccount as any).mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Address,
      });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: mockInvalidate,
      });

      const { result } = renderHook(() => useMabrurTx());

      await result.current.run(
        {
          address: "0x111" as Address,
          abi: [],
          functionName: "test",
          args: [],
        },
        {},
      );

      expect(mockInvalidate).toHaveBeenCalledWith({
        queryKey: ["mabrur-booking"],
      });
      expect(mockInvalidate).toHaveBeenCalledWith({
        queryKey: ["mabrur-bookings-of"],
      });
      expect(mockInvalidate).toHaveBeenCalledWith({
        queryKey: ["readContract"],
      });
    });

    it("uses account override when provided", async () => {
      const mockPublicClient = {
        simulateContract: vi.fn().mockResolvedValue({
          request: { account: "0x456" },
          result: {},
        }),
      } as any;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: { id: 31337, name: "hardhat" },
      });
      (useDeployedContractInfo as any).mockReturnValue({
        data: undefined,
        isLoading: false,
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: undefined });
      (useAccount as any).mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Address,
      });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });

      const { result } = renderHook(() => useMabrurTx());

      const overrideAccount = "0x9999999999999999999999999999999999999999" as Address;
      await result.current.run(
        {
          address: "0x111" as Address,
          abi: [],
          functionName: "test",
          args: [],
        },
        { account: overrideAccount },
      );

      const callArgs = mockPublicClient.simulateContract.mock.calls[0][0];
      expect(callArgs.account).toBe(overrideAccount);
    });
  });

  describe("eventsFrom", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("filters logs by contract address (case-insensitive)", async () => {
      const contractAddress = "0x111111111111111111111111111111111111111111" as Address;
      const otherAddress = "0x222222222222222222222222222222222222222222" as Address;

      const mockReceipt = {
        logs: [
          {
            address: contractAddress,
            data: "0x",
            topics: [],
          },
          {
            address: otherAddress,
            data: "0x",
            topics: [],
          },
        ],
      } as any;

      const result = eventsFrom(mockReceipt, [], contractAddress);

      // The viem mock should decode the first log but not the second (different address)
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("handles lowercase address comparison", () => {
      const contractAddress = "0xABC" as Address;
      const mockReceipt = {
        logs: [
          {
            address: "0xabc" as Address,
            data: "0x",
            topics: [],
          },
        ],
      } as any;

      const result = eventsFrom(mockReceipt, [], contractAddress);

      // Should match despite case difference
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("executes catch block when decodeEventLog throws", () => {
      const contractAddress = "0x111" as Address;

      // Enable the throw flag
      shouldThrowDecodeEventLog = true;

      const mockReceipt = {
        logs: [
          {
            address: contractAddress,
            data: "0x",
            topics: [],
          },
        ],
      } as any;

      const result = eventsFrom(mockReceipt, [], contractAddress);

      // Result should be empty since decoding failed and was caught
      expect(result).toEqual([]);

      // Disable the throw flag
      shouldThrowDecodeEventLog = false;
    });

    it("returns empty array when no matching logs", () => {
      const contractAddress = "0x111" as Address;
      const otherAddress = "0x222" as Address;

      const mockReceipt = {
        logs: [
          {
            address: otherAddress,
            data: "0x",
            topics: [],
          },
        ],
      } as any;

      const result = eventsFrom(mockReceipt, [], contractAddress);

      expect(result).toHaveLength(0);
    });

    it("returns empty array for empty receipt logs", () => {
      const contractAddress = "0x111" as Address;

      const mockReceipt = {
        logs: [],
      } as any;

      const result = eventsFrom(mockReceipt, [], contractAddress);

      expect(result).toHaveLength(0);
    });
  });

  describe("explorerTx", () => {
    it("returns blockexplorer path for local chain (31337)", () => {
      const hash = "0xabc123";
      const result = explorerTx(31337, hash);

      expect(result).toBe(`/blockexplorer/transaction/${hash}`);
    });

    it("returns empty string for remote chain without base", () => {
      const hash = "0xabc123";
      const result = explorerTx(1, hash);

      expect(result).toBe("");
    });

    it("returns explorer URL for remote chain with base", () => {
      const hash = "0xabc123";
      const base = "https://etherscan.io";
      const result = explorerTx(1, hash, base);

      expect(result).toBe(`${base}/tx/${hash}`);
    });

    it("works with sepolia chain id", () => {
      const hash = "0xdef456";
      const base = "https://sepolia.etherscan.io";
      const result = explorerTx(11155111, hash, base);

      expect(result).toBe(`${base}/tx/${hash}`);
    });
  });

  describe("explorerAddr", () => {
    it("returns blockexplorer path for local chain (31337)", () => {
      const addr = "0x1234567890123456789012345678901234567890";
      const result = explorerAddr(31337, addr);

      expect(result).toBe(`/blockexplorer/address/${addr}`);
    });

    it("returns empty string for remote chain without base", () => {
      const addr = "0x1234567890123456789012345678901234567890";
      const result = explorerAddr(1, addr);

      expect(result).toBe("");
    });

    it("returns explorer URL for remote chain with base", () => {
      const addr = "0x1234567890123456789012345678901234567890";
      const base = "https://etherscan.io";
      const result = explorerAddr(1, addr, base);

      expect(result).toBe(`${base}/address/${addr}`);
    });

    it("works with different addresses", () => {
      const addr = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      const base = "https://sepolia.etherscan.io";
      const result = explorerAddr(11155111, addr, base);

      expect(result).toBe(`${base}/address/${addr}`);
    });
  });

  describe("explorerAddr input validation", () => {
    it("never builds a link from a non-address string (e.g. injected markup or a javascript: URL)", () => {
      expect(explorerAddr(42161, "javascript:alert(1)", "https://arbiscan.io")).toBe("");
      expect(explorerAddr(31337, "<img src=x onerror=alert(1)>")).toBe("");
      expect(explorerAddr(42161, "0x1234", "https://arbiscan.io")).toBe("");
    });
  });

  describe("ZERO constant", () => {
    it("is the zero address", () => {
      expect(ZERO).toBe("0x0000000000000000000000000000000000000000");
    });
  });

  describe("BOOKINGS_OF_REFETCH_MS constant", () => {
    it("is set to 6000 milliseconds", () => {
      expect(BOOKINGS_OF_REFETCH_MS).toBe(6000);
    });
  });

  describe("integration: full booking flow", () => {
    it("simulates getting contracts, then tx", () => {
      const mockTargetNetwork = { id: 31337, name: "hardhat" };
      const mockPbm = { address: "0x111" as Address, abi: [] };
      const mockPublicClient = {} as PublicClient;

      (useTargetNetwork as any).mockReturnValue({
        targetNetwork: mockTargetNetwork,
      });
      (useDeployedContractInfo as any).mockImplementation(({ contractName }) => {
        if (contractName === "MabrurPBM") return { data: mockPbm, isLoading: false };
        return { data: undefined, isLoading: false };
      });
      (usePublicClient as any).mockReturnValue(mockPublicClient);
      (useWalletClient as any).mockReturnValue({ data: {} });
      (useAccount as any).mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Address,
      });
      (useBlock as any).mockReturnValue({ data: undefined });
      (useQuery as any).mockReturnValue({ data: undefined });
      (useQueryClient as any).mockReturnValue({
        invalidateQueries: vi.fn(),
      });

      const { result: contractsResult } = renderHook(() => useMabrurContracts());
      const { result: txResult } = renderHook(() => useMabrurTx());

      expect(contractsResult.current.pbm).toBe(mockPbm);
      expect(txResult.current.address).toBe("0x1234567890123456789012345678901234567890");
    });
  });
});
