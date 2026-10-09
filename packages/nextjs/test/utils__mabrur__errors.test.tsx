import type { Abi, AbiError, Hex } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
// Import after all mocks are set up
import {
  type DecodedRevert,
  REVERT_REASONS,
  decodeRevert,
  errorArgParts,
  formatErrorCall,
} from "~~/utils/mabrur/errors";

// Setup mocks before importing the module
vi.mock("viem", () => ({
  BaseError: class BaseError extends Error {
    _shortMessage?: string;
    constructor(message: string) {
      super(message);
      this.name = "BaseError";
    }
    walk(fn: (err: Error) => Error | undefined): Error | undefined {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      let current: Error | undefined = this;
      while (current) {
        const result = fn(current);
        if (result) return result;
        current = (current as any).cause;
      }
      return undefined;
    }
    get shortMessage(): string | undefined {
      return this._shortMessage;
    }
    set shortMessage(value: string | undefined) {
      this._shortMessage = value;
    }
  },
  ContractFunctionRevertedError: class ContractFunctionRevertedError extends Error {
    data = {
      errorName: undefined as string | undefined,
      args: undefined as unknown[] | undefined,
      abiItem: undefined as AbiError | undefined,
    };
    raw: Hex | undefined;
    reason: string | undefined;
    constructor(message: string) {
      super(message);
      this.name = "ContractFunctionRevertedError";
    }
  },
  decodeErrorResult: vi.fn(),
}));

vi.mock("../contracts/deployedContracts", () => ({
  default: {
    31337: {
      TestContract: {
        abi: [
          {
            type: "error",
            name: "TestError",
            inputs: [{ name: "value", type: "uint256" }],
          } as AbiError,
          {
            type: "error",
            name: "DuplicateError",
            inputs: [{ name: "data", type: "bytes" }],
          } as AbiError,
          {
            type: "function",
            name: "someFunction",
            inputs: [],
            outputs: [],
            stateMutability: "nonpayable",
          },
        ] as Abi,
      },
      AnotherContract: {
        abi: [
          {
            type: "error",
            name: "DuplicateError",
            inputs: [{ name: "data", type: "bytes" }],
          } as AbiError,
        ] as Abi,
      },
    },
  },
}));

