import { act, renderHook } from "@testing-library/react";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useGlobalState } from "~~/services/store/store";

const account = { chain: undefined as { id: number } | undefined };
vi.mock("wagmi", () => ({ useAccount: () => account }));

const appChain = () => useGlobalState.getState().targetNetwork.id;

describe("useTargetNetwork follows the wallet only when the wallet's chain changes", () => {
  it("keeps a Mainnet | Testnet choice while the wallet stays on the other chain, then follows a wallet switch", () => {
    // wallet connects on the testnet: the app follows it
    account.chain = { id: arbitrumSepolia.id };
    const { rerender } = renderHook(() => useTargetNetwork());
    expect(appChain()).toBe(arbitrumSepolia.id);

    // the toggle picks the mainnet; the wallet has not switched (yet, or the user declined): the choice sticks
    act(() => useGlobalState.getState().setTargetNetwork({ ...arbitrum }));
    rerender();
    expect(appChain()).toBe(arbitrum.id);

    // a component that mounts later does not snap the app back to the wallet's chain either
    renderHook(() => useTargetNetwork());
    expect(appChain()).toBe(arbitrum.id);

    // the wallet itself switches (to the mainnet, then back to the testnet): the app follows each switch
    account.chain = { id: arbitrum.id };
    rerender();
    expect(appChain()).toBe(arbitrum.id);
    account.chain = { id: arbitrumSepolia.id };
    rerender();
    expect(appChain()).toBe(arbitrumSepolia.id);
  });
});
