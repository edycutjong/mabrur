import { useQuery } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { Address, Hash } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Booking, LedgerRow, deriveLines, useBookingLedger } from "~~/hooks/mabrur/useLedger";
import { useMabrurContracts } from "~~/hooks/mabrur/useMabrur";

// Mock @tanstack/react-query
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn((config: any) => {
      // Execute queryFn if enabled
      if (!config.enabled) {
        return { data: undefined, isLoading: false, error: null, status: "success" };
      }

      // For async queryFn, we need to return a result that simulates query completion
      // In real renderHook with waitFor, the actual query would be executed
      let data: unknown = undefined;
      let error: unknown = null;
      let isLoading = true;

      // Execute queryFn synchronously if possible, or prepare for async handling
      if (config.queryFn) {
        try {
          const result = config.queryFn();
          if (result instanceof Promise) {
            // For async functions, we return data when it resolves
            result
              .then((resolved: any) => {
                data = resolved;
                isLoading = false;
              })
              .catch((err: any) => {
                error = err;
                isLoading = false;
              });
            // Return loading state while promise is pending
            return { data: undefined, isLoading: true, error: null, status: "pending" };
          } else {
            data = result;
            isLoading = false;
          }
        } catch (err) {
          error = err;
          isLoading = false;
        }
      }

      return {
        data,
        isLoading,
        error,
        status: error ? "error" : isLoading ? "pending" : "success",
      };
    }),
  };
});

// Mock useMabrurContracts
vi.mock("~~/hooks/mabrur/useMabrur", () => ({
  useMabrurContracts: vi.fn(() => ({
    pbm: undefined,
    publicClient: undefined,
    chainId: 31337,
  })),
}));

