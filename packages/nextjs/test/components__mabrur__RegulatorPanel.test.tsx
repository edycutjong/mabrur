import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegulatorPanel } from "~~/components/mabrur/RegulatorPanel";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock scaffold-eth hooks
vi.mock("~~/hooks/scaffold-eth", () => ({
  useScaffoldReadContract: vi.fn(),
}));

// Mock UI components
vi.mock("~~/components/mabrur/ui", () => ({
  AddressChip: ({ address, topic }: { address?: string; topic?: number }) => (
    <span data-testid="address-chip">
      AddressChip: {address || "none"} topic={topic}
    </span>
  ),
  Bi: ({ id, en }: { id: React.ReactNode; en?: React.ReactNode }) => (
    <span data-testid="bi-component">
      <span>{id}</span>
      {en && <span>{en}</span>}
    </span>
  ),
  Label: ({ children }: { children: React.ReactNode }) => <span data-testid="label">{children}</span>,
}));

// Mock utility functions
vi.mock("~~/utils/mabrur/format", () => ({
  formatRp: (value?: bigint) => {
    if (value === undefined) return "–";
    return `Rp ${value.toString()}`;
  },
  terbilang: (value?: bigint) => {
    if (value === undefined) return "";
    return `${value} (words)`;
  },
}));

// Import after mocking
const { useScaffoldReadContract } = require("~~/hooks/scaffold-eth");

