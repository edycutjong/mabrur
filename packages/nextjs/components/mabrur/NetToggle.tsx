"use client";

import { useEffect, useRef } from "react";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { useAccount, useSwitchChain } from "wagmi";
import { useT } from "~~/hooks/mabrur/useLang";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useGlobalState } from "~~/services/store/store";
import { NETWORKS_EXTRA_DATA } from "~~/utils/scaffold-eth";

const KEY = "mabrur.net";
const NETS = [
  { id: arbitrum.id, chain: arbitrum, label: "Mainnet", param: "mainnet" },
  { id: arbitrumSepolia.id, chain: arbitrumSepolia, label: "Testnet", param: "testnet" },
] as const;

/**
 * The "Mainnet | Testnet" pill: Arbitrum One (the judged deployment) or Arbitrum Sepolia (free faucet ETH, so anyone
 * can book and refund). `?net=testnet` in a link picks the testnet; the choice is remembered in this browser. With a
 * wallet connected, the wallet is asked to switch too: useTargetNetwork follows the wallet's chain, so a wallet that
 * reconnects on the other network after load is asked once to switch to the wanted one (declining keeps the wallet's).
 */
export const NetToggle = () => {
  const { targetNetwork } = useTargetNetwork();
  const setTargetNetwork = useGlobalState(({ setTargetNetwork }) => setTargetNetwork);
  const { isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const t = useT();
  // The network a link or the remembered choice asked for, until a connected wallet has been asked to switch to it.
  const wanted = useRef<number | undefined>(undefined);

  const select = (id: number, remember = true) => {
    const net = NETS.find(n => n.id === id)!.chain;
    setTargetNetwork({ ...net, ...NETWORKS_EXTRA_DATA[net.id] });
    if (remember) {
      try {
        window.localStorage.setItem(KEY, String(id));
      } catch {
        /* storage unavailable: the choice lasts for this page only */
      }
    }
    if (isConnected && chain?.id !== id) {
      switchChain({ chainId: id });
      wanted.current = undefined; // asked already: the reconnect effect below must not ask again
    }
  };

  // First paint is the mainnet (server render); a link's ?net= or the remembered choice applies right after.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("net");
    const fromParam = NETS.find(n => n.param === param)?.id;
    let stored: number | undefined;
    try {
      stored = Number(window.localStorage.getItem(KEY)) || undefined;
    } catch {
      stored = undefined;
    }
    const id = fromParam ?? stored;
    if (id && NETS.some(n => n.id === id)) {
      wanted.current = id;
      if (id !== targetNetwork.id) select(id, fromParam !== undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A wallet that (re)connects after load on the other network would pull the app back to it: ask it once to switch.
  useEffect(() => {
    if (!isConnected || !chain || wanted.current === undefined) return;
    if (chain.id !== wanted.current && NETS.some(n => n.id === chain.id)) switchChain({ chainId: wanted.current });
    wanted.current = undefined;
  }, [isConnected, chain, switchChain]);

  if (!NETS.some(n => n.id === targetNetwork.id)) return null;
  return (
    <span
      className="mb-net"
      role="group"
      aria-label={t("Jaringan: mainnet atau testnet", "Network: mainnet or testnet")}
      data-testid="net-toggle"
    >
      {NETS.map(n => (
        <button
          key={n.id}
          type="button"
          aria-pressed={targetNetwork.id === n.id}
          onClick={() => select(n.id)}
          title={
            n.id === arbitrum.id
              ? "Arbitrum One"
              : t("Arbitrum Sepolia · ETH faucet gratis", "Arbitrum Sepolia · free faucet ETH")
          }
        >
          {n.label}
        </button>
      ))}
    </span>
  );
};