describe("useBookingLedger", () => {
  const mockBooking: Booking = {
    id: BigInt("123456789"),
    pilgrim: "0x1234567890123456789012345678901234567890" as Address,
    agency: "0x2345678901234567890123456789012345678901" as Address,
    ticketBy: BigInt(1000),
    departBy: BigInt(2000),
    departed: false,
    marginReleased: false,
    refunded: false,
    flightVendor: "0x0000000000000000000000000000000000000000" as Address,
    remaining: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
    deposited: BigInt(10000),
    refundable: true,
  };

  const mockPublicClient = {
    getContractEvents: vi.fn(async () => []),
    getBlock: vi.fn(async () => ({ timestamp: BigInt(1000) })),
  };

  const mockPbm = {
    address: "0x3456789012345678901234567890123456789012" as Address,
    abi: [],
    deployedOnBlock: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (mockPublicClient.getContractEvents as any).mockResolvedValue([]);
    (mockPublicClient.getBlock as any).mockResolvedValue({ timestamp: BigInt(1000) });
  });

  describe("query enabled/disabled states", () => {
    it("disables query when booking is null", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(null));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      expect(useQueryCall.enabled).toBe(false);
    });

    it("disables query when booking is undefined", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(undefined));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      expect(useQueryCall.enabled).toBe(false);
    });

    it("disables query when pbm is missing", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: undefined,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      expect(useQueryCall.enabled).toBe(false);
    });

    it("disables query when publicClient is missing", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: undefined,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      expect(useQueryCall.enabled).toBe(false);
    });

    it("enables query when all dependencies are present", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      expect(useQueryCall.enabled).toBe(true);
    });

    it("executes queryFn when query is enabled", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      expect(useQueryCall.queryFn).toBeDefined();

      // Execute queryFn
      const result = await useQueryCall.queryFn();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("query key generation", () => {
    it("generates correct query key with booking and state", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      const expectedStateKey = `${mockBooking.remaining.join(",")}|${mockBooking.refunded}|${mockBooking.marginReleased}`;

      expect(useQueryCall.queryKey).toEqual([
        "mabrur-ledger",
        31337,
        mockPbm.address,
        mockBooking.id.toString(),
        expectedStateKey,
      ]);
    });

    it("generates different query key when booking state changes", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      const booking1 = { ...mockBooking, remaining: [BigInt(100), BigInt(200), BigInt(300), BigInt(400)] as const };
      const booking2 = { ...mockBooking, remaining: [BigInt(500), BigInt(600), BigInt(700), BigInt(800)] as const };

      const { rerender } = renderHook(({ b }) => useBookingLedger(b), { initialProps: { b: booking1 } });

      const firstKey = (useQuery as any).mock.calls[0][0].queryKey;

      rerender({ b: booking2 });

      const secondKey = (useQuery as any).mock.calls[1][0].queryKey;

      expect(firstKey).not.toEqual(secondKey);
    });

    it("generates empty stateKey when booking is null", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(null));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      expect(useQueryCall.queryKey[4]).toBe("");
    });
  });

  describe("queryFn event processing", () => {
    it("processes booked events correctly", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      const bookedLog = {
        eventName: "Booked",
        blockNumber: BigInt(100),
        logIndex: 0,
        transactionHash: "0xaabbccdd" as Hash,
        args: {
          id: mockBooking.id,
          agency: "0x2222222222222222222222222222222222222222" as Address,
          lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
        },
      };

      (mockPublicClient.getContractEvents as any).mockImplementation((opts: any) => {
        if (opts.eventName === "Booked") return Promise.resolve([bookedLog]);
        return Promise.resolve([]);
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      const result = await useQueryCall.queryFn();

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe("Booked");
      expect(result[0].amount).toBe(BigInt(10000)); // sum of lines: 1000+2000+3000+4000
    });

    it("processes spent events correctly", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      const spentLog = {
        eventName: "Spent",
        blockNumber: BigInt(200),
        logIndex: 0,
        transactionHash: "0xeeff0011" as Hash,
        args: {
          id: mockBooking.id,
          line: BigInt(0),
          amount: BigInt(500),
          vendor: "0x3333333333333333333333333333333333333333" as Address,
          ref: "0x12345678" as `0x${string}`,
        },
      };

      (mockPublicClient.getContractEvents as any).mockImplementation((opts: any) => {
        if (opts.eventName === "Spent") return Promise.resolve([spentLog]);
        return Promise.resolve([]);
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      const result = await useQueryCall.queryFn();

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe("Spent");
      expect(result[0].amount).toBe(BigInt(500));
      expect(result[0].line).toBe(0);
    });

    it("processes MarginReleased events correctly", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      const marginLog = {
        eventName: "MarginReleased",
        blockNumber: BigInt(300),
        logIndex: 0,
        transactionHash: "0xff00aabb" as Hash,
        args: {
          id: mockBooking.id,
          amount: BigInt(200),
          agency: "0x2222222222222222222222222222222222222222" as Address,
        },
      };

      (mockPublicClient.getContractEvents as any).mockImplementation((opts: any) => {
        if (opts.eventName === "MarginReleased") return Promise.resolve([marginLog]);
        return Promise.resolve([]);
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      const result = await useQueryCall.queryFn();

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe("MarginReleased");
      expect(result[0].amount).toBe(BigInt(200));
      expect(result[0].line).toBe(3);
    });

    it("processes Refunded events correctly", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      const refundLog = {
        eventName: "Refunded",
        blockNumber: BigInt(400),
        logIndex: 0,
        transactionHash: "0xaabbff00" as Hash,
        args: {
          id: mockBooking.id,
          amount: BigInt(1000),
          caller: "0x1111111111111111111111111111111111111111" as Address,
        },
      };

      (mockPublicClient.getContractEvents as any).mockImplementation((opts: any) => {
        if (opts.eventName === "Refunded") return Promise.resolve([refundLog]);
        return Promise.resolve([]);
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      const result = await useQueryCall.queryFn();

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe("Refunded");
      expect(result[0].amount).toBe(BigInt(1000));
    });

    it("sorts logs by blockNumber then logIndex", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      const log1 = {
        eventName: "Booked",
        blockNumber: BigInt(100),
        logIndex: 1,
        transactionHash: "0xaabbccdd" as Hash,
        args: {
          id: mockBooking.id,
          agency: "0x2222222222222222222222222222222222222222",
          lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
        },
      };

      const log2 = {
        eventName: "Spent",
        blockNumber: BigInt(100),
        logIndex: 0,
        transactionHash: "0xeeff0011" as Hash,
        args: {
          id: mockBooking.id,
          line: BigInt(0),
          amount: BigInt(100),
          vendor: "0x3333333333333333333333333333333333333333",
        },
      };

      (mockPublicClient.getContractEvents as any).mockImplementation((opts: any) => {
        if (opts.eventName === "Booked") return Promise.resolve([log1]);
        if (opts.eventName === "Spent") return Promise.resolve([log2]);
        return Promise.resolve([]);
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      const result = await useQueryCall.queryFn();

      // log2 should come before log1 since same block but lower logIndex
      expect(result[0].kind).toBe("Spent");
      expect(result[1].kind).toBe("Booked");
    });

    it("sorts logs by blockNumber when different blocks", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      const log1 = {
        eventName: "Booked",
        blockNumber: BigInt(200),
        logIndex: 0,
        transactionHash: "0xaabbccdd" as Hash,
        args: {
          id: mockBooking.id,
          agency: "0x2222222222222222222222222222222222222222",
          lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
        },
      };

      const log2 = {
        eventName: "Spent",
        blockNumber: BigInt(100),
        logIndex: 1,
        transactionHash: "0xeeff0011" as Hash,
        args: {
          id: mockBooking.id,
          line: BigInt(0),
          amount: BigInt(100),
          vendor: "0x3333333333333333333333333333333333333333",
        },
      };

      (mockPublicClient.getContractEvents as any).mockImplementation((opts: any) => {
        if (opts.eventName === "Booked") return Promise.resolve([log1]);
        if (opts.eventName === "Spent") return Promise.resolve([log2]);
        return Promise.resolve([]);
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      const result = await useQueryCall.queryFn();

      // log2 (block 100) should come before log1 (block 200)
      expect(result[0].blockNumber).toBe(BigInt(100));
      expect(result[1].blockNumber).toBe(BigInt(200));
    });

    it("uses deployedOnBlock from pbm when provided", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      (mockPublicClient.getContractEvents as any).mockClear();
      (mockPublicClient.getContractEvents as any).mockResolvedValue([]);

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      await useQueryCall.queryFn();

      expect(mockPublicClient.getContractEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: BigInt(100),
        }),
      );
    });

    it("uses 0 as fromBlock when deployedOnBlock is undefined", async () => {
      const pbmNoDeployBlock = {
        address: "0x3456789012345678901234567890123456789012" as Address,
        abi: [],
      };

      (useMabrurContracts as any).mockReturnValue({
        pbm: pbmNoDeployBlock,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      (mockPublicClient.getContractEvents as any).mockClear();
      (mockPublicClient.getContractEvents as any).mockResolvedValue([]);

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      await useQueryCall.queryFn();

      expect(mockPublicClient.getContractEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: BigInt(0),
        }),
      );
    });

    it("fetches and attaches timestamps", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      const log = {
        eventName: "Booked",
        blockNumber: BigInt(100),
        logIndex: 0,
        transactionHash: "0xaabbccdd" as Hash,
        args: {
          id: mockBooking.id,
          agency: "0x2222222222222222222222222222222222222222",
          lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
        },
      };

      (mockPublicClient.getContractEvents as any).mockImplementation((opts: any) => {
        if (opts.eventName === "Booked") return Promise.resolve([log]);
        return Promise.resolve([]);
      });

      (mockPublicClient.getBlock as any).mockResolvedValue({ timestamp: BigInt(1700000000) });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      const result = await useQueryCall.queryFn();

      expect(result[0].timestamp).toBe(BigInt(1700000000));
      expect(mockPublicClient.getBlock).toHaveBeenCalledWith({ blockNumber: BigInt(100) });
    });

    it("handles block timestamp fetch errors gracefully", async () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      const log = {
        eventName: "Booked",
        blockNumber: BigInt(100),
        logIndex: 0,
        transactionHash: "0xaabbccdd" as Hash,
        args: {
          id: mockBooking.id,
          agency: "0x2222222222222222222222222222222222222222",
          lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
        },
      };

      (mockPublicClient.getContractEvents as any).mockImplementation((opts: any) => {
        if (opts.eventName === "Booked") return Promise.resolve([log]);
        return Promise.resolve([]);
      });

      (mockPublicClient.getBlock as any).mockRejectedValue(new Error("RPC error"));

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      const result = await useQueryCall.queryFn();

      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBeUndefined();
    });
  });

  describe("query configuration", () => {
    it("sets retry to false", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      expect(useQueryCall.retry).toBe(false);
    });

    it("sets staleTime to Infinity", () => {
      (useMabrurContracts as any).mockReturnValue({
        pbm: mockPbm,
        publicClient: mockPublicClient,
        chainId: 31337,
      });

      renderHook(() => useBookingLedger(mockBooking));

      const useQueryCall = (useQuery as any).mock.calls[0][0];
      expect(useQueryCall.staleTime).toBe(Infinity);
    });
  });
});