describe("RegulatorPanel component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering structure and heading", () => {
    it("renders aside with aria-label", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      const { container } = render(<RegulatorPanel />);
      const aside = container.querySelector("aside");

      expect(aside).toBeInTheDocument();
      expect(aside).toHaveAttribute("aria-label", "Panel regulator");
      expect(aside).toHaveClass("mb-sheet", "flex", "flex-col", "gap-4");
    });

    it("renders panel title and description", () => {
      (useScaffoldReadContract as any).mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);
      expect(screen.getByText("Panel regulator · regulator view")).toBeInTheDocument();
      expect(screen.getByText("regulatorView")).toBeInTheDocument();
      expect(screen.getByText("conservation()")).toBeInTheDocument();
    });

    it("renders disclaimer text about reading from chain", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);
      expect(screen.getByText(/dibaca langsung dari kontrak · read live from chain/i)).toBeInTheDocument();
    });

    it("renders Agen section label", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);
      expect(screen.getByTestId("label")).toBeInTheDocument();
    });
  });

  describe("loading state - both hooks return undefined", () => {
    it("displays loading text when backed is undefined", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);
      expect(screen.getByText("Memuat…")).toBeInTheDocument();
    });

    it("displays dash for wrapped supply when undefined", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);
      const amounts = screen.getAllByText("–");
      expect(amounts.length).toBeGreaterThan(0);
    });
  });

  describe("conservation data loaded", () => {
    it("displays conservation data (wrapped supply, held amount) when loaded", () => {
      const wrappedSupply = BigInt(1000000);
      const underlyingHeld = BigInt(1500000);
      const sumEarmarks = BigInt(1000000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [sumEarmarks, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel />);

      expect(screen.getByText("Rp 1000000")).toBeInTheDocument();
      expect(screen.getByText("1000000 (words)")).toBeInTheDocument();
    });

    it("renders backed=true state with correct CSS class and Bi component", () => {
      const wrappedSupply = BigInt(1000000);
      const underlyingHeld = BigInt(1500000);
      const sumEarmarks = BigInt(1000000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [sumEarmarks, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      const { container } = render(<RegulatorPanel />);

      // Check for backed=true CSS class
      const backedDiv = container.querySelector(".mb-wash-after");
      expect(backedDiv).toBeInTheDocument();

      // Check for Bi component (only rendered when backed === true)
      const biComponent = screen.getByTestId("bi-component");
      expect(biComponent).toBeInTheDocument();
      expect(biComponent).toHaveTextContent(/100% dijamin rupiah di dalam kontrak/);
    });

    it("renders backed=false state with correct CSS class and not backed text", () => {
      const wrappedSupply = BigInt(1000000);
      const underlyingHeld = BigInt(500000); // Less than wrapped supply
      const sumEarmarks = BigInt(1000000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [sumEarmarks, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      const { container } = render(<RegulatorPanel />);

      // Check for backed=false CSS class
      const notBackedDiv = container.querySelector(".mb-wash-refused");
      expect(notBackedDiv).toBeInTheDocument();

      // Check for "not fully backed" text
      expect(screen.getByText(/Tidak seimbang · not fully backed/)).toBeInTheDocument();
    });

    it("calculates surplus correctly when underlyingHeld > wrappedSupply", () => {
      const wrappedSupply = BigInt(1000000);
      const underlyingHeld = BigInt(1500000);
      const sumEarmarks = BigInt(1000000);
      const expectedSurplus = BigInt(500000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [sumEarmarks, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel />);

      // Surplus is underlyingHeld - wrappedSupply = 1500000 - 1000000 = 500000
      expect(screen.getByText(`Rp ${expectedSurplus.toString()}`)).toBeInTheDocument();
    });

    it("displays zero surplus when underlyingHeld equals wrappedSupply", () => {
      const wrappedSupply = BigInt(1000000);
      const underlyingHeld = BigInt(1000000);
      const sumEarmarks = BigInt(1000000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [sumEarmarks, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel />);

      // Surplus should be 0
      expect(screen.getByText("Rp 0")).toBeInTheDocument();
    });

    it("renders all conservation data labels and values", () => {
      const wrappedSupply = BigInt(1000000);
      const underlyingHeld = BigInt(1500000);
      const sumEarmarks = BigInt(1000000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [sumEarmarks, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel />);

      expect(screen.getByText(/Rupiah di kontrak/)).toBeInTheDocument();
      expect(screen.getByText(/held in-contract/)).toBeInTheDocument();
      expect(screen.getByText(/mUMRAH beredar/)).toBeInTheDocument();
      expect(screen.getByText(/wrapped supply/)).toBeInTheDocument();
      expect(screen.getByText(/Σ pos tersimpan/)).toBeInTheDocument();
      expect(screen.getByText(/Σ earmarks/)).toBeInTheDocument();
      expect(screen.getByText(/Surplus/)).toBeInTheDocument();
      expect(screen.getByText(/direct donations/)).toBeInTheDocument();
    });
  });

  describe("agency not provided", () => {
    it("displays message to select booking or enter agent address when no agency", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel />);
      expect(screen.getByText("Pilih booking / isi alamat agen")).toBeInTheDocument();
    });

    it("does not render agent-specific details when agency is undefined", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel />);

      // Should not display agent-specific labels
      expect(screen.queryByText(/Booking terbuka/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Kewajiban ke jamaah/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Tersimpan per pos/)).not.toBeInTheDocument();
    });

    it("does not render AddressChip when agency is undefined", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel />);

      const chips = screen.queryAllByTestId("address-chip");
      expect(chips).toHaveLength(0);
    });

    it("does not render liabilities comparison when agency is undefined", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel />);

      expect(screen.queryByText(/Kewajiban \(setoran − pembayaran\) = Σ pos tersimpan/)).not.toBeInTheDocument();
    });
  });

  describe("agency provided - valid address", () => {
    const validAgency = "0x1234567890123456789012345678901234567890";

    it("calls useScaffoldReadContract with provided agency for regulatorView", () => {
      useScaffoldReadContract.mockImplementation(({ functionName, args }) => {
        if (functionName === "regulatorView") {
          expect(args[0]).toBe(validAgency as any);
          return { data: [BigInt(5), BigInt(2000), BigInt(1500)] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      expect(useScaffoldReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "regulatorView",
          args: [validAgency as any],
        }),
      );
    });

    it("renders agent-specific data when agency is provided and data loaded", () => {
      const openBookings = BigInt(5);
      const liabilities = BigInt(2000);
      const earmarked = BigInt(1500);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [openBookings, liabilities, earmarked] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText(/Booking terbuka/)).toBeInTheDocument();
      expect(screen.getByText(/open bookings/)).toBeInTheDocument();
      expect(screen.getByText(/Kewajiban ke jamaah/)).toBeInTheDocument();
      expect(screen.getByText(/liabilities/)).toBeInTheDocument();
      expect(screen.getByText(/Tersimpan per pos/)).toBeInTheDocument();
      expect(screen.getByText(/earmarked/)).toBeInTheDocument();
    });

    it("renders AddressChip with agency when provided", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [BigInt(5), BigInt(2000), BigInt(1500)] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      const chip = screen.getByTestId("address-chip");
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveTextContent(validAgency);
      expect(chip).toHaveTextContent("topic=1");
    });

    it("displays open bookings count with toString()", () => {
      const openBookings = BigInt(3);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [openBookings, BigInt(1000), BigInt(800)] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("displays dash when open bookings is undefined", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [undefined, BigInt(1000), BigInt(800)] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      expect(screen.getByText("–")).toBeInTheDocument();
    });
  });

  describe("liabilities vs earmarked comparison", () => {
    const validAgency = "0x1234567890123456789012345678901234567890";

    it("renders check mark (✓) when liabilities equals earmarked", () => {
      const liabilities = BigInt(2000);
      const earmarked = BigInt(2000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [BigInt(5), liabilities, earmarked] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      expect(screen.getByText(/✓ Kewajiban/)).toBeInTheDocument();
    });

    it("renders X mark (✗) when liabilities does not equal earmarked", () => {
      const liabilities = BigInt(2000);
      const earmarked = BigInt(1500);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [BigInt(5), liabilities, earmarked] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      expect(screen.getByText(/✗ Kewajiban/)).toBeInTheDocument();
    });

    it("does not render comparison when liabilities or earmarked is undefined", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [BigInt(5), undefined, undefined] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      expect(screen.queryByText(/Kewajiban \(setoran − pembayaran\)/)).not.toBeInTheDocument();
    });

    it("renders Indonesian and English labels for liabilities comparison", () => {
      const liabilities = BigInt(2000);
      const earmarked = BigInt(2000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [BigInt(5), liabilities, earmarked] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      expect(screen.getByText(/Kewajiban \(setoran − pembayaran\) = Σ pos tersimpan/)).toBeInTheDocument();
      expect(screen.getByText(/two independent ledgers agree/)).toBeInTheDocument();
    });
  });

  describe("invalid agency address", () => {
    it("treats non-address string as undefined", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel agency="not-an-address" />);

      expect(screen.getByText("Pilih booking / isi alamat agen")).toBeInTheDocument();
      expect(screen.queryByTestId("address-chip")).not.toBeInTheDocument();
    });

    it("treats empty string agency as undefined", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel agency="" />);

      expect(screen.getByText("Pilih booking / isi alamat agen")).toBeInTheDocument();
    });

    it("ignores agency when isAddress returns false", () => {
      const invalidAddress = "0xinvalid";

      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel agency={invalidAddress} />);

      // Should not pass invalid address to regulatorView
      const calls = useScaffoldReadContract.mock.calls;
      const regulatorViewCall = calls.find(call => call[0].functionName === "regulatorView");
      // Should be called with undefined, not the invalid address
      expect(regulatorViewCall[0].args[0]).toBeUndefined();
    });
  });

  describe("all hooks called correctly", () => {
    it("calls useScaffoldReadContract twice - once for regulatorView, once for conservation", () => {
      const validAgency = "0x1234567890123456789012345678901234567890";

      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel agency={validAgency} />);

      expect(useScaffoldReadContract).toHaveBeenCalledTimes(2);
    });

    it("calls conservation hook with correct parameters", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);

      expect(useScaffoldReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          contractName: "MabrurPBM",
          functionName: "conservation",
        }),
      );
    });

    it("calls regulatorView hook with contractName and functionName", () => {
      const validAgency = "0x1234567890123456789012345678901234567890";

      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel agency={validAgency} />);

      expect(useScaffoldReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          contractName: "MabrurPBM",
          functionName: "regulatorView",
        }),
      );
    });
  });

  describe("footer disclaimer text", () => {
    it("renders claim issuer disclaimer", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);

      expect(screen.getByText(/Penerbit klaim: kunci demo, pengganti Kemenag \/ IATA/)).toBeInTheDocument();
    });

    it("renders tIDR disclaimer", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);

      expect(screen.getByText(/tIDR = token uji tanpa nilai/)).toBeInTheDocument();
    });

    it("renders surplus explanation in Indonesian", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);

      expect(screen.getByText(/Surplus = tIDR yang dikirim langsung ke kontrak tanpa booking/)).toBeInTheDocument();
    });

    it("renders surplus explanation in English", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      render(<RegulatorPanel />);

      expect(screen.getByText(/Surplus is tIDR sent to the contract outside a booking/)).toBeInTheDocument();
    });
  });

  describe("integrated scenarios", () => {
    it("renders complete panel with all data loaded and valid agency", () => {
      const validAgency = "0x1234567890123456789012345678901234567890";
      const openBookings = BigInt(3);
      const liabilities = BigInt(2000);
      const earmarked = BigInt(2000);
      const sumEarmarks = BigInt(1000);
      const wrappedSupply = BigInt(1000);
      const underlyingHeld = BigInt(1500);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [openBookings, liabilities, earmarked] };
        }
        if (functionName === "conservation") {
          return { data: [sumEarmarks, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      // Check conservation data
      expect(screen.getByText(`Rp ${wrappedSupply}`)).toBeInTheDocument();
      expect(screen.getByText(/✓ Kewajiban/)).toBeInTheDocument();

      // Check regulator view data
      expect(screen.getByText("3")).toBeInTheDocument();

      // Check backed state (true because underlyingHeld >= wrappedSupply)
      const biComponent = screen.getByTestId("bi-component");
      expect(biComponent).toBeInTheDocument();
    });

    it("renders complete panel with not backed state", () => {
      const validAgency = "0x1234567890123456789012345678901234567890";
      const sumEarmarks = BigInt(1000);
      const wrappedSupply = BigInt(2000);
      const underlyingHeld = BigInt(1000); // Less than wrapped supply

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [BigInt(2), BigInt(500), BigInt(400)] };
        }
        if (functionName === "conservation") {
          return { data: [sumEarmarks, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      // Check not backed state
      expect(screen.getByText(/Tidak seimbang · not fully backed/)).toBeInTheDocument();
    });

    it("does not render agent details when regulatorView returns undefined data", () => {
      const validAgency = "0x1234567890123456789012345678901234567890";

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency={validAgency} />);

      // Even with valid agency, if regulatorView data is undefined, agent details should not show
      expect(screen.queryByText(/Booking terbuka/)).not.toBeInTheDocument();
    });
  });

  describe("semantic HTML and accessibility", () => {
    it("uses semantic dl/dt/dd for definition lists", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      const { container } = render(<RegulatorPanel />);

      const dlElements = container.querySelectorAll("dl");
      expect(dlElements.length).toBeGreaterThan(0);

      const dtElements = container.querySelectorAll("dt");
      expect(dtElements.length).toBeGreaterThan(0);

      const ddElements = container.querySelectorAll("dd");
      expect(ddElements.length).toBeGreaterThan(0);
    });

    it("has proper padding and spacing classes", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined });

      const { container } = render(<RegulatorPanel />);
      const aside = container.querySelector("aside");

      expect(aside).toHaveClass("gap-4");
    });

    it("uses whitespace-nowrap for right-aligned numbers", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [BigInt(100), BigInt(100), BigInt(150)] };
        }
        return { data: undefined };
      });

      const { container } = render(<RegulatorPanel />);

      const nowrapElements = container.querySelectorAll(".whitespace-nowrap");
      expect(nowrapElements.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases with numeric values", () => {
    it("handles zero values correctly", () => {
      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "regulatorView") {
          return { data: [BigInt(0), BigInt(0), BigInt(0)] };
        }
        if (functionName === "conservation") {
          return { data: [BigInt(0), BigInt(0), BigInt(0)] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel agency="0x1234567890123456789012345678901234567890" />);

      const zeroValues = screen.getAllByText("Rp 0");
      expect(zeroValues.length).toBeGreaterThan(0);
    });

    it("handles very large bigint values", () => {
      const largeValue = BigInt("99999999999999999999999999");

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [largeValue, largeValue, largeValue] };
        }
        return { data: undefined };
      });

      render(<RegulatorPanel />);

      expect(screen.getByText(`Rp ${largeValue}`)).toBeInTheDocument();
    });

    it("correctly identifies backed=true when underlyingHeld equals wrappedSupply exactly", () => {
      const value = BigInt(1000000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [value, value, value] };
        }
        return { data: undefined };
      });

      const { container } = render(<RegulatorPanel />);

      const backedDiv = container.querySelector(".mb-wash-after");
      expect(backedDiv).toBeInTheDocument();
      expect(screen.getByTestId("bi-component")).toBeInTheDocument();
    });

    it("correctly identifies backed=true when underlyingHeld > wrappedSupply", () => {
      const wrappedSupply = BigInt(1000);
      const underlyingHeld = BigInt(2000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [wrappedSupply, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      const { container } = render(<RegulatorPanel />);

      const backedDiv = container.querySelector(".mb-wash-after");
      expect(backedDiv).toBeInTheDocument();
    });

    it("correctly identifies backed=false when underlyingHeld < wrappedSupply", () => {
      const wrappedSupply = BigInt(2000);
      const underlyingHeld = BigInt(1000);

      useScaffoldReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "conservation") {
          return { data: [wrappedSupply, wrappedSupply, underlyingHeld] };
        }
        return { data: undefined };
      });

      const { container } = render(<RegulatorPanel />);

      const notBackedDiv = container.querySelector(".mb-wash-refused");
      expect(notBackedDiv).toBeInTheDocument();
      expect(screen.getByText(/Tidak seimbang · not fully backed/)).toBeInTheDocument();
    });
  });
});
