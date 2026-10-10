"use client";

import { useEffect } from "react";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { useAccount, useSwitchChain } from "wagmi";
import { useT } from "~~/hooks/mabrur/useLang";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { useGlobalState } from "~~/services/store/store";
import { NETWORKS_EXTRA_DATA } from "~~/utils/scaffold-eth";

const KEY = "mabrur.net";
const NETS = [
  { id: arbitrum.id, label: "Mainnet", param: "mainnet" },
  { id: arbitrumSepolia.id, label: "Testnet", param: "testnet" },
] as const;

/**
 * The "Mainnet | Testnet" pill: Arbitrum One (the judged deployment) or Arbitrum Sepolia (free faucet ETH, so anyone
 * can book and refund). `?net=testnet` in a link picks the testnet; the choice is remembered in this browser. With a
 * wallet connected, the wallet is asked to switch too (useTargetNetwork follows the wallet's chain).
 */
export const NetToggle = () => {
  const { targetNetwork } = useTargetNetwork();
  const setTargetNetwork = useGlobalState(({ setTargetNetwork }) => setTargetNetwork);
  const { isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const t = useT();

  const select = (id: number, remember = true) => {
    const net = scaffoldConfig.targetNetworks.find(n => n.id === id);
    if (!net) return;
    setTargetNetwork({ ...net, ...NETWORKS_EXTRA_DATA[net.id] });
    if (remember) {
      try {
        window.localStorage.setItem(KEY, String(id));
      } catch {
        /* storage unavailable: the choice lasts for this page only */
      }
    }
    if (isConnected && chain?.id !== id) switchChain({ chainId: id });
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
    if (id && id !== targetNetwork.id && NETS.some(n => n.id === id)) select(id, fromParam !== undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
