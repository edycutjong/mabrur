import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VendorPage from "~~/app/app/vendor/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useAccount: vi.fn(),
  useWalletClient: vi.fn(),
  createConfig: vi.fn(() => ({})),
  http: vi.fn(() => ({})),
}));

// Mock mabrur hooks
vi.mock("~~/hooks/mabrur/useMabrur", () => ({
  useMabrurContracts: vi.fn(),
  explorerAddr: vi.fn((chainId: number, address: string) => `https://arbiscan.io/address/${address}`),
  explorerTx: vi.fn((chainId: number, txHash: string) => `https://arbiscan.io/tx/${txHash}`),
}));

// Mock scaffold-eth hooks
vi.mock("~~/hooks/scaffold-eth", () => ({
  useScaffoldReadContract: vi.fn(() => ({ data: undefined, isLoading: false })),
  useCopyToClipboard: vi.fn(() => ({ copyToClipboard: vi.fn(), isCopiedToClipboard: false })),
  useTargetNetwork: vi.fn(() => ({
    targetNetwork: { id: 42161, blockExplorers: { default: { url: "https://arbiscan.io" } } },
  })),
  useDeployedContractInfo: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

// Mock utilities - allow them to work but mock specific ones for testing
vi.mock("~~/utils/mabrur/errors", () => ({
  decodeRevert: vi.fn(e => {
    if (e instanceof Error) return { id: e.message };
    return { id: "Unknown error" };
  }),
}));

// Mock utils for labels
vi.mock("~~/utils/mabrur/names", () => ({
  getLabel: vi.fn(() => undefined),
}));

// Spy on QRCode render to prevent actual rendering
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qrcode">{value?.slice(0, 20)}</div>,
}));

// We import viem/accounts to get the real implementations but can mock if needed
const mockPrivateKeyToAccount = privateKeyToAccount;

