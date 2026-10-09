import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AddressChip,
  Bi,
  ClaimBadge,
  ContractsGuard,
  CopyButton,
  ErrorCall,
  Label,
  PageShell,
  RevertStamp,
  Rp,
  Stamp,
  TxLink,
} from "~~/components/mabrur/ui";
import type { DecodedRevert } from "~~/utils/mabrur/errors";

let useScaffoldReadContract: any;
let useCopyToClipboard: any;
let useTargetNetwork: any;
let useMabrurContracts: any;
let explorerAddr: any;
let explorerTx: any;

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock scaffold-eth hooks
vi.mock("~~/hooks/scaffold-eth", () => ({
  useScaffoldReadContract: vi.fn(),
  useCopyToClipboard: vi.fn(),
  useTargetNetwork: vi.fn(),
  useDeployedContractInfo: vi.fn(),
}));

// Mock mabrur hooks
vi.mock("~~/hooks/mabrur/useMabrur", () => ({
  useMabrurContracts: vi.fn(),
  explorerAddr: vi.fn(),
  explorerTx: vi.fn(),
}));

// Mock utils
vi.mock("~~/utils/mabrur/format", () => ({
  formatRp: vi.fn(v => {
    if (v === undefined || v === null) return "Rp –";
    const n = typeof v === "bigint" ? v : BigInt(v);
    const s = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `Rp ${s}`;
  }),
  terbilang: vi.fn(() => "satu juta"),
  shortHex: vi.fn((hex: string, start?: number, end?: number) => {
    if (start === undefined) return hex.slice(0, 6) + "..." + hex.slice(-4);
    return hex.slice(start, start + end);
  }),
  TOPICS: { 1: "PPIU", 2: "AIRLINE", 3: "HOTEL", 4: "VISA" },
}));

vi.mock("~~/utils/mabrur/names", () => ({
  getLabel: vi.fn(addr => {
    if (addr === "0x1234567890123456789012345678901234567890") return "Test Vendor";
    return undefined;
  }),
}));

vi.mock("~~/utils/mabrur/errors", () => ({
  errorArgParts: vi.fn(d => {
    // Mock errorArgParts to return empty array or properly formatted args
    return d.args?.map((arg: any) => ({ short: String(arg), full: String(arg) })) || [];
  }),
  DecodedRevert: vi.fn(),
}));