describe("deriveLines", () => {
  const mockBooking: Booking = {
    id: BigInt("123456789"),
    pilgrim: "0x1111111111111111111111111111111111111111" as Address,
    agency: "0x2222222222222222222222222222222222222222" as Address,
    ticketBy: BigInt(1000),
    departBy: BigInt(2000),
    departed: false,
    marginReleased: false,
    refunded: false,
    flightVendor: "0x0000000000000000000000000000000000000000" as Address,
    remaining: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
    deposited: BigInt(10000),
    refundable: true,
  };

  describe("without ledger data", () => {
    it("returns 4 LineState objects for each line", () => {
      const result = deriveLines(mockBooking);
      expect(result).toHaveLength(4);
      expect(result.every(line => line.state !== undefined)).toBe(true);
    });

    it("returns earmarked state when no ledger and booking has remaining", () => {
      const result = deriveLines(mockBooking);
      expect(result[0].state).toBe("earmarked");
      expect(result[1].state).toBe("earmarked");
      expect(result[2].state).toBe("earmarked");
    });

    it("returns empty array for spent when no ledger", () => {
      const result = deriveLines(mockBooking);
      result.forEach(line => {
        expect(line.spent).toEqual([]);
      });
    });

    it("returns undefined original when no booked event in ledger", () => {
      const result = deriveLines(mockBooking);
      result.forEach(line => {
        expect(line.original).toBeUndefined();
      });
    });

    it("preserves remaining amounts from booking", () => {
      const result = deriveLines(mockBooking);
      expect(result[0].remaining).toBe(mockBooking.remaining[0]);
      expect(result[1].remaining).toBe(mockBooking.remaining[1]);
      expect(result[2].remaining).toBe(mockBooking.remaining[2]);
      expect(result[3].remaining).toBe(mockBooking.remaining[3]);
    });
  });

  describe("with empty ledger", () => {
    it("returns earmarked for lines with remaining > 0", () => {
      const result = deriveLines(mockBooking, []);
      expect(result[0].state).toBe("earmarked");
      expect(result[1].state).toBe("earmarked");
      expect(result[2].state).toBe("earmarked");
      expect(result[3].state).toBe("earmarked");
    });

    it("returns lunas for lines with remaining = 0 and not refunded", () => {
      const booking = {
        ...mockBooking,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
        refunded: false,
      };
      const result = deriveLines(booking, []);
      expect(result[0].state).toBe("lunas");
      expect(result[1].state).toBe("lunas");
      expect(result[2].state).toBe("lunas");
      expect(result[3].state).toBe("lunas");
    });
  });

  describe("with booked event in ledger", () => {
    const bookedEvent: LedgerRow = {
      kind: "Booked",
      blockNumber: BigInt(100),
      logIndex: 0,
      hash: "0xaabbccdd" as Hash,
      amount: BigInt(10000),
      lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
      counterparty: "0x2222222222222222222222222222222222222222" as Address,
    };

    it("sets original amount from booked event", () => {
      const result = deriveLines(mockBooking, [bookedEvent]);
      expect(result[0].original).toBe(BigInt(1000));
      expect(result[1].original).toBe(BigInt(2000));
      expect(result[2].original).toBe(BigInt(3000));
      expect(result[3].original).toBe(BigInt(4000));
    });
  });

  describe("spent event handling", () => {
    const bookedEvent: LedgerRow = {
      kind: "Booked",
      blockNumber: BigInt(100),
      logIndex: 0,
      hash: "0xaabbccdd" as Hash,
      amount: BigInt(10000),
      lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
      counterparty: "0x2222222222222222222222222222222222222222" as Address,
    };

    const spentEvent: LedgerRow = {
      kind: "Spent",
      blockNumber: BigInt(200),
      logIndex: 0,
      hash: "0xeeff0011" as Hash,
      amount: BigInt(500),
      line: 0,
      counterparty: "0x3333333333333333333333333333333333333333" as Address,
      ref: "0x12345678" as `0x${string}`,
    };

    it("includes spent events in line data", () => {
      const result = deriveLines(mockBooking, [bookedEvent, spentEvent]);
      expect(result[0].spent).toHaveLength(1);
      expect(result[0].spent[0]).toEqual({
        amount: BigInt(500),
        to: "0x3333333333333333333333333333333333333333",
        hash: "0xeeff0011" as Hash,
        ref: "0x12345678" as `0x${string}`,
      });
    });

    it("filters spent events by line number", () => {
      const spentLine1: LedgerRow = { ...spentEvent, line: 1 };
      const result = deriveLines(mockBooking, [bookedEvent, spentEvent, spentLine1]);
      expect(result[0].spent).toHaveLength(1);
      expect(result[1].spent).toHaveLength(1);
      expect(result[2].spent).toHaveLength(0);
      expect(result[3].spent).toHaveLength(0);
    });

    it("marks line as partial when spent > 0 and remaining > 0", () => {
      const booking = {
        ...mockBooking,
        remaining: [BigInt(500), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
      };
      const result = deriveLines(booking, [bookedEvent, spentEvent]);
      expect(result[0].state).toBe("partial");
    });

    it("marks line as lunas when spent > 0 and remaining = 0", () => {
      const booking = {
        ...mockBooking,
        remaining: [BigInt(0), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
      };
      const result = deriveLines(booking, [bookedEvent, spentEvent]);
      expect(result[0].state).toBe("lunas");
    });
  });

  describe("margin released event handling", () => {
    const bookedEvent: LedgerRow = {
      kind: "Booked",
      blockNumber: BigInt(100),
      logIndex: 0,
      hash: "0xaabbccdd" as Hash,
      amount: BigInt(10000),
      lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
      counterparty: "0x2222222222222222222222222222222222222222" as Address,
    };

    const marginReleasedEvent: LedgerRow = {
      kind: "MarginReleased",
      blockNumber: BigInt(300),
      logIndex: 0,
      hash: "0xff00aabb" as Hash,
      amount: BigInt(200),
      line: 3,
      counterparty: "0x2222222222222222222222222222222222222222" as Address,
    };

    it("includes MarginReleased events in line 3 spent array", () => {
      const result = deriveLines(mockBooking, [bookedEvent, marginReleasedEvent]);
      expect(result[3].spent).toHaveLength(1);
      expect(result[3].spent[0].amount).toBe(BigInt(200));
    });
  });

  describe("refunded state calculation", () => {
    const bookedEvent: LedgerRow = {
      kind: "Booked",
      blockNumber: BigInt(100),
      logIndex: 0,
      hash: "0xaabbccdd" as Hash,
      amount: BigInt(10000),
      lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
      counterparty: "0x2222222222222222222222222222222222222222" as Address,
    };

    const spentEvent: LedgerRow = {
      kind: "Spent",
      blockNumber: BigInt(200),
      logIndex: 0,
      hash: "0xeeff0011" as Hash,
      amount: BigInt(300),
      line: 0,
      counterparty: "0x3333333333333333333333333333333333333333" as Address,
    };

    it("calculates refunded as original - spentSum when booking is refunded", () => {
      const booking = {
        ...mockBooking,
        refunded: true,
        remaining: [BigInt(700), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
      };
      const result = deriveLines(booking, [bookedEvent, spentEvent]);
      // original: 1000, spent: 300, refunded: 1000 - 300 = 700
      expect(result[0].refunded).toBe(BigInt(700));
    });

    it("does not set refunded when booking is not refunded", () => {
      const booking = {
        ...mockBooking,
        refunded: false,
        remaining: [BigInt(700), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
      };
      const result = deriveLines(booking, [bookedEvent, spentEvent]);
      expect(result[0].refunded).toBeUndefined();
    });

    it("marks line as returned when refunded > 0 and booking is refunded", () => {
      const booking = {
        ...mockBooking,
        refunded: true,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
      };
      const result = deriveLines(booking, [bookedEvent, spentEvent]);
      // refunded = 1000 - 300 = 700 > 0
      expect(result[0].state).toBe("returned");
    });

    it("marks line as lunas when refunded = 0 and booking is refunded", () => {
      const booking = {
        ...mockBooking,
        refunded: true,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
      };
      const spentFull: LedgerRow = { ...spentEvent, amount: BigInt(1000) };
      const result = deriveLines(booking, [bookedEvent, spentFull]);
      // refunded = 1000 - 1000 = 0
      expect(result[0].state).toBe("lunas");
    });
  });

  describe("special logic for line 0 (flightVendor)", () => {
    const bookedEvent: LedgerRow = {
      kind: "Booked",
      blockNumber: BigInt(100),
      logIndex: 0,
      hash: "0xaabbccdd" as Hash,
      amount: BigInt(10000),
      lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
      counterparty: "0x2222222222222222222222222222222222222222" as Address,
    };

    it("marks line 0 as lunas when flightVendor is not zero address and remaining = 0", () => {
      const booking = {
        ...mockBooking,
        flightVendor: "0x5555555555555555555555555555555555555555" as Address,
        remaining: [BigInt(0), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
        refunded: false,
      };
      const result = deriveLines(booking, [bookedEvent]);
      expect(result[0].state).toBe("lunas");
    });

    it("marks line 0 as earmarked when flightVendor is zero address and remaining > 0", () => {
      const booking = {
        ...mockBooking,
        flightVendor: "0x0000000000000000000000000000000000000000" as Address,
        remaining: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
        refunded: false,
      };
      const result = deriveLines(booking, [bookedEvent]);
      expect(result[0].state).toBe("earmarked");
    });

    it("marks line 0 as returned when flightVendor is zero and refunded with refunded > 0 and remaining = 0", () => {
      const booking = {
        ...mockBooking,
        flightVendor: "0x0000000000000000000000000000000000000000" as Address,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
        refunded: true,
      };
      const result = deriveLines(booking, [bookedEvent]);
      // original=1000, spentSum=0, refunded=1000 > 0, remaining=0
      expect(result[0].state).toBe("returned");
    });

    it("marks line 0 as earmarked when flightVendor is set but remaining > 0", () => {
      const booking = {
        ...mockBooking,
        flightVendor: "0x5555555555555555555555555555555555555555" as Address,
        remaining: [BigInt(100), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
        refunded: false,
      };
      const result = deriveLines(booking, [bookedEvent]);
      expect(result[0].state).toBe("earmarked");
    });
  });

  describe("special logic for line 3 (marginReleased)", () => {
    const bookedEvent: LedgerRow = {
      kind: "Booked",
      blockNumber: BigInt(100),
      logIndex: 0,
      hash: "0xaabbccdd" as Hash,
      amount: BigInt(10000),
      lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
      counterparty: "0x2222222222222222222222222222222222222222" as Address,
    };

    it("marks line 3 as lunas when marginReleased is true and remaining = 0", () => {
      const booking = {
        ...mockBooking,
        marginReleased: true,
        remaining: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(0)] as const,
        refunded: false,
      };
      const result = deriveLines(booking, [bookedEvent]);
      expect(result[3].state).toBe("lunas");
    });

    it("marks line 3 as earmarked when marginReleased is false and remaining > 0", () => {
      const booking = {
        ...mockBooking,
        marginReleased: false,
        remaining: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
        refunded: false,
      };
      const result = deriveLines(booking, [bookedEvent]);
      expect(result[3].state).toBe("earmarked");
    });

    it("marks line 3 as returned when marginReleased is false and refunded with refunded > 0 and remaining = 0", () => {
      const booking = {
        ...mockBooking,
        marginReleased: false,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
        refunded: true,
      };
      const result = deriveLines(booking, [bookedEvent]);
      // original=4000, spentSum=0, refunded=4000 > 0
      expect(result[3].state).toBe("returned");
    });

    it("marks line 3 as earmarked when marginReleased is true but remaining > 0", () => {
      const booking = {
        ...mockBooking,
        marginReleased: true,
        remaining: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(100)] as const,
        refunded: false,
      };
      const result = deriveLines(booking, [bookedEvent]);
      expect(result[3].state).toBe("earmarked");
    });
  });

  describe("all lines with original = 0", () => {
    const bookedEvent: LedgerRow = {
      kind: "Booked",
      blockNumber: BigInt(100),
      logIndex: 0,
      hash: "0xaabbccdd" as Hash,
      amount: BigInt(0),
      lines: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)],
      counterparty: "0x2222222222222222222222222222222222222222" as Address,
    };

    it("marks line as empty when original = 0", () => {
      const booking = {
        ...mockBooking,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
      };
      const result = deriveLines(booking, [bookedEvent]);
      result.forEach(line => {
        expect(line.state).toBe("empty");
      });
    });
  });

  describe("complex scenario: multiple events on one line", () => {
    it("handles multiple spent events on same line", () => {
      const bookedEvent: LedgerRow = {
        kind: "Booked",
        blockNumber: BigInt(100),
        logIndex: 0,
        hash: "0xaabbccdd" as Hash,
        amount: BigInt(10000),
        lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
        counterparty: "0x2222222222222222222222222222222222222222" as Address,
      };

      const spent1: LedgerRow = {
        kind: "Spent",
        blockNumber: BigInt(200),
        logIndex: 0,
        hash: "0xeeff0011" as Hash,
        amount: BigInt(300),
        line: 0,
        counterparty: "0x3333333333333333333333333333333333333333" as Address,
      };

      const spent2: LedgerRow = {
        kind: "Spent",
        blockNumber: BigInt(300),
        logIndex: 0,
        hash: "0xeeff0022" as Hash,
        amount: BigInt(200),
        line: 0,
        counterparty: "0x4444444444444444444444444444444444444444" as Address,
      };

      const booking = {
        ...mockBooking,
        remaining: [BigInt(500), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
      };

      const result = deriveLines(booking, [bookedEvent, spent1, spent2]);
      expect(result[0].spent).toHaveLength(2);
      expect(result[0].state).toBe("partial");
    });
  });

  describe("edge cases", () => {
    it("handles booking with zero in all lines", () => {
      const booking: Booking = {
        ...mockBooking,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
      };
      const result = deriveLines(booking);
      result.forEach(line => {
        expect(line.remaining).toBe(BigInt(0));
        expect(line.spent).toEqual([]);
      });
    });

    it("handles booking with very large amounts", () => {
      const booking: Booking = {
        ...mockBooking,
        remaining: [
          BigInt("999999999999999999999"),
          BigInt("888888888888888888888"),
          BigInt("777777777777777777777"),
          BigInt("666666666666666666666"),
        ] as const,
      };
      const result = deriveLines(booking);
      expect(result[0].remaining).toBe(BigInt("999999999999999999999"));
      expect(result[0].state).toBe("earmarked");
    });

    it("handles ledger with only MarginReleased events", () => {
      const marginEvent: LedgerRow = {
        kind: "MarginReleased",
        blockNumber: BigInt(200),
        logIndex: 0,
        hash: "0xff00aabb" as Hash,
        amount: BigInt(100),
        line: 3,
        counterparty: "0x2222222222222222222222222222222222222222" as Address,
      };

      const result = deriveLines(mockBooking, [marginEvent]);
      expect(result[3].spent).toHaveLength(1);
      expect(result[0].spent).toHaveLength(0);
    });

    it("handles refunded booking with no booked event", () => {
      const booking = { ...mockBooking, refunded: true };
      const result = deriveLines(booking, []);
      // Without booked event, original is undefined for all lines
      // When refunded=true and original=undefined, special logic applies
      // Check that it doesn't crash and handles undefined gracefully
      expect(result).toHaveLength(4);
      result.forEach(line => {
        expect(line.original).toBeUndefined();
      });
    });

    it("handles booking with refunded=true but no spent events", () => {
      const bookedEvent: LedgerRow = {
        kind: "Booked",
        blockNumber: BigInt(100),
        logIndex: 0,
        hash: "0xaabbccdd" as Hash,
        amount: BigInt(10000),
        lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
        counterparty: "0x2222222222222222222222222222222222222222" as Address,
      };

      const booking = {
        ...mockBooking,
        refunded: true,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
      };

      const result = deriveLines(booking, [bookedEvent]);
      // All lines should have refunded = original - 0 = original
      expect(result[0].refunded).toBe(BigInt(1000));
      expect(result[1].refunded).toBe(BigInt(2000));
      expect(result[2].refunded).toBe(BigInt(3000));
      expect(result[3].refunded).toBe(BigInt(4000));
    });
  });

  describe("state transitions", () => {
    it("correctly transitions from earmarked to partial", () => {
      const bookedEvent: LedgerRow = {
        kind: "Booked",
        blockNumber: BigInt(100),
        logIndex: 0,
        hash: "0xaabbccdd" as Hash,
        amount: BigInt(10000),
        lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
        counterparty: "0x2222222222222222222222222222222222222222" as Address,
      };

      // Start state: earmarked
      const booking1 = {
        ...mockBooking,
        remaining: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
      };
      const result1 = deriveLines(booking1, [bookedEvent]);
      expect(result1[0].state).toBe("earmarked");

      // After spending: partial
      const spent: LedgerRow = {
        kind: "Spent",
        blockNumber: BigInt(200),
        logIndex: 0,
        hash: "0xeeff0011" as Hash,
        amount: BigInt(500),
        line: 0,
        counterparty: "0x3333333333333333333333333333333333333333" as Address,
      };

      const booking2 = {
        ...mockBooking,
        remaining: [BigInt(500), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
      };
      const result2 = deriveLines(booking2, [bookedEvent, spent]);
      expect(result2[0].state).toBe("partial");

      // After full spending: lunas
      const booking3 = {
        ...mockBooking,
        remaining: [BigInt(0), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
      };
      const result3 = deriveLines(booking3, [bookedEvent, spent]);
      expect(result3[0].state).toBe("lunas");
    });
  });

  describe("interaction between flightVendor and marginReleased conditions", () => {
    const bookedEvent: LedgerRow = {
      kind: "Booked",
      blockNumber: BigInt(100),
      logIndex: 0,
      hash: "0xaabbccdd" as Hash,
      amount: BigInt(10000),
      lines: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(4000)],
      counterparty: "0x2222222222222222222222222222222222222222" as Address,
    };

    it("line 0: returned when flightVendor is set with remaining = 0 and refunded (refunded > 0)", () => {
      const booking = {
        ...mockBooking,
        flightVendor: "0x5555555555555555555555555555555555555555" as Address,
        remaining: [BigInt(0), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
        refunded: true,
      };
      const result = deriveLines(booking, [bookedEvent]);
      expect(result[0].state).toBe("returned");
    });

    it("line 3: returned when marginReleased is true with remaining = 0 and refunded (refunded > 0)", () => {
      const booking = {
        ...mockBooking,
        marginReleased: true,
        remaining: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(0)] as const,
        refunded: true,
      };
      const result = deriveLines(booking, [bookedEvent]);
      expect(result[3].state).toBe("returned");
    });

    it("line 0: lunas when flightVendor is set, no booking event, no refund", () => {
      const booking = {
        ...mockBooking,
        flightVendor: "0x5555555555555555555555555555555555555555" as Address,
        remaining: [BigInt(0), BigInt(2000), BigInt(3000), BigInt(4000)] as const,
        refunded: false,
      };
      const result = deriveLines(booking, []);
      expect(result[0].state).toBe("lunas");
    });

    it("line 3: lunas when marginReleased is true, no booking event, no refund", () => {
      const booking = {
        ...mockBooking,
        marginReleased: true,
        remaining: [BigInt(1000), BigInt(2000), BigInt(3000), BigInt(0)] as const,
        refunded: false,
      };
      const result = deriveLines(booking, []);
      expect(result[3].state).toBe("lunas");
    });
  });

  describe("refunded logic with undefined original", () => {
    it("determines state correctly when original is undefined and refunded=true for line 0", () => {
      const booking = {
        ...mockBooking,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
        refunded: true,
        flightVendor: "0x0000000000000000000000000000000000000000" as Address,
      };
      const result = deriveLines(booking, []);
      // original undefined, refunded true, flightVendor is zero
      // Should be returned if condition passes
      expect(result[0].state).toBe("returned");
    });

    it("determines state correctly when original is undefined and refunded=true for line 3", () => {
      const booking = {
        ...mockBooking,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
        refunded: true,
        marginReleased: false,
      };
      const result = deriveLines(booking, []);
      // original undefined, refunded true, marginReleased is false
      // Should be returned if condition passes
      expect(result[3].state).toBe("returned");
    });

    it("marks as lunas when original=0 even with complex conditions", () => {
      const bookedEvent: LedgerRow = {
        kind: "Booked",
        blockNumber: BigInt(100),
        logIndex: 0,
        hash: "0xaabbccdd" as Hash,
        amount: BigInt(0),
        lines: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)],
        counterparty: "0x2222222222222222222222222222222222222222" as Address,
      };

      const booking = {
        ...mockBooking,
        remaining: [BigInt(0), BigInt(0), BigInt(0), BigInt(0)] as const,
      };
      const result = deriveLines(booking, [bookedEvent]);
      result.forEach(line => {
        expect(line.state).toBe("empty");
      });
    });
  });
});