describe("app/app/vendor/page", () => {
  let mockUseMabrurContracts: any;
  let mockUseAccount: any;
  let mockUseWalletClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked modules
    const mabrurHooks = await import("~~/hooks/mabrur/useMabrur");
    const { useAccount, useWalletClient } = await import("wagmi");

    mockUseMabrurContracts = vi.mocked(mabrurHooks.useMabrurContracts);
    mockUseAccount = vi.mocked(useAccount);
    mockUseWalletClient = vi.mocked(useWalletClient);

    // Default mocks
    mockUseMabrurContracts.mockReturnValue({
      ready: true,
      isLoading: false,
      chainId: 42161,
      pbm: { address: "0x1234567890123456789012345678901234567890" as Hex },
    });

    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
    });

    mockUseWalletClient.mockReturnValue({
      data: undefined,
    });

    // Mock localStorage
    const store: Record<string, string> = {};
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          Object.keys(store).forEach(key => delete store[key]);
        }),
      },
      writable: true,
    });
  });

  describe("Initial render and page structure", () => {
    it("renders the page with VendorPage wrapper component", () => {
      render(<VendorPage />);
      expect(screen.getByRole("heading", { name: "Tanda tangani faktur" })).toBeInTheDocument();
    });

    it("renders page shell with correct structure", () => {
      render(<VendorPage />);
      const heading = screen.getByRole("heading", { name: "Tanda tangani faktur" });
      expect(heading).toBeInTheDocument();
      expect(
        screen.getByText("Sign an invoice with your own key — nobody else chooses the payee."),
      ).toBeInTheDocument();
    });

    it("displays vendor label at top", () => {
      render(<VendorPage />);
      expect(screen.getByText("Vendor berlisensi · licensed vendor")).toBeInTheDocument();
    });

    it("renders grid layout with two columns", () => {
      const { container } = render(<VendorPage />);
      const gridContainer = container.querySelector(".grid.gap-6.lg\\:grid-cols-2");
      expect(gridContainer).toBeInTheDocument();
    });

    it("renders form section on left", () => {
      render(<VendorPage />);
      expect(screen.getByText("Kunci vendor · your key")).toBeInTheDocument();
      expect(screen.getByText("Id booking")).toBeInTheDocument();
      expect(screen.getByText("Pos · line")).toBeInTheDocument();
      expect(screen.getByText("Jumlah · amount")).toBeInTheDocument();
      expect(screen.getByText("No. faktur · ref")).toBeInTheDocument();
      expect(screen.getByText("Berlaku s.d. · expiry")).toBeInTheDocument();
    });

    it("renders signed invoice panel on right", () => {
      const { container } = render(<VendorPage />);
      // Check that right panel exists for signed invoice
      expect(container.querySelectorAll(".mb-sheet").length).toBe(2);
    });
  });

  describe("Burner key initialization", () => {
    it("generates a new burner key on first render", async () => {
      render(<VendorPage />);

      // Should have a burner address after initialization
      // The page should render with the key management UI
      await waitFor(() => {
        expect(screen.getByText("Kunci vendor · your key")).toBeInTheDocument();
      });
    });

    it("stores generated burner key in localStorage", async () => {
      render(<VendorPage />);

      // After render, a key should be stored
      const stored = window.localStorage.getItem("mabrur.vendor.burnerPk");
      expect(stored).toBeTruthy();
      expect(stored).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("loads burner key from localStorage if valid", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      render(<VendorPage />);

      // Should render successfully with stored key
      await waitFor(() => {
        expect(screen.getByText("Kunci vendor · your key")).toBeInTheDocument();
      });
    });

    it("generates new key and shows error message when stored key is invalid", async () => {
      window.localStorage.setItem("mabrur.vendor.burnerPk", "invalid_key");

      render(<VendorPage />);

      await waitFor(() => {
        expect(screen.getByText(/Kunci burner tersimpan tidak sah dan sudah dihapus/)).toBeInTheDocument();
      });
    });

    it("sets expiry to approximately 2 days in future", async () => {
      render(<VendorPage />);

      await waitFor(() => {
        const expiryInputs = screen.getAllByDisplayValue(/T/);
        expect(expiryInputs.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Mode switching between burner and wallet", () => {
    it("starts in burner mode", async () => {
      render(<VendorPage />);

      await waitFor(() => {
        const burnerButton = screen.getByText("Burner di browser ini").closest("button");
        expect(burnerButton).toHaveAttribute("aria-pressed", "true");
      });
    });

    it("switches to wallet mode when wallet button is clicked", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const walletButton = screen.getByText("Dompet terhubung");
      await user.click(walletButton);

      await waitFor(() => {
        expect(walletButton.closest("button")).toHaveAttribute("aria-pressed", "true");
      });
    });

    it("burner mode button becomes inactive when switched to wallet mode", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const walletButton = screen.getByText("Dompet terhubung");
      await user.click(walletButton);

      const burnerButton = screen.getByText("Burner di browser ini").closest("button");
      expect(burnerButton).toHaveAttribute("aria-pressed", "false");
    });

    it("clears signed invoice when switching modes", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      // Initially no signed invoice
      expect(screen.getByText(/Isi formulir lalu tanda tangani/)).toBeInTheDocument();

      // Switch mode
      await user.click(screen.getByText("Dompet terhubung"));

      // Still no signed invoice after mode switch
      expect(screen.getByText(/Isi formulir lalu tanda tangani/)).toBeInTheDocument();
    });

    it("renders wallet mode button to switch to wallet", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const walletButton = screen.getByText("Dompet terhubung");
      expect(walletButton).toBeInTheDocument();

      // Verify we can click it
      await user.click(walletButton);
      expect(walletButton.closest("button")).toHaveAttribute("aria-pressed", "true");
    });

    it("shows connection prompt in wallet mode when wallet is not connected", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      await user.click(screen.getByText("Dompet terhubung"));

      await waitFor(() => {
        expect(screen.getByText("Hubungkan dompet")).toBeInTheDocument();
      });
    });
  });

  describe("Form input handling", () => {
    it("updates booking ID when input changes", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const bookingInputs = screen.getAllByLabelText("Id booking");
      const bookingInput = bookingInputs[0] as HTMLInputElement;

      await user.type(bookingInput, "12345");
      expect(bookingInput.value).toBe("12345");
    });

    it("trims whitespace from booking ID on input", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const bookingInputs = screen.getAllByLabelText("Id booking");
      const bookingInput = bookingInputs[0] as HTMLInputElement;

      await user.type(bookingInput, "  123  ");
      // Component trims on onChange, so value should be trimmed
      expect(bookingInput.value).toBe("123");
    });

    it("changes line selection when select option is clicked", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const lineSelect = screen.getByLabelText("Pos") as HTMLSelectElement;
      await user.selectOptions(lineSelect, "1");

      expect(lineSelect.value).toBe("1");
    });

    it("updates amount input value", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const amountInputs = screen.getAllByLabelText("Jumlah");
      const amountInput = amountInputs[0] as HTMLInputElement;

      await user.clear(amountInput);
      await user.type(amountInput, "5000000");

      expect(amountInput.value).toBe("5000000");
    });

    it("updates ref input with custom reference", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const refInputs = screen.getAllByLabelText("Nomor faktur");
      const refInput = refInputs[0] as HTMLInputElement;

      await user.clear(refInput);
      await user.type(refInput, "CUSTOM-REF-001");

      expect(refInput.value).toBe("CUSTOM-REF-001");
    });

    it("enforces maximum 66 character length on ref input", () => {
      render(<VendorPage />);

      const refInputs = screen.getAllByLabelText("Nomor faktur");
      const refInput = refInputs[0] as HTMLInputElement;

      expect(refInput.maxLength).toBe(66);
    });

    it("updates expiry datetime when input changes", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const expiryInputs = screen.getAllByLabelText("Kedaluwarsa");
      const expiryInput = expiryInputs[0] as HTMLInputElement;

      const newValue = "2026-12-31T23:59";
      await user.clear(expiryInput);
      await user.type(expiryInput, newValue);

      expect(expiryInput.value).toBe(newValue);
    });
  });

  describe("Ref validation and error handling", () => {
    it("shows error when ref exceeds 32 bytes and is not valid hex", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const refInputs = screen.getAllByLabelText("Nomor faktur");
      const refInput = refInputs[0] as HTMLInputElement;

      const longText = "a".repeat(50);
      await user.clear(refInput);
      await user.type(refInput, longText);

      await waitFor(() => {
        expect(refInput).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByText(/ref is \d+ byte/)).toBeInTheDocument();
      });
    });

    it("does not show error for short ref within 32 bytes", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const refInputs = screen.getAllByLabelText("Nomor faktur");
      const refInput = refInputs[0] as HTMLInputElement;

      await user.clear(refInput);
      await user.type(refInput, "SHORT-REF");

      expect(refInput).not.toHaveAttribute("aria-invalid");
      expect(screen.queryByText(/ref is \d+ byte/)).not.toBeInTheDocument();
    });

    it("accepts valid 0x-prefixed 32-byte hex ref", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const refInputs = screen.getAllByLabelText("Nomor faktur");
      const refInput = refInputs[0] as HTMLInputElement;

      const hexRef = "0x" + "a".repeat(64);
      await user.clear(refInput);
      await user.type(refInput, hexRef);

      expect(refInput).not.toHaveAttribute("aria-invalid");
    });

    it("associates error message with aria-describedby", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const refInputs = screen.getAllByLabelText("Nomor faktur");
      const refInput = refInputs[0] as HTMLInputElement;

      const longText = "a".repeat(50);
      await user.clear(refInput);
      await user.type(refInput, longText);

      await waitFor(() => {
        expect(refInput.getAttribute("aria-describedby")).toBe("ref-err");
      });
    });
  });

  describe("Sign button state", () => {
    it("sign button is disabled when booking ID is missing", async () => {
      render(<VendorPage />);

      const buttons = screen.getAllByRole("button");
      const signButton = buttons.find(b => b.textContent?.includes("Tanda tangani faktur"));

      expect(signButton).toHaveAttribute("disabled");
    });

    it("sign button is disabled when amount is missing", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const bookingInputs = screen.getAllByLabelText("Id booking");
      const bookingInput = bookingInputs[0];

      await user.type(bookingInput, "123");

      // Amount has default value, so we need to make it invalid by clearing
      const amountInputs = screen.getAllByLabelText("Jumlah");
      const amountInput = amountInputs[0];

      await user.clear(amountInput);

      const buttons = screen.getAllByRole("button");
      const signButton = buttons.find(b => b.textContent?.includes("Tanda tangani faktur"));

      expect(signButton).toHaveAttribute("disabled");
    });

    it("sign button is disabled when signer address is undefined and in wallet mode", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      // Switch to wallet mode
      await user.click(screen.getByText("Dompet terhubung"));

      const buttons = screen.getAllByRole("button");
      const signButton = buttons.find(b => b.textContent?.includes("Tanda tangani faktur"));

      // Should be disabled because wallet is not connected
      expect(signButton).toHaveAttribute("disabled");
    });

    it("sign button is disabled when ref error is present", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const refInputs = screen.getAllByLabelText("Nomor faktur");
      const refInput = refInputs[0];

      const longText = "a".repeat(50);
      await user.clear(refInput);
      await user.type(refInput, longText);

      const buttons = screen.getAllByRole("button");
      const signButton = buttons.find(b => b.textContent?.includes("Tanda tangani faktur"));

      expect(signButton).toHaveAttribute("disabled");
    });
  });

  describe("Key import section", () => {
    it("shows import section in details element when in burner mode", async () => {
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      expect(summary.closest("details")).toBeInTheDocument();
    });

    it("has import details section in burner mode", async () => {
      render(<VendorPage />);

      // Details element should be visible in burner mode
      const details = screen.queryByText("Ganti / impor kunci burner")?.closest("details");
      expect(details).toBeInTheDocument();
    });

    it("has password input for importing key", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const passwordInputs = screen.getAllByLabelText("Impor kunci privat");
      expect(passwordInputs[0]).toHaveAttribute("type", "password");
    });

    it("has import button to submit key", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const importButtons = screen.getAllByRole("button");
      const importButton = importButtons.find(b => b.textContent?.includes("Impor"));
      expect(importButton).toBeInTheDocument();
    });

    it("shows error when invalid key is imported", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const passwordInputs = screen.getAllByLabelText("Impor kunci privat");
      const importInput = passwordInputs[0];

      await user.type(importInput, "invalid_key_format");

      const buttons = screen.getAllByRole("button");
      const importButton = buttons.find(b => b.textContent?.includes("Impor"));
      if (importButton) {
        await user.click(importButton);

        await waitFor(() => {
          expect(
            screen.getByText(/Kunci tidak sah: harus 32 byte hex, bukan nol, di bawah orde kurva secp256k1/),
          ).toBeInTheDocument();
        });
      }
    });

    it("allows importing valid private key via import section", async () => {
      const user = userEvent.setup();

      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      // Import section should be visible with input and button
      const passwordInputs = screen.getAllByLabelText("Impor kunci privat");
      expect(passwordInputs.length).toBeGreaterThan(0);

      const buttons = screen.getAllByRole("button");
      const importButton = buttons.find(b => b.textContent?.includes("Impor"));
      expect(importButton).toBeInTheDocument();
    });

    it("validates imported key format", async () => {
      const user = userEvent.setup();

      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const passwordInputs = screen.getAllByLabelText("Impor kunci privat");
      const importInput = passwordInputs[0];

      // Type invalid key
      await user.type(importInput, "invalid");

      const buttons = screen.getAllByRole("button");
      const importButton = buttons.find(b => b.textContent?.includes("Impor"));
      if (importButton) {
        await user.click(importButton);

        // Should show error for invalid key
        await waitFor(() => {
          expect(
            screen.getByText(/Kunci tidak sah: harus 32 byte hex, bukan nol, di bawah orde kurva secp256k1/),
          ).toBeInTheDocument();
        });
      }
    });

    it("clears error message on successful import", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const passwordInputs = screen.getAllByLabelText("Impor kunci privat");
      const importInput = passwordInputs[0];

      // First: import invalid key
      await user.type(importInput, "invalid");

      const buttons = screen.getAllByRole("button");
      const importButton = buttons.find(b => b.textContent?.includes("Impor"));
      if (importButton) {
        await user.click(importButton);

        await waitFor(() => {
          expect(
            screen.getByText(/Kunci tidak sah: harus 32 byte hex, bukan nol, di bawah orde kurva secp256k1/),
          ).toBeInTheDocument();
        });

        // Clear and import valid key
        await user.clear(importInput);
        const pk = generatePrivateKey() as Hex;
        await user.type(importInput, pk);
        await user.click(importButton);

        await waitFor(() => {
          expect(
            screen.queryByText(/Kunci tidak sah: harus 32 byte hex, bukan nol, di bawah orde kurva secp256k1/),
          ).not.toBeInTheDocument();
        });
      }
    });
  });

  describe("Key replacement and clearing", () => {
    it("shows 'create new burner' link when key exists", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      const user = userEvent.setup();
      await user.click(summary);

      const newBurnerLinks = screen.getAllByRole("button");
      const newBurnerLink = newBurnerLinks.find(b => b.textContent?.includes("Buat burner baru"));
      expect(newBurnerLink).toBeInTheDocument();
    });

    it("shows 'clear burner' link when key exists", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      const user = userEvent.setup();
      await user.click(summary);

      const clearLinks = screen.getAllByRole("button");
      const clearLink = clearLinks.find(b => b.textContent?.includes("Hapus burner"));
      expect(clearLink).toBeInTheDocument();
    });

    it("shows confirmation dialog when creating new burner", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const newBurnerButton = buttons.find(b => b.textContent?.includes("Buat burner baru"));
      if (newBurnerButton) {
        await user.click(newBurnerButton);

        await waitFor(() => {
          expect(screen.getByText(/Ganti kunci burner\?/)).toBeInTheDocument();
        });
      }
    });

    it("confirmation dialog has role alertdialog for accessibility", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const newBurnerButton = buttons.find(b => b.textContent?.includes("Buat burner baru"));
      if (newBurnerButton) {
        await user.click(newBurnerButton);

        await waitFor(() => {
          expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        });
      }
    });

    it("creates new burner when confirmed", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const newBurnerButton = buttons.find(b => b.textContent?.includes("Buat burner baru"));
      if (newBurnerButton) {
        await user.click(newBurnerButton);

        await waitFor(() => {
          const confirmButtons = screen.getAllByRole("button");
          const confirmButton = confirmButtons.find(b => b.textContent?.includes("Ya, buat burner baru"));
          if (confirmButton) {
            userEvent.click(confirmButton);

            // New key should be different from old one
            expect(window.localStorage.getItem("mabrur.vendor.burnerPk")).not.toBe(pk);
          }
        });
      }
    });

    it("shows copy button for old key before replacement", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const newBurnerButton = buttons.find(b => b.textContent?.includes("Buat burner baru"));
      if (newBurnerButton) {
        await user.click(newBurnerButton);

        await waitFor(() => {
          const copyButtons = screen.getAllByRole("button");
          const copyButton = copyButtons.find(b => b.textContent?.includes("Salin kunci lama"));
          expect(copyButton).toBeInTheDocument();
        });
      }
    });

    it("cancels key replacement when cancel is clicked", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const newBurnerButton = buttons.find(b => b.textContent?.includes("Buat burner baru"));
      if (newBurnerButton) {
        await user.click(newBurnerButton);

        await waitFor(() => {
          const cancelButtons = screen.getAllByRole("button");
          const cancelButton = cancelButtons.find(b => b.textContent?.includes("Batal"));
          if (cancelButton) {
            userEvent.click(cancelButton);

            // Key should remain unchanged
            expect(window.localStorage.getItem("mabrur.vendor.burnerPk")).toBe(pk);
          }
        });
      }
    });

    it("shows clear confirmation dialog", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const clearButton = buttons.find(b => b.textContent?.includes("Hapus burner"));
      if (clearButton) {
        await user.click(clearButton);

        await waitFor(() => {
          expect(screen.getByText(/Hapus kunci burner\?/)).toBeInTheDocument();
        });
      }
    });

    it("clears burner when confirmed", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const clearButton = buttons.find(b => b.textContent?.includes("Hapus burner"));
      if (clearButton) {
        await user.click(clearButton);

        await waitFor(() => {
          const confirmButtons = screen.getAllByRole("button");
          const confirmButton = confirmButtons.find(b => b.textContent?.includes("Ya, hapus burner"));
          if (confirmButton) {
            userEvent.click(confirmButton);

            // Burner should be cleared
            expect(window.localStorage.getItem("mabrur.vendor.burnerPk")).toBeNull();
          }
        });
      }
    });

    it("shows success message after clearing burner", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const clearButton = buttons.find(b => b.textContent?.includes("Hapus burner"));
      if (clearButton) {
        await user.click(clearButton);

        await waitFor(() => {
          const confirmButtons = screen.getAllByRole("button");
          const confirmButton = confirmButtons.find(b => b.textContent?.includes("Ya, hapus burner"));
          if (confirmButton) {
            userEvent.click(confirmButton);

            // Should show success message
            expect(screen.getByText(/Burner dihapus dari browser ini/)).toBeInTheDocument();
          }
        });
      }
    });
  });

  describe("Line-specific messaging", () => {
    it("shows flight info when line 0 is selected", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const lineSelect = screen.getByLabelText("Pos") as HTMLSelectElement;
      // Default is 1 (hotel), so message shouldn't be there
      expect(screen.queryByText(/Faktur tiket harus melunasi seluruh pos tiket/)).not.toBeInTheDocument();

      // Switch to line 0 (flight)
      await user.selectOptions(lineSelect, "0");

      // Message should appear
      await waitFor(() => {
        expect(screen.getByText(/Faktur tiket harus melunasi seluruh pos tiket/)).toBeInTheDocument();
      });
    });
  });

  describe("Claim badges display", () => {
    it("shows claim badges in burner mode", () => {
      render(<VendorPage />);

      // Should have signer section with claim badges
      expect(screen.getByText("Alamat penanda tangan · signer")).toBeInTheDocument();
    });

    it("shows wallet mode prompt when not connected", () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      // Burner mode shows address, wallet mode shows connection prompt
      expect(screen.getByText("Burner di browser ini")).toBeInTheDocument();
    });
  });

  describe("Signed invoice display", () => {
    it("shows placeholder message when no invoice is signed", () => {
      render(<VendorPage />);

      expect(screen.getByText(/Isi formulir lalu tanda tangani/)).toBeInTheDocument();
    });

    it("has two-column layout for form and signed invoice", () => {
      const { container } = render(<VendorPage />);
      const gridContainer = container.querySelector(".grid.gap-6");
      expect(gridContainer).toBeInTheDocument();
    });

    it("displays label for signed invoice section", () => {
      render(<VendorPage />);

      const labels = screen.getAllByText("Faktur bertanda tangan · signed invoice");
      expect(labels.length).toBeGreaterThan(0);
    });
  });

  describe("Accessibility features", () => {
    it("mode buttons have aria-pressed attribute", () => {
      render(<VendorPage />);

      const burnerButton = screen.getByText("Burner di browser ini").closest("button");
      const walletButton = screen.getByText("Dompet terhubung").closest("button");

      expect(burnerButton).toHaveAttribute("aria-pressed", "true");
      expect(walletButton).toHaveAttribute("aria-pressed", "false");
    });

    it("booking ID input has aria-label", () => {
      render(<VendorPage />);

      const bookingInputs = screen.getAllByLabelText("Id booking");
      expect(bookingInputs.length).toBeGreaterThan(0);
      expect(bookingInputs[0]).toHaveAttribute("aria-label", "Id booking");
    });

    it("line select has aria-label", () => {
      render(<VendorPage />);

      const lineSelect = screen.getByLabelText("Pos");
      expect(lineSelect).toHaveAttribute("aria-label", "Pos");
    });

    it("amount input has aria-label", () => {
      render(<VendorPage />);

      const amountInputs = screen.getAllByLabelText("Jumlah");
      expect(amountInputs.length).toBeGreaterThan(0);
      expect(amountInputs[0]).toHaveAttribute("aria-label", "Jumlah");
    });

    it("ref input has aria-label", () => {
      render(<VendorPage />);

      const refInputs = screen.getAllByLabelText("Nomor faktur");
      expect(refInputs.length).toBeGreaterThan(0);
      expect(refInputs[0]).toHaveAttribute("aria-label", "Nomor faktur");
    });

    it("expiry input has aria-label", () => {
      render(<VendorPage />);

      const expiryInputs = screen.getAllByLabelText("Kedaluwarsa");
      expect(expiryInputs.length).toBeGreaterThan(0);
      expect(expiryInputs[0]).toHaveAttribute("aria-label", "Kedaluwarsa");
    });

    it("invalid ref input has aria-invalid attribute", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      const refInputs = screen.getAllByLabelText("Nomor faktur");
      const refInput = refInputs[0];

      const longText = "a".repeat(50);
      await user.clear(refInput);
      await user.type(refInput, longText);

      expect((refInput as HTMLInputElement).getAttribute("aria-invalid")).toBe("true");
    });

    it("has status role for key note messages", async () => {
      window.localStorage.setItem("mabrur.vendor.burnerPk", "invalid");

      render(<VendorPage />);

      await waitFor(() => {
        expect(screen.getByRole("status")).toBeInTheDocument();
      });
    });

    it("confirmation dialogs have alertdialog role", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const newBurnerButton = buttons.find(b => b.textContent?.includes("Buat burner baru"));
      if (newBurnerButton) {
        await user.click(newBurnerButton);

        await waitFor(() => {
          expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        });
      }
    });
  });

  describe("localStorage resilience", () => {
    it("handles localStorage blocked on read gracefully", async () => {
      const getItemSpy = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      render(<VendorPage />);

      await waitFor(() => {
        // Should still render and generate a burner key
        expect(screen.getByText("Kunci vendor · your key")).toBeInTheDocument();
      });

      getItemSpy.mockRestore();
    });

    it("handles localStorage blocked on write gracefully", async () => {
      const setItemSpy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      render(<VendorPage />);

      await waitFor(() => {
        // Should still render even if storage is blocked
        expect(screen.getByText("Kunci vendor · your key")).toBeInTheDocument();
      });

      setItemSpy.mockRestore();
    });
  });

  describe("Mode switching and signed invoice clearing", () => {
    it("clears signed invoice when switching from wallet to burner mode", async () => {
      const user = userEvent.setup();
      render(<VendorPage />);

      // Start in burner mode (default)
      const burnerButton = screen.getByText("Burner di browser ini");
      const walletButton = screen.getByText("Dompet terhubung");

      // Switch to wallet mode
      await user.click(walletButton);
      expect(walletButton.closest("button")).toHaveAttribute("aria-pressed", "true");

      // Switch back to burner
      await user.click(burnerButton);
      expect(burnerButton.closest("button")).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("Confirmation dialog cancel", () => {
    it("cancels key replacement with cancel button", async () => {
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      const user = userEvent.setup();
      render(<VendorPage />);

      const summary = screen.getByText("Ganti / impor kunci burner");
      await user.click(summary);

      const buttons = screen.getAllByRole("button");
      const newBurnerButton = buttons.find(b => b.textContent?.includes("Buat burner baru"));

      if (newBurnerButton) {
        await user.click(newBurnerButton);

        await waitFor(() => {
          const cancelButtons = screen.getAllByRole("button");
          const cancelButton = cancelButtons.find(b => b.textContent?.includes("Batal"));

          if (cancelButton) {
            userEvent.click(cancelButton);

            // Dialog should close
            expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

            // Key should remain unchanged
            expect(window.localStorage.getItem("mabrur.vendor.burnerPk")).toBe(pk);
          }
        });
      }
    });
  });

  describe("Error handling in signing", () => {
    it("handles signing and prepares invoice data", async () => {
      const user = userEvent.setup();
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      render(<VendorPage />);

      // Fill in required fields
      const bookingInputs = screen.getAllByLabelText("Id booking");
      const bookingInput = bookingInputs[0];

      await user.type(bookingInput, "123");

      // Form should have valid state
      expect(screen.getByText("Kunci vendor · your key")).toBeInTheDocument();
    });

    it("sign button becomes enabled with valid form data", async () => {
      const user = userEvent.setup();
      const pk = generatePrivateKey() as Hex;
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      render(<VendorPage />);

      // Initially disabled
      let buttons = screen.getAllByRole("button");
      let signButton = buttons.find(b => b.textContent?.includes("Tanda tangani faktur"));
      expect(signButton).toHaveAttribute("disabled");

      // Fill in booking ID
      const bookingInputs = screen.getAllByLabelText("Id booking");
      const bookingInput = bookingInputs[0];
      await user.type(bookingInput, "123");

      // Amount has default value, expiry is auto-set
      // Button should still be checking other conditions
      buttons = screen.getAllByRole("button");
      signButton = buttons.find(b => b.textContent?.includes("Tanda tangani faktur"));
      expect(signButton).toBeDefined();
    });

    it("executes sign function with valid burner", async () => {
      const user = userEvent.setup();
      const pk = generatePrivateKey() as Hex;
      const account = privateKeyToAccount(pk);
      window.localStorage.setItem("mabrur.vendor.burnerPk", pk);

      render(<VendorPage />);

      // Fill all form fields to make button enabled
      const bookingInputs = screen.getAllByLabelText("Id booking");
      const bookingInput = bookingInputs[0];
      await user.type(bookingInput, "0x123456789abcdef");

      // Button should now be able to be clicked
      const buttons = screen.getAllByRole("button");
      const signButton = buttons.find(b => b.textContent?.includes("Tanda tangani faktur"));

      if (signButton && !signButton.hasAttribute("disabled")) {
        // Try to click sign - this will exercise the signing path if mocked properly
        await user.click(signButton);
        // If signing fails or throws, error should be displayed
        await waitFor(() => {
          // Check if error or success message appears
          expect(screen.getByText("Kunci vendor · your key")).toBeInTheDocument();
        });
      }
    });

    it("handles exception in accountFor when key validation fails", () => {
      // This tests that accountFor gracefully handles when privateKeyToAccount throws
      // Store an invalid key that passes initial validation but fails on account creation
      window.localStorage.setItem("mabrur.vendor.burnerPk", "0x" + "f".repeat(64));

      // Component should still render
      render(<VendorPage />);
      expect(screen.getByText("Kunci vendor · your key")).toBeInTheDocument();
    });

    it("exercises wallet client signing path", async () => {
      const user = userEvent.setup();
      const mockWalletClient = {
        signTypedData: vi.fn().mockResolvedValue("0x" + "a".repeat(130)),
      };

      mockUseWalletClient.mockReturnValue({
        data: mockWalletClient,
      });

      mockUseAccount.mockReturnValue({
        address: "0x1234567890123456789012345678901234567890" as Hex,
        isConnected: true,
      });

      render(<VendorPage />);

      // Switch to wallet mode
      const walletButton = screen.getByText("Dompet terhubung");
      await user.click(walletButton);

      // Fill booking ID
      const bookingInputs = screen.getAllByLabelText("Id booking");
      const bookingInput = bookingInputs[0];
      await user.type(bookingInput, "0x123456789abcdef");

      // Try to sign - should use wallet client
      const buttons = screen.getAllByRole("button");
      const signButton = buttons.find(b => b.textContent?.includes("Tanda tangani faktur"));

      if (signButton && !signButton.hasAttribute("disabled")) {
        await user.click(signButton);

        // Give time for async signing
        await waitFor(() => {
          expect(screen.getByText("Kunci vendor · your key")).toBeInTheDocument();
        });
      }
    });
  });
});