describe("utils/mabrur/errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("REVERT_REASONS", () => {
    it("exports REVERT_REASONS constant with known errors", () => {
      expect(REVERT_REASONS).toBeDefined();
      expect(REVERT_REASONS.EarmarkMismatch).toBeDefined();
      expect(REVERT_REASONS.EarmarkMismatch.en).toBe("Invoice is for another booking");
      expect(REVERT_REASONS.EarmarkMismatch.id).toContain("booking");
    });

    it("contains all expected error keys with bilingual descriptions", () => {
      const errorNames = Object.keys(REVERT_REASONS);
      expect(errorNames.length).toBeGreaterThan(0);
      expect(REVERT_REASONS.NotDeparted).toBeDefined();
      expect(typeof REVERT_REASONS.NotDeparted.id).toBe("string");
      expect(typeof REVERT_REASONS.NotDeparted.en).toBe("string");
    });
  });

  describe("findRawData (via decodeRevert)", () => {
    it("finds raw hex data directly in error object", () => {
      const testError = { data: "0x12345678" as Hex };
      const result = decodeRevert(testError);
      expect(result).toBeDefined();
    });

    it("finds raw hex data in nested data.data property", () => {
      const testError = { data: { data: "0x1234567890abcdef" as Hex } };
      const result = decodeRevert(testError);
      expect(result).toBeDefined();
    });

    it("traverses cause chain up to 10 levels", () => {
      const error: any = { message: "Test error" };
      let current = error;
      for (let i = 0; i < 5; i++) {
        current.cause = { data: undefined };
        current = current.cause;
      }
      current.data = "0x1234567890abcdefabcdef" as Hex;
      const result = decodeRevert(error);
      expect(result).toBeDefined();
    });

    it("stops after 10 levels and returns error message", () => {
      const error: any = { message: "Test error" };
      let current = error;
      for (let i = 0; i < 11; i++) {
        current.cause = { data: undefined };
        current = current.cause;
      }
      const result = decodeRevert(error);
      expect(result.name).toBe("Error");
    });

    it("ignores hex strings that are too short", () => {
      const testError = { data: "0x1234" };
      const result = decodeRevert(testError);
      expect(result).toBeDefined();
    });

    it("ignores non-hex strings", () => {
      const testError = { data: "not a hex string" };
      const result = decodeRevert(testError);
      expect(result).toBeDefined();
    });
  });

  describe("decodeRevert", () => {
    it("decodes error with known errorName and args", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "EarmarkMismatch";
      reverted.data.args = [BigInt(1), BigInt(2)];
      reverted.data.abiItem = {
        type: "error",
        name: "EarmarkMismatch",
        inputs: [
          { name: "expected", type: "bytes32" },
          { name: "actual", type: "bytes32" },
        ],
      } as AbiError;
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.name).toBe("EarmarkMismatch");
      expect(result.args).toEqual([BigInt(1), BigInt(2)]);
      expect(result.argNames).toEqual(["expected", "actual"]);
      expect(result.isRevert).toBe(true);
      expect(result.en).toBe("Invoice is for another booking");
    });

    it("uses shortMessage when not a BaseError", () => {
      const regularError = new Error("Connection refused");
      const result = decodeRevert(regularError);
      expect(result.name).toBe("Error");
      expect(result.en).toBe("Connection refused");
      expect(result.isRevert).toBe(false);
    });

    it("decodes raw hex data when errorName is missing", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.raw = "0x1234abcd" as Hex;
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.isRevert).toBe(true);
    });

    it("handles decodeErrorResult with null args", async () => {
      const { BaseError, ContractFunctionRevertedError, decodeErrorResult } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.raw = "0x08c379a00000000000000000000000000000000000000000000000000000000000000020" as Hex;
      error.walk = () => reverted;

      // Mock decodeErrorResult to return a result with null args
      const mockDecodeErrorResult = vi.mocked(decodeErrorResult);
      mockDecodeErrorResult.mockReturnValueOnce({
        errorName: "TestError",
        args: null,
        abiItem: {
          type: "error",
          name: "TestError",
          inputs: [{ name: "reason", type: "string" }],
        } as AbiError,
      });

      const result = decodeRevert(error);
      expect(result.name).toBe("TestError");
      expect(result.args).toEqual([]); // null args becomes []
      expect(result.argNames).toEqual(["reason"]);
      expect(result.isRevert).toBe(true);
    });

    it("handles Unknown error when decode throws", async () => {
      const { BaseError, ContractFunctionRevertedError, decodeErrorResult } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.raw = "0x1234abcd" as Hex;
      error.walk = () => reverted;

      // Ensure decodeErrorResult throws to trigger Unknown path
      const mockDecodeErrorResult = vi.mocked(decodeErrorResult);
      mockDecodeErrorResult.mockImplementation(() => {
        throw new Error("Failed to decode");
      });

      const result = decodeRevert(error);
      expect(result.name).toMatch(/Unknown\(/);
      expect(result.isRevert).toBe(true);
    });

    it("handles 'Error' errorName with reason string", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "Error";
      reverted.reason = "Insufficient balance";
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.name).toBe("Error");
      expect(result.args).toEqual(["Insufficient balance"]);
      expect(result.argNames).toEqual(["reason"]);
      expect(result.en).toBe("Insufficient balance");
      expect(result.isRevert).toBe(true);
    });

    it("handles 'Error' errorName when no raw data or reason available", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Generic error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      // When errorName is "Error" and no reason is set,
      // it falls through to message-based handling
      reverted.data.errorName = "Error";
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.name).toBe("Error");
      // Falls through to message-based handling
      expect(result.isRevert).toBe(false);
    });

    it("handles 'Error' errorName with undefined reason (uses ?? fallback)", async () => {
      const { BaseError, ContractFunctionRevertedError, decodeErrorResult } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.raw = "0x08c379a00000000000000000000000000000000000000000000000000000000000000020" as Hex;
      reverted.reason = undefined; // explicitly undefined to test ?? operator
      error.walk = () => reverted;

      // Mock decodeErrorResult to return "Error" with undefined reason
      const mockDecodeErrorResult = vi.mocked(decodeErrorResult);
      mockDecodeErrorResult.mockReturnValueOnce({
        errorName: "Error",
        args: [],
        abiItem: {
          type: "error",
          name: "Error",
          inputs: [],
        } as AbiError,
      });

      const result = decodeRevert(error);
      expect(result.name).toBe("Error");
      expect(result.args).toEqual([undefined]);
      expect(result.argNames).toEqual(["reason"]);
      expect(result.id).toBe("Ditolak"); // falls back via ??
      expect(result.en).toBe("Reverted"); // falls back via ??
      expect(result.isRevert).toBe(true);
    });

    it("returns known error when name matches REVERT_REASONS", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "NotDeparted";
      reverted.data.args = [];
      reverted.data.abiItem = {
        type: "error",
        name: "NotDeparted",
        inputs: [],
      } as AbiError;
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.name).toBe("NotDeparted");
      expect(result.en).toBe("Pilgrim has not departed — the fee is still locked");
      expect(result.id).toContain("Jamaah");
    });

    it("uses default message for unknown error name", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "UnknownCustomError";
      reverted.data.args = [];
      reverted.data.abiItem = {
        type: "error",
        name: "UnknownCustomError",
        inputs: [],
      } as AbiError;
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.name).toBe("UnknownCustomError");
      expect(result.en).toBe("Rejected by the contract");
      expect(result.id).toBe("Ditolak oleh kontrak");
    });

    it("detects user rejection from message keywords", () => {
      const error = new Error("User rejected the transaction");
      const result = decodeRevert(error);
      expect(result.name).toBe("UserRejected");
      expect(result.en).toBe("Rejected in the wallet");
      expect(result.id).toBe("Dibatalkan di dompet");
      expect(result.isRevert).toBe(false);
    });

    it("detects user rejection with 'denied' keyword", () => {
      const error = new Error("Access denied by user");
      const result = decodeRevert(error);
      expect(result.name).toBe("UserRejected");
      expect(result.en).toBe("Rejected in the wallet");
    });

    it("handles multi-line error messages by taking first line", async () => {
      const { BaseError } = await import("viem");
      const error = new BaseError("First line\nSecond line\nThird line");
      const result = decodeRevert(error);
      expect(result.en).toBe("First line");
    });

    it("uses BaseError shortMessage when available", async () => {
      const { BaseError } = await import("viem");
      const error = new BaseError("Generic message");
      error.shortMessage = "Short summary";
      const result = decodeRevert(error);
      expect(result.en).toBe("Short summary");
    });

    it("falls back to message property when shortMessage unavailable", () => {
      const error = new Error("Message from error object");
      const result = decodeRevert(error);
      expect(result.en).toBe("Message from error object");
    });

    it("uses 'Unknown error' when nothing is available", () => {
      const error = {};
      const result = decodeRevert(error);
      expect(result.en).toBe("Unknown error");
      expect(result.isRevert).toBe(false);
    });

    it("handles abiItem with no inputs", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "SimpleError";
      reverted.data.args = [];
      reverted.data.abiItem = {
        type: "error",
        name: "SimpleError",
        inputs: [],
      } as AbiError;
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.argNames).toEqual([]);
      expect(result.name).toBe("SimpleError");
    });

    it("handles abiItem with unnamed inputs", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "ErrorWithUnnamed";
      reverted.data.args = [BigInt(1), BigInt(2)];
      reverted.data.abiItem = {
        type: "error",
        name: "ErrorWithUnnamed",
        inputs: [{ type: "uint256" }, { name: "value", type: "uint256" }],
      } as AbiError;
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.argNames).toEqual(["", "value"]);
    });

    it("handles errorName with null args in reverted.data", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "SimpleError";
      reverted.data.args = null; // explicitly null
      reverted.data.abiItem = {
        type: "error",
        name: "SimpleError",
        inputs: [{ name: "code", type: "uint256" }],
      } as AbiError;
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.name).toBe("SimpleError");
      expect(result.args).toEqual([]); // falls back to []
      expect(result.argNames).toEqual(["code"]);
    });

    it("handles errorName without abiItem (undefined inputs)", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "NoAbiItemError";
      reverted.data.args = [BigInt(1)];
      reverted.data.abiItem = undefined; // no abiItem
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.name).toBe("NoAbiItemError");
      expect(result.args).toEqual([BigInt(1)]);
      expect(result.argNames).toEqual([]); // empty array from ?? []
    });

    it("extracts argNames from abiItem for known errors", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "EarmarkMismatch";
      reverted.data.args = [BigInt(1), BigInt(2)];
      reverted.data.abiItem = {
        type: "error",
        name: "EarmarkMismatch",
        inputs: [
          { name: "expectedEarmark", type: "bytes32" },
          { name: "actualEarmark", type: "bytes32" },
        ],
      } as AbiError;
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.argNames).toEqual(["expectedEarmark", "actualEarmark"]);
      expect(result.argNames.length).toBe(2);
    });

    it("handles error with multiple arguments from REVERT_REASONS", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Complex error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "ERC20InsufficientBalance";
      reverted.data.args = [BigInt(100), BigInt(50)];
      reverted.data.abiItem = {
        type: "error",
        name: "ERC20InsufficientBalance",
        inputs: [
          { name: "sender", type: "address" },
          { name: "balance", type: "uint256" },
          { name: "needed", type: "uint256" },
        ],
      } as AbiError;
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.name).toBe("ERC20InsufficientBalance");
      expect(result.args).toEqual([BigInt(100), BigInt(50)]);
      expect(result.argNames).toEqual(["sender", "balance", "needed"]);
      expect(result.en).toBe("Not enough tIDR — use the test faucet first");
      expect(result.isRevert).toBe(true);
    });

    it("handles condition !name && reverted?.reason (only reason available)", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      // No errorName, no raw data, but has reason
      reverted.data.errorName = undefined;
      reverted.reason = "Custom revert reason";
      error.walk = () => reverted;

      const result = decodeRevert(error);
      expect(result.name).toBe("Error");
      expect(result.args).toEqual(["Custom revert reason"]);
      expect(result.argNames).toEqual(["reason"]);
      expect(result.en).toBe("Custom revert reason");
      expect(result.id).toBe("Custom revert reason");
      expect(result.isRevert).toBe(true);
    });

    it("decodes error from raw data with full abiItem inputs", async () => {
      const { BaseError, ContractFunctionRevertedError, decodeErrorResult } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.raw = "0x08c379a00000000000000000000000000000000000000000000000000000000000000020" as Hex;
      error.walk = () => reverted;

      // Mock decodeErrorResult to return decoded error with full inputs
      const mockDecodeErrorResult = vi.mocked(decodeErrorResult);
      mockDecodeErrorResult.mockReturnValueOnce({
        errorName: "ComplexError",
        args: [BigInt(1), "0x1234"],
        abiItem: {
          type: "error",
          name: "ComplexError",
          inputs: [
            { name: "id", type: "uint256" },
            { name: "data", type: "bytes" },
          ],
        } as AbiError,
      });

      const result = decodeRevert(error);
      expect(result.name).toBe("ComplexError");
      expect(result.args).toEqual([BigInt(1), "0x1234"]);
      expect(result.argNames).toEqual(["id", "data"]);
      expect(result.isRevert).toBe(true);
    });

    it("decodes error with unnamed/missing input names", async () => {
      const { BaseError, ContractFunctionRevertedError, decodeErrorResult } = await import("viem");
      const error = new BaseError("Test error");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.raw = "0xabcdef0123456789" as Hex;
      error.walk = () => reverted;

      // Mock decodeErrorResult with inputs that have undefined names
      const mockDecodeErrorResult = vi.mocked(decodeErrorResult);
      mockDecodeErrorResult.mockReturnValueOnce({
        errorName: "ErrorWithNoNames",
        args: [BigInt(100)],
        abiItem: {
          type: "error",
          name: "ErrorWithNoNames",
          inputs: [
            { type: "uint256" }, // no name property
            { name: undefined as any, type: "bytes32" }, // undefined name
          ],
        } as AbiError,
      });

      const result = decodeRevert(error);
      expect(result.name).toBe("ErrorWithNoNames");
      expect(result.argNames).toEqual(["", ""]); // both should use ?? "" fallback
      expect(result.isRevert).toBe(true);
    });
  });

  describe("errorArgParts", () => {
    it("formats large bigint as shortened hex", () => {
      const decoded: DecodedRevert = {
        name: "TestError",
        args: [BigInt("1234567890123456")],
        argNames: ["value"],
        id: "Test",
        en: "Test error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(1);
      expect(parts[0].short).toMatch(/^0x.+….{4}$/);
      expect(parts[0].full).toMatch(/^0x[0-9a-f]+$/);
      expect(parts[0].full.length).toBeGreaterThan(parts[0].short.length);
    });

    it("formats small bigint as decimal string", () => {
      const decoded: DecodedRevert = {
        name: "TestError",
        args: [BigInt(12345)],
        argNames: ["value"],
        id: "Test",
        en: "Test error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(1);
      expect(parts[0].short).toBe("12345");
      expect(parts[0].full).toBe("12345");
    });

    it("formats long hex string as shortened", () => {
      const longHex = "0x1234567890abcdefabcdefabcdef";
      const decoded: DecodedRevert = {
        name: "TestError",
        args: [longHex],
        argNames: ["data"],
        id: "Test",
        en: "Test error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(1);
      expect(parts[0].short).toMatch(/^0x.+….{4}$/);
      expect(parts[0].full).toBe(longHex);
    });

    it("leaves short hex string unchanged", () => {
      const shortHex = "0x1234";
      const decoded: DecodedRevert = {
        name: "TestError",
        args: [shortHex],
        argNames: ["data"],
        id: "Test",
        en: "Test error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(1);
      expect(parts[0].short).toBe(shortHex);
      expect(parts[0].full).toBe(shortHex);
    });

    it("converts number to string", () => {
      const decoded: DecodedRevert = {
        name: "TestError",
        args: [42],
        argNames: ["count"],
        id: "Test",
        en: "Test error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(1);
      expect(parts[0].short).toBe("42");
    });

    it("handles boolean arguments", () => {
      const decoded: DecodedRevert = {
        name: "TestError",
        args: [true, false],
        argNames: ["flag1", "flag2"],
        id: "Test",
        en: "Test error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(2);
      expect(parts[0].short).toBe("true");
      expect(parts[1].short).toBe("false");
    });

    it("handles mixed argument types", () => {
      const decoded: DecodedRevert = {
        name: "ComplexError",
        args: [BigInt(100), "0xabcdefabcdefabcdefabcdef", BigInt("9999999999999999"), 42],
        argNames: ["id", "address", "bigValue", "count"],
        id: "Test",
        en: "Complex error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(4);
      expect(parts[0].short).toBe("100");
      expect(parts[1].short).toMatch(/^0x.+…/);
      expect(parts[2].short).toMatch(/^0x.+…/);
      expect(parts[3].short).toBe("42");
    });

    it("handles empty args array", () => {
      const decoded: DecodedRevert = {
        name: "SimpleError",
        args: [],
        argNames: [],
        id: "Test",
        en: "Simple error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(0);
    });

    it("handles address-like hex strings", () => {
      const address = "0x1234567890123456789012345678901234567890";
      const decoded: DecodedRevert = {
        name: "AddressError",
        args: [address],
        argNames: ["addr"],
        id: "Test",
        en: "Address error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts[0].short).toMatch(/^0x.+…[0-9a-f]{4}$/);
      expect(parts[0].full).toBe(address);
    });

    it("handles null/undefined by converting to string", () => {
      const decoded: DecodedRevert = {
        name: "TestError",
        args: [null, undefined],
        argNames: ["nullVal", "undefinedVal"],
        id: "Test",
        en: "Test error",
        isRevert: true,
      };
      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(2);
      expect(parts[0].short).toBe("null");
      expect(parts[1].short).toBe("undefined");
    });

    it("correctly identifies 10^15 boundary", () => {
      const threshold = 10n ** 15n;
      const justBelow = threshold - 1n;
      const justAbove = threshold + 1n;

      const partsBelow = errorArgParts({
        name: "Test",
        args: [justBelow],
        argNames: ["val"],
        id: "Test",
        en: "Test",
        isRevert: true,
      });

      const partsAbove = errorArgParts({
        name: "Test",
        args: [justAbove],
        argNames: ["val"],
        id: "Test",
        en: "Test",
        isRevert: true,
      });

      expect(partsBelow[0].short).toBe(justBelow.toString());
      expect(partsAbove[0].short).toMatch(/^0x.+…/);
    });
  });

  describe("formatErrorCall", () => {
    it("formats error name with no arguments", () => {
      const decoded: DecodedRevert = {
        name: "SimpleError",
        args: [],
        argNames: [],
        id: "Test",
        en: "Simple error",
        isRevert: true,
      };
      expect(formatErrorCall(decoded)).toBe("SimpleError()");
    });

    it("formats error name with single argument", () => {
      const decoded: DecodedRevert = {
        name: "TestError",
        args: [42],
        argNames: ["value"],
        id: "Test",
        en: "Test",
        isRevert: true,
      };
      expect(formatErrorCall(decoded)).toBe("TestError(42)");
    });

    it("formats error name with multiple arguments", () => {
      const decoded: DecodedRevert = {
        name: "MultiArgError",
        args: [BigInt(100), "0xabcdefabcdefabcdefabcdef"],
        argNames: ["id", "address"],
        id: "Test",
        en: "Test",
        isRevert: true,
      };
      const result = formatErrorCall(decoded);
      expect(result).toMatch(/^MultiArgError\(/);
      expect(result).toMatch(/100/);
      expect(result).toMatch(/0x.+…/);
      expect(result).toContain(", ");
    });

    it("uses shortened hex representation", () => {
      const longHex = "0x1234567890abcdefabcdefabcdefabcdefabcdef";
      const decoded: DecodedRevert = {
        name: "AddressError",
        args: [longHex],
        argNames: ["addr"],
        id: "Test",
        en: "Test",
        isRevert: true,
      };
      const result = formatErrorCall(decoded);
      expect(result).toContain("0x1234…");
      expect(result).toContain("cdef)");
      expect(result).not.toContain(longHex);
    });

    it("properly joins multiple arguments with commas", () => {
      const decoded: DecodedRevert = {
        name: "ComplexError",
        args: [1, 2, 3, 4, 5],
        argNames: ["a", "b", "c", "d", "e"],
        id: "Test",
        en: "Test",
        isRevert: true,
      };
      expect(formatErrorCall(decoded)).toBe("ComplexError(1, 2, 3, 4, 5)");
    });

    it("handles large bigint values", () => {
      const decoded: DecodedRevert = {
        name: "BigIntError",
        args: [BigInt("999999999999999999")],
        argNames: ["amount"],
        id: "Test",
        en: "Test",
        isRevert: true,
      };
      const result = formatErrorCall(decoded);
      expect(result).toMatch(/^BigIntError\(0x[0-9a-f]+…[0-9a-f]{4}\)/);
    });
  });

  describe("integration tests", () => {
    it("full workflow: error with known reason and arguments", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Contract reverted");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "LineExceeded";
      reverted.data.args = [BigInt(100), BigInt(50)];
      reverted.data.abiItem = {
        type: "error",
        name: "LineExceeded",
        inputs: [
          { name: "requested", type: "uint256" },
          { name: "available", type: "uint256" },
        ],
      } as AbiError;
      error.walk = () => reverted;

      const decoded = decodeRevert(error);
      expect(decoded.name).toBe("LineExceeded");
      expect(decoded.en).toBe("Exceeds what is left on this line");

      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(2);

      const formatted = formatErrorCall(decoded);
      expect(formatted).toBe("LineExceeded(100, 50)");
    });

    it("full workflow: user rejected wallet prompt", () => {
      const error = new Error("User rejected the request");
      const decoded = decodeRevert(error);
      expect(decoded.name).toBe("UserRejected");
      expect(decoded.isRevert).toBe(false);

      const parts = errorArgParts(decoded);
      expect(parts).toHaveLength(0);

      const formatted = formatErrorCall(decoded);
      expect(formatted).toBe("UserRejected()");
    });

    it("full workflow: Error type with reason string", async () => {
      const { BaseError, ContractFunctionRevertedError } = await import("viem");
      const error = new BaseError("Test");
      const reverted = new ContractFunctionRevertedError("Reverted");
      reverted.data.errorName = "Error";
      reverted.reason = "Insufficient funds";
      error.walk = () => reverted;

      const decoded = decodeRevert(error);
      expect(decoded.name).toBe("Error");
      expect(decoded.args[0]).toBe("Insufficient funds");
      expect(decoded.en).toBe("Insufficient funds");
      expect(decoded.isRevert).toBe(true);

      const formatted = formatErrorCall(decoded);
      expect(formatted).toMatch(/^Error\(Insufficient funds\)/);
    });
  });
});
