import { wagmiConnectors } from "./wagmiConnectors";
import { Chain, createClient, fallback, http as viemHttp } from "viem";
import { arbitrum, arbitrumSepolia, hardhat, mainnet } from "viem/chains";
import { createConfig } from "wagmi";
import scaffoldConfig, { DEFAULT_ALCHEMY_API_KEY, ScaffoldConfig } from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

const { targetNetworks } = scaffoldConfig;

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
export const enabledChains = targetNetworks.find((network: Chain) => network.id === 1)
  ? targetNetworks
  : ([...targetNetworks, mainnet] as const);

// Keyless public RPCs per chain, tried in order by viem's fallback transport (no secret in the tree). The first one is the
// most capable (Arbitrum's own node serves wide eth_getLogs ranges for the passbook history); the others serve every
// read (booking, regulatorView, simulateContract) when it is slow or rate-limited. The shared Scaffold-ETH default
// Alchemy key, when no project key is set, only ever comes last.
export const PUBLIC_RPCS: Record<number, string[]> = {
  [arbitrum.id]: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one-rpc.publicnode.com",
    "https://arbitrum.drpc.org",
    "https://arbitrum-one.public.blastapi.io",
  ],
  [arbitrumSepolia.id]: [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia-rpc.publicnode.com",
    "https://arbitrum-sepolia.drpc.org",
  ],
};

export const wagmiConfig = createConfig({
  chains: enabledChains,
  connectors: wagmiConnectors(),
  ssr: true,
  client: ({ chain }) => {
    // JSON-RPC batching: the reads a screen fires together (booking + refundable per row) share one HTTP request
    const http = (url?: string) => viemHttp(url, { batch: true });
    const mainnetFallbackWithDefaultRPC = [http("https://mainnet.rpc.buidlguidl.com")];
    const publicRpcs = PUBLIC_RPCS[chain.id];
    let rpcFallbacks = [
      ...(chain.id === mainnet.id ? mainnetFallbackWithDefaultRPC : []),
      ...(publicRpcs ? publicRpcs.map(url => http(url)) : [http()]),
    ];
    const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id];
    if (rpcOverrideUrl) {
      rpcFallbacks = [http(rpcOverrideUrl), ...rpcFallbacks];
    } else {
      const alchemyHttpUrl = getAlchemyHttpUrl(chain.id);
      if (alchemyHttpUrl) {
        const isUsingDefaultKey = scaffoldConfig.alchemyApiKey === DEFAULT_ALCHEMY_API_KEY;
        rpcFallbacks = isUsingDefaultKey
          ? [...rpcFallbacks, http(alchemyHttpUrl)]
          : [http(alchemyHttpUrl), ...rpcFallbacks];
      }
    }
    return createClient({
      chain,
      transport: fallback(rpcFallbacks),
      ...(chain.id !== (hardhat as Chain).id ? { pollingInterval: scaffoldConfig.pollingInterval } : {}),
    });
  },
});