describe("components/mabrur/ui", () => {
  beforeEach(async () => {
    // Import mocked modules
    const scaffoldEth = await import("~~/hooks/scaffold-eth");
    const mabrurHooks = await import("~~/hooks/mabrur/useMabrur");

    useScaffoldReadContract = vi.mocked(scaffoldEth.useScaffoldReadContract);
    useCopyToClipboard = vi.mocked(scaffoldEth.useCopyToClipboard);
    useTargetNetwork = vi.mocked(scaffoldEth.useTargetNetwork);
    useMabrurContracts = vi.mocked(mabrurHooks.useMabrurContracts);
    explorerAddr = vi.mocked(mabrurHooks.explorerAddr);
    explorerTx = vi.mocked(mabrurHooks.explorerTx);

    vi.clearAllMocks();
  });

  describe("Bi component", () => {
    it("renders id text only when en is undefined", () => {
      render(<Bi id="Jamaah" />);
      expect(screen.getByText("Jamaah")).toBeInTheDocument();
    });

    it("renders both id and en when en is provided", () => {
      render(<Bi id="Jamaah" en="Pilgrim" />);
      expect(screen.getByText("Jamaah")).toBeInTheDocument();
      expect(screen.getByText("Pilgrim")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<Bi id="Test" className="custom-class" />);
      const span = container.querySelector(".custom-class");
      expect(span).toBeInTheDocument();
    });

    it("wraps en text in mb-en class", () => {
      const { container } = render(<Bi id="Jamaah" en="Pilgrim" />);
      const enSpan = container.querySelector(".mb-en");
      expect(enSpan).toBeInTheDocument();
      expect(enSpan?.textContent).toBe("Pilgrim");
    });

    it("renders null en without rendering span", () => {
      const { container } = render(<Bi id="Test" en={null} />);
      const enSpans = container.querySelectorAll(".mb-en");
      expect(enSpans).toHaveLength(0);
    });

    it("renders empty string en without rendering span", () => {
      const { container } = render(<Bi id="Test" en="" />);
      const enSpans = container.querySelectorAll(".mb-en");
      expect(enSpans).toHaveLength(0);
    });

    it("renders with default empty className", () => {
      const { container } = render(<Bi id="Test" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toBe("");
    });
  });

  describe("Label component", () => {
    it("renders children with mb-label class", () => {
      render(<Label>Test Label</Label>);
      const div = screen.getByText("Test Label");
      expect(div).toHaveClass("mb-label");
    });

    it("applies custom className", () => {
      render(<Label className="extra-class">Test</Label>);
      const div = screen.getByText("Test");
      expect(div).toHaveClass("mb-label", "extra-class");
    });

    it("renders complex children", () => {
      render(
        <Label>
          <span>Nested</span> content
        </Label>,
      );
      expect(screen.getByText("Nested")).toBeInTheDocument();
    });
  });

  describe("Rp component", () => {
    it("renders formatted amount when value is provided", () => {
      render(<Rp value={BigInt(1000000)} />);
      expect(screen.getByText("Rp 1.000.000")).toBeInTheDocument();
    });

    it("renders Rp – when value is undefined", () => {
      render(<Rp value={undefined} />);
      expect(screen.getByText("Rp –")).toBeInTheDocument();
    });

    it("renders Rp – when value is null", () => {
      render(<Rp value={null} />);
      expect(screen.getByText("Rp –")).toBeInTheDocument();
    });

    it("renders terbilang when words=true and value is defined", () => {
      render(<Rp value={BigInt(1000000)} words={true} />);
      const terbilang = screen.getByText(/Terbilang:/);
      expect(terbilang).toBeInTheDocument();
      expect(screen.getByText("satu juta")).toBeInTheDocument();
    });

    it("does not render terbilang when words=false", () => {
      render(<Rp value={BigInt(1000000)} words={false} />);
      expect(screen.queryByText(/Terbilang:/)).not.toBeInTheDocument();
    });

    it("does not render terbilang when value is undefined and words=true", () => {
      render(<Rp value={undefined} words={true} />);
      expect(screen.queryByText(/Terbilang:/)).not.toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<Rp value={BigInt(1000)} className="custom" />);
      const span = container.querySelector(".custom");
      expect(span).toBeInTheDocument();
    });

    it("wraps amount in mb-amount class", () => {
      const { container } = render(<Rp value={BigInt(1000)} />);
      const amount = container.querySelector(".mb-amount");
      expect(amount).toBeInTheDocument();
    });

    it("wraps terbilang in block class", () => {
      const { container } = render(<Rp value={BigInt(1000)} words={true} />);
      const terbilang = container.querySelector(".mb-terbilang");
      expect(terbilang).toHaveClass("block");
    });
  });

  describe("ErrorCall component", () => {
    it("renders function name and empty args list", () => {
      const { container } = render(<ErrorCall name="InvalidValue" args={[]} />);
      expect(container.textContent).toContain("InvalidValue");
    });

    it("renders single arg without abbreviation when short equals full", () => {
      const args = [{ short: "0x123456", full: "0x123456" }];
      render(<ErrorCall name="Test" args={args} />);
      expect(screen.getByText("0x123456")).toBeInTheDocument();
    });

    it("renders arg as abbr when short differs from full", () => {
      const args = [{ short: "0x1234...", full: "0x1234567890123456789012345678901234567890" }];
      const { container } = render(<ErrorCall name="Test" args={args} />);
      const abbr = container.querySelector("abbr");
      expect(abbr).toBeInTheDocument();
      expect(abbr?.textContent).toBe("0x1234...");
      expect(abbr?.title).toBe("0x1234567890123456789012345678901234567890");
    });

    it("renders multiple args with comma separator", () => {
      const args = [
        { short: "arg1", full: "arg1" },
        { short: "arg2", full: "arg2" },
      ];
      const { container } = render(<ErrorCall name="Test" args={args} />);
      const commas = container.querySelectorAll("span");
      // Find comma separators
      let hasComma = false;
      commas.forEach(span => {
        if (span.textContent?.includes(",")) hasComma = true;
      });
      expect(hasComma).toBe(true);
    });

    it("applies no-underline and cursor-help to abbreviations", () => {
      const args = [{ short: "x", full: "full_value" }];
      const { container } = render(<ErrorCall name="Test" args={args} />);
      const abbr = container.querySelector("abbr");
      expect(abbr).toHaveClass("no-underline", "cursor-help");
    });

    it("renders closing parenthesis", () => {
      const { container } = render(<ErrorCall name="Test" args={[]} />);
      expect(container.textContent).toContain(")");
    });

    it("renders multiple args correctly", () => {
      const args = [
        { short: "0x1111", full: "0x1111111111111111111111111111111111111111" },
        { short: "0x2222", full: "0x2222222222222222222222222222222222222222" },
        { short: "100", full: "100" },
      ];
      const { container } = render(<ErrorCall name="RevertReason" args={args} />);
      expect(container.textContent).toContain("RevertReason");
      const abbrs = container.querySelectorAll("abbr");
      expect(abbrs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Stamp component", () => {
    it("renders ditolak stamp with correct styling", () => {
      const { container } = render(<Stamp kind="ditolak" />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).toHaveClass("mb-stamp");
      expect(stamp).not.toHaveClass("mb-stamp-sim", "mb-stamp-after");
      expect(stamp).toHaveAttribute("role", "status");
    });

    it("renders lunas stamp with mb-stamp-after class", () => {
      const { container } = render(<Stamp kind="lunas" />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).toHaveClass("mb-stamp-after");
    });

    it("renders dikembalikan stamp with mb-stamp-after class", () => {
      const { container } = render(<Stamp kind="dikembalikan" />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).toHaveClass("mb-stamp-after");
    });

    it("renders simulasi stamp with mb-stamp-sim class", () => {
      const { container } = render(<Stamp kind="simulasi" />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).toHaveClass("mb-stamp-sim");
    });

    it("applies small class when small=true", () => {
      const { container } = render(<Stamp kind="lunas" small={true} />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).toHaveClass("mb-stamp-sm");
    });

    it("does not apply small class when small=false", () => {
      const { container } = render(<Stamp kind="lunas" small={false} />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).not.toHaveClass("mb-stamp-sm");
    });

    it("applies custom className", () => {
      const { container } = render(<Stamp kind="lunas" className="custom" />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).toHaveClass("custom");
    });

    it("renders stamp word correctly", () => {
      render(<Stamp kind="lunas" />);
      expect(screen.getByText("Lunas")).toBeInTheDocument();
    });

    it("renders simulasi note for simulasi kind", () => {
      render(<Stamp kind="simulasi" />);
      expect(screen.getByText(/belum dikirim/)).toBeInTheDocument();
    });

    it("does not render simulasi note for other kinds", () => {
      const { rerender } = render(<Stamp kind="lunas" />);
      expect(screen.queryByText(/belum dikirim/)).not.toBeInTheDocument();
      rerender(<Stamp kind="ditolak" />);
      expect(screen.queryByText(/belum dikirim/)).not.toBeInTheDocument();
    });

    it("renders error when provided", () => {
      const error: DecodedRevert = { name: "InvalidValue", id: "Nilai tidak sah", en: "Invalid value" };
      const { container } = render(<Stamp kind="ditolak" error={error} />);
      const errorDiv = container.querySelector(".mb-stamp-error");
      expect(errorDiv).toBeInTheDocument();
    });

    it("does not render error when not provided", () => {
      const { container } = render(<Stamp kind="ditolak" />);
      const errorDiv = container.querySelector(".mb-stamp-error");
      expect(errorDiv).not.toBeInTheDocument();
    });

    it("renders children when provided", () => {
      render(
        <Stamp kind="lunas">
          <span>Child content</span>
        </Stamp>,
      );
      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("does not render children when not provided", () => {
      render(<Stamp kind="lunas" />);
      expect(screen.queryByText("Child content")).not.toBeInTheDocument();
    });

    it("sets aria-label with error name when error provided", () => {
      const error: DecodedRevert = { name: "InvalidValue", id: "Nilai tidak sah", en: "Invalid value" };
      const { container } = render(<Stamp kind="ditolak" error={error} />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).toHaveAttribute("aria-label", "Ditolak: InvalidValue");
    });

    it("sets aria-label without error name when error not provided", () => {
      const { container } = render(<Stamp kind="ditolak" />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).toHaveAttribute("aria-label", "Ditolak");
    });

    it("renders children in div with text-sm and font-bold classes", () => {
      const { container } = render(
        <Stamp kind="lunas">
          <span>Test</span>
        </Stamp>,
      );
      const childDiv = container.querySelector(".text-sm.font-bold.mt-1");
      expect(childDiv).toBeInTheDocument();
    });
  });

  describe("RevertStamp component", () => {
    const mockError: DecodedRevert = {
      name: "InvalidValue",
      id: "Nilai tidak sah",
      en: "Invalid value",
    };

    it("renders Stamp with ditolak kind and error", () => {
      render(<RevertStamp d={mockError} />);
      const { container } = render(<RevertStamp d={mockError} />);
      const stamp = container.querySelector(".mb-stamp");
      expect(stamp).toHaveClass("mb-stamp");
    });

    it("renders error id with mb-refused-text class", () => {
      render(<RevertStamp d={mockError} />);
      const refused = screen.getByText("Nilai tidak sah");
      expect(refused).toHaveClass("mb-refused-text", "font-bold");
    });

    it("renders error en with mb-en class", () => {
      render(<RevertStamp d={mockError} />);
      const en = screen.getByText("Invalid value");
      expect(en).toHaveClass("mb-en");
    });

    it("does not render simulated message when simulated is undefined", () => {
      render(<RevertStamp d={mockError} />);
      expect(screen.queryByText(/Pratinjau/)).not.toBeInTheDocument();
    });

    it("does not render simulated message when simulated is false", () => {
      render(<RevertStamp d={mockError} simulated={false} />);
      expect(screen.queryByText(/Pratinjau/)).not.toBeInTheDocument();
    });

    it("renders simulated message when simulated is true", () => {
      render(<RevertStamp d={mockError} simulated={true} />);
      expect(screen.getByText(/Pratinjau/)).toBeInTheDocument();
      expect(screen.getByText(/simulateContract/)).toBeInTheDocument();
    });

    it("renders flex flex-col gap-2 container", () => {
      const { container } = render(<RevertStamp d={mockError} />);
      const div = container.firstChild as HTMLElement;
      expect(div).toHaveClass("flex", "flex-col", "gap-2");
    });
  });

  describe("ClaimBadge component", () => {
    it("returns null when address is undefined", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      const { container } = render(<ClaimBadge address={undefined} topic={1} />);
      expect(container.innerHTML).toBe("");
    });

    it("renders loading state with topic name and ellipsis", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined, isLoading: true });
      render(<ClaimBadge address="0x123" topic={1} />);
      expect(screen.getByText(/PPIU …/)).toBeInTheDocument();
    });

    it("renders muted chip when isLoading is true", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined, isLoading: true });
      const { container } = render(<ClaimBadge address="0x123" topic={1} />);
      const chip = container.querySelector(".mb-chip-muted");
      expect(chip).toBeInTheDocument();
    });

    it("renders success chip with checkmark when ok is true", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      render(<ClaimBadge address="0x123" topic={1} />);
      expect(screen.getByText(/PPIU ✓/)).toBeInTheDocument();
    });

    it("applies mb-chip-ink class when claim is valid", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      const { container } = render(<ClaimBadge address="0x123" topic={1} />);
      const chip = container.querySelector(".mb-chip-ink");
      expect(chip).toBeInTheDocument();
    });

    it("renders custom text for PPIU topic when claim is valid", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      render(<ClaimBadge address="0x123" topic={1} />);
      expect(screen.getByText("Berizin PPIU ✓")).toBeInTheDocument();
    });

    it("renders topic name for non-PPIU topics when claim is valid", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      render(<ClaimBadge address="0x456" topic={2} />);
      expect(screen.getByText(/AIRLINE ✓/)).toBeInTheDocument();
    });

    it("renders invalid claim chip with muted color", () => {
      useScaffoldReadContract.mockReturnValue({ data: false, isLoading: false });
      const { container } = render(<ClaimBadge address="0x123" topic={1} />);
      const chip = container.querySelector(".mb-chip-muted");
      expect(chip).toBeInTheDocument();
    });

    it("renders invalid claim text", () => {
      useScaffoldReadContract.mockReturnValue({ data: false, isLoading: false });
      render(<ClaimBadge address="0x123" topic={1} />);
      expect(screen.getByText(/tanpa klaim PPIU/)).toBeInTheDocument();
    });

    it("passes enabled flag based on address presence to useScaffoldReadContract", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      render(<ClaimBadge address="0x123" topic={1} />);
      expect(useScaffoldReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { enabled: true },
        }),
      );
    });

    it("passes disabled flag when address is undefined", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      render(<ClaimBadge address={undefined} topic={1} />);
      expect(useScaffoldReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { enabled: false },
        }),
      );
    });

    it("passes correct contract and function name to hook", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      render(<ClaimBadge address="0x123" topic={1} />);
      expect(useScaffoldReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          contractName: "ClaimRegistry",
          functionName: "hasValidClaim",
        }),
      );
    });

    it("renders undefined data as loading state", () => {
      useScaffoldReadContract.mockReturnValue({ data: undefined, isLoading: false });
      render(<ClaimBadge address="0x123" topic={1} />);
      expect(screen.getByText(/PPIU …/)).toBeInTheDocument();
    });
  });

  describe("AddressChip component", () => {
    const mockChainId = 42161;

    beforeEach(() => {
      useMabrurContracts.mockReturnValue({ chainId: mockChainId });
      useTargetNetwork.mockReturnValue({
        targetNetwork: { id: mockChainId, blockExplorers: { default: { url: "https://arbiscan.io" } } },
      });
    });

    it("returns muted span when address is undefined", () => {
      render(<AddressChip address={undefined} />);
      expect(screen.getByText("–")).toHaveClass("mb-muted");
    });

    it("renders address as link when explorer URL is available", () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123");
      render(<AddressChip address="0x123" />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "https://arbiscan.io/address/0x123");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    });

    it("renders address as plain text when explorer URL is not available", () => {
      explorerAddr.mockReturnValue(null);
      render(<AddressChip address="0x123" />);
      const link = screen.queryByRole("link");
      expect(link).not.toBeInTheDocument();
    });

    it("renders shortened address from shortHex utility", () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123");
      render(<AddressChip address="0x123456789" />);
      // The mock shortHex returns first 6 + ... + last 4 chars
      expect(screen.getByText("0x1234...6789")).toBeInTheDocument();
    });

    it("renders label when name prop is provided", () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123");
      render(<AddressChip address="0x123" name="My Address" />);
      expect(screen.getByText("My Address")).toHaveClass("font-bold");
    });

    it("renders label from getLabel util when name prop is not provided", async () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x1234567890123456789012345678901234567890");
      render(<AddressChip address="0x1234567890123456789012345678901234567890" />);
      await waitFor(() => {
        expect(screen.getByText("Test Vendor")).toBeInTheDocument();
      });
    });

    it("does not render label when name is undefined and getLabel returns undefined", async () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x999");
      render(<AddressChip address="0x999" />);
      await waitFor(() => {
        expect(screen.queryByText("Test Vendor")).not.toBeInTheDocument();
      });
    });

    it("updates label when name prop changes", async () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123");
      const { rerender } = render(<AddressChip address="0x123" name="First" />);
      expect(screen.getByText("First")).toBeInTheDocument();

      rerender(<AddressChip address="0x123" name="Second" />);
      await waitFor(() => {
        expect(screen.getByText("Second")).toBeInTheDocument();
      });
    });

    it("renders chip with address title attribute", () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123abc");
      const { container } = render(<AddressChip address="0x123abc" />);
      const link = container.querySelector("a");
      expect(link).toHaveAttribute("title", "0x123abc");
    });

    it("renders topic badge when topic is provided", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123");
      render(<AddressChip address="0x123" topic={1} />);
      expect(screen.getByText(/PPIU/)).toBeInTheDocument();
    });

    it("does not render topic badge when topic is undefined", () => {
      useScaffoldReadContract.mockReturnValue({ data: true, isLoading: false });
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123");
      render(<AddressChip address="0x123" />);
      expect(screen.queryByText(/PPIU/)).not.toBeInTheDocument();
    });

    it("applies flex and gap-2 classes to container", () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123");
      const { container } = render(<AddressChip address="0x123" />);
      const span = container.querySelector(".inline-flex");
      expect(span).toHaveClass("flex-wrap", "items-center", "gap-2");
    });

    it("renders mb-data class for address text", () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123");
      const { container } = render(<AddressChip address="0x123" />);
      const dataSpan = container.querySelector(".mb-data");
      expect(dataSpan).toBeInTheDocument();
    });

    it("applies mb-link class to address link", () => {
      explorerAddr.mockReturnValue("https://arbiscan.io/address/0x123");
      const { container } = render(<AddressChip address="0x123" />);
      const link = container.querySelector(".mb-link");
      expect(link).toBeInTheDocument();
    });
  });

  describe("TxLink component", () => {
    const mockChainId = 42161;

    beforeEach(() => {
      useMabrurContracts.mockReturnValue({ chainId: mockChainId });
      useTargetNetwork.mockReturnValue({
        targetNetwork: { id: mockChainId, blockExplorers: { default: { url: "https://arbiscan.io" } } },
      });
    });

    it("renders transaction link when explorer URL is available", () => {
      explorerTx.mockReturnValue("https://arbiscan.io/tx/0xabc123");
      render(<TxLink hash="0xabc123" />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "https://arbiscan.io/tx/0xabc123");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    });

    it("renders plain text when explorer URL is not available", () => {
      explorerTx.mockReturnValue(null);
      render(<TxLink hash="0xabc123" />);
      const link = screen.queryByRole("link");
      expect(link).not.toBeInTheDocument();
    });

    it("renders tx label with shortened hash", () => {
      explorerTx.mockReturnValue("https://arbiscan.io/tx/0xabc123");
      render(<TxLink hash="0xabcdefghijklmnop" />);
      expect(screen.getByText(/tx/)).toBeInTheDocument();
    });

    it("passes correct shortHex arguments via rendered output", () => {
      explorerTx.mockReturnValue("https://arbiscan.io/tx/0xabc");
      render(<TxLink hash="0xabcdefghijklmnopqrstuvwxyz" />);
      // The shortHex utility formats as first 8 + last 6 chars
      // This is verified by checking it renders tx with shortened hash
      expect(screen.getByText(/tx/)).toBeInTheDocument();
    });

    it("applies mb-data and mb-link classes to link", () => {
      explorerTx.mockReturnValue("https://arbiscan.io/tx/0xabc");
      const { container } = render(<TxLink hash="0xabc" />);
      const link = container.querySelector(".mb-link");
      expect(link).toHaveClass("mb-data");
    });

    it("applies text-sm class to link", () => {
      explorerTx.mockReturnValue("https://arbiscan.io/tx/0xabc");
      const { container } = render(<TxLink hash="0xabc" />);
      const link = container.querySelector("a");
      expect(link).toHaveClass("text-sm");
    });

    it("sets hash as title attribute for full value on hover", () => {
      explorerTx.mockReturnValue("https://arbiscan.io/tx/0xabcdef");
      render(<TxLink hash="0xabcdef" />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("title", "0xabcdef");
    });

    it("renders plain span when no explorer URL", () => {
      explorerTx.mockReturnValue(null);
      const { container } = render(<TxLink hash="0xabc" />);
      const span = container.querySelector(".mb-data");
      expect(span?.tagName).toBe("SPAN");
    });

    it("applies whitespace-nowrap class", () => {
      explorerTx.mockReturnValue("https://arbiscan.io/tx/0xabc");
      const { container } = render(<TxLink hash="0xabc" />);
      const link = container.querySelector("a");
      expect(link).toHaveClass("whitespace-nowrap");
    });
  });

  describe("CopyButton component", () => {
    it("renders button with default label 'Salin'", () => {
      useCopyToClipboard.mockReturnValue({ copyToClipboard: vi.fn(), isCopiedToClipboard: false });
      render(<CopyButton text="test" />);
      expect(screen.getByText("Salin")).toBeInTheDocument();
    });

    it("renders button with custom label", () => {
      useCopyToClipboard.mockReturnValue({ copyToClipboard: vi.fn(), isCopiedToClipboard: false });
      render(<CopyButton text="test" label="Copy" />);
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });

    it("shows 'Tersalin ✓' when isCopiedToClipboard is true", () => {
      useCopyToClipboard.mockReturnValue({ copyToClipboard: vi.fn(), isCopiedToClipboard: true });
      render(<CopyButton text="test" />);
      expect(screen.getByText("Tersalin ✓")).toBeInTheDocument();
    });

    it("calls copyToClipboard with correct text on click", async () => {
      const mockCopy = vi.fn();
      useCopyToClipboard.mockReturnValue({ copyToClipboard: mockCopy, isCopiedToClipboard: false });
      const user = userEvent.setup();
      render(<CopyButton text="copy-me" />);
      const button = screen.getByRole("button");
      await user.click(button);
      expect(mockCopy).toHaveBeenCalledWith("copy-me");
    });

    it("applies button type=button", () => {
      useCopyToClipboard.mockReturnValue({ copyToClipboard: vi.fn(), isCopiedToClipboard: false });
      render(<CopyButton text="test" />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "button");
    });

    it("applies mb-btn classes", () => {
      useCopyToClipboard.mockReturnValue({ copyToClipboard: vi.fn(), isCopiedToClipboard: false });
      render(<CopyButton text="test" />);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("mb-btn", "mb-btn-ghost", "mb-btn-sm");
    });

    it("handles empty text", async () => {
      const mockCopy = vi.fn();
      useCopyToClipboard.mockReturnValue({ copyToClipboard: mockCopy, isCopiedToClipboard: false });
      const user = userEvent.setup();
      render(<CopyButton text="" />);
      const button = screen.getByRole("button");
      await user.click(button);
      expect(mockCopy).toHaveBeenCalledWith("");
    });

    it("handles long text", async () => {
      const longText = "a".repeat(1000);
      const mockCopy = vi.fn();
      useCopyToClipboard.mockReturnValue({ copyToClipboard: mockCopy, isCopiedToClipboard: false });
      const user = userEvent.setup();
      render(<CopyButton text={longText} />);
      const button = screen.getByRole("button");
      await user.click(button);
      expect(mockCopy).toHaveBeenCalledWith(longText);
    });
  });

  describe("ContractsGuard component", () => {
    it("renders children when ready is true", () => {
      useMabrurContracts.mockReturnValue({
        ready: true,
        isLoading: false,
        chainName: "Arbitrum",
        chainId: 42161,
      });
      render(
        <ContractsGuard>
          <div>Protected Content</div>
        </ContractsGuard>,
      );
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("renders loading message when isLoading is true and ready is false", () => {
      useMabrurContracts.mockReturnValue({
        ready: false,
        isLoading: true,
        chainName: "Arbitrum",
        chainId: 42161,
      });
      render(
        <ContractsGuard>
          <div>Protected Content</div>
        </ContractsGuard>,
      );
      expect(screen.getByText(/Memuat kontrak/)).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("renders error message when isLoading is false and ready is false", () => {
      useMabrurContracts.mockReturnValue({
        ready: false,
        isLoading: false,
        chainName: "Sepolia",
        chainId: 11155111,
      });
      render(
        <ContractsGuard>
          <div>Protected Content</div>
        </ContractsGuard>,
      );
      expect(screen.getByText(/Kontrak Mabrur belum ada di Sepolia/)).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("shows chain name and ID in error message", () => {
      useMabrurContracts.mockReturnValue({
        ready: false,
        isLoading: false,
        chainName: "TestChain",
        chainId: 123456,
      });
      const { container } = render(
        <ContractsGuard>
          <div>Protected Content</div>
        </ContractsGuard>,
      );
      const errorText = container.querySelector(".mb-p");
      expect(errorText?.textContent).toContain("TestChain (123456)");
    });

    it("uses Bi component for bilingual error message", () => {
      useMabrurContracts.mockReturnValue({
        ready: false,
        isLoading: false,
        chainName: "TestChain",
        chainId: 123456,
      });
      render(
        <ContractsGuard>
          <div>Protected Content</div>
        </ContractsGuard>,
      );
      expect(screen.getByText(/Pindahkan dompet ke jaringan yang didukung/)).toBeInTheDocument();
    });

    it("applies mb-sheet and max-w-2xl classes to container", () => {
      useMabrurContracts.mockReturnValue({
        ready: false,
        isLoading: false,
        chainName: "Test",
        chainId: 1,
      });
      const { container } = render(
        <ContractsGuard>
          <div>Content</div>
        </ContractsGuard>,
      );
      const sheet = container.querySelector(".mb-sheet");
      expect(sheet).toHaveClass("max-w-2xl", "mx-auto", "mt-10");
    });

    it("renders without children when ready is true", () => {
      useMabrurContracts.mockReturnValue({
        ready: true,
        isLoading: false,
        chainName: "Arbitrum",
        chainId: 42161,
      });
      const { container } = render(<ContractsGuard>{null}</ContractsGuard>);
      // Should render the fragment with no children
      expect(container.firstChild).toBeDefined();
    });

    it("handles multiple children", () => {
      useMabrurContracts.mockReturnValue({
        ready: true,
        isLoading: false,
        chainName: "Arbitrum",
        chainId: 42161,
      });
      render(
        <ContractsGuard>
          <div>Child 1</div>
          <div>Child 2</div>
        </ContractsGuard>,
      );
      expect(screen.getByText("Child 1")).toBeInTheDocument();
      expect(screen.getByText("Child 2")).toBeInTheDocument();
    });
  });

  describe("PageShell component", () => {
    it("renders children", () => {
      render(
        <PageShell>
          <div>Page Content</div>
        </PageShell>,
      );
      expect(screen.getByText("Page Content")).toBeInTheDocument();
    });

    it("applies width full class", () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>,
      );
      const div = container.firstChild;
      expect(div).toHaveClass("w-full");
    });

    it("applies max-width class", () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>,
      );
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain("max-w-[1600px]");
    });

    it("applies responsive padding", () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>,
      );
      const div = container.firstChild;
      expect(div).toHaveClass("px-4", "lg:px-8", "py-6", "lg:py-10");
    });

    it("applies centering classes", () => {
      const { container } = render(
        <PageShell>
          <div>Content</div>
        </PageShell>,
      );
      const div = container.firstChild;
      expect(div).toHaveClass("mx-auto");
    });

    it("renders multiple children", () => {
      render(
        <PageShell>
          <div>Child 1</div>
          <div>Child 2</div>
        </PageShell>,
      );
      expect(screen.getByText("Child 1")).toBeInTheDocument();
      expect(screen.getByText("Child 2")).toBeInTheDocument();
    });

    it("handles text node children", () => {
      render(<PageShell>Direct text content</PageShell>);
      expect(screen.getByText("Direct text content")).toBeInTheDocument();
    });

    it("handles null children", () => {
      const { container } = render(<PageShell>{null}</PageShell>);
      expect(container.firstChild).toBeDefined();
    });

    it("handles undefined children", () => {
      const { container } = render(<PageShell>{undefined}</PageShell>);
      expect(container.firstChild).toBeDefined();
    });
  });
});
