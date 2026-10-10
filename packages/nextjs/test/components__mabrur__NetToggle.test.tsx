import { fireEvent, render, screen } from "@testing-library/react";
import { arbitrum, arbitrumSepolia, foundry } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetToggle } from "~~/components/mabrur/NetToggle";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useGlobalState } from "~~/services/store/store";

const switchChain = vi.fn();
const account = { isConnected: false, chain: undefined as { id: number } | undefined };
vi.mock("wagmi", () => ({ useAccount: () => account, useSwitchChain: () => ({ switchChain }) }));
vi.mock("~~/hooks/scaffold-eth", () => ({ useTargetNetwork: vi.fn() }));
vi.mock("~~/hooks/mabrur/useLang", () => ({ useT: () => (id: string) => id }));

const setTargetNetwork = vi.fn();
const on = (chain: { id: number; name: string }) => (useTargetNetwork as any).mockReturnValue({ targetNetwork: chain });

describe("NetToggle (Mainnet | Testnet)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/app");
    account.isConnected = false;
    account.chain = undefined;
    useGlobalState.setState({ setTargetNetwork });
  });

  it("marks the mainnet pressed on Arbitrum One", () => {
    on(arbitrum);
    render(<NetToggle />);
    expect(screen.getByRole("button", { name: "Mainnet" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Testnet" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("switches the app to Arbitrum Sepolia and remembers it", () => {
    on(arbitrum);
    render(<NetToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Testnet" }));
    expect(setTargetNetwork).toHaveBeenCalledWith(expect.objectContaining({ id: arbitrumSepolia.id }));
    expect(window.localStorage.getItem("mabrur.net")).toBe(String(arbitrumSepolia.id));
    expect(switchChain).not.toHaveBeenCalled();
  });

  it("asks a connected wallet to switch chains too", () => {
    on(arbitrum);
    account.isConnected = true;
    account.chain = { id: arbitrum.id };
    render(<NetToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Testnet" }));
    expect(switchChain).toHaveBeenCalledWith({ chainId: arbitrumSepolia.id });
  });

  it("opens on the testnet from a ?net=testnet link", () => {
    window.history.replaceState(null, "", "/app/jamaah?net=testnet");
    on(arbitrum);
    render(<NetToggle />);
    expect(setTargetNetwork).toHaveBeenCalledWith(expect.objectContaining({ id: arbitrumSepolia.id }));
  });

  it("restores the remembered network", () => {
    window.localStorage.setItem("mabrur.net", String(arbitrumSepolia.id));
    on(arbitrum);
    render(<NetToggle />);
    expect(setTargetNetwork).toHaveBeenCalledWith(expect.objectContaining({ id: arbitrumSepolia.id }));
  });

  it("is hidden on the local anvil chain", () => {
    on(foundry);
    const { container } = render(<NetToggle />);
    expect(container.innerHTML).toBe("");
  });
});
