import * as chains from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  burnerWalletMode: "localNetworksOnly" | "allNetworks" | "disabled";
};

export type ScaffoldConfig = BaseConfig;

export const DEFAULT_ALCHEMY_API_KEY = "IZYEU2cWBgnFmgiTAgpWD";

// NEXT_PUBLIC_LOCAL_CHAIN=true puts the local anvil chain first (reads go there without a wallet, burner wallet on);
// the default is Arbitrum One first. Arbitrum Sepolia is the testnet for outside users (free faucet ETH); the header's
// Mainnet | Testnet toggle (components/mabrur/NetToggle.tsx) switches between the two.
const localFirst = process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true";

const scaffoldConfig = {
  // The networks on which your DApp is live (the first one is used for reads when no wallet is connected)
  targetNetworks: localFirst
    ? ([chains.foundry, chains.arbitrum, chains.arbitrumSepolia] as const)
    : ([chains.arbitrum, chains.arbitrumSepolia, chains.foundry] as const),
  // The interval at which your front-end polls the RPC servers for new data (it has no effect if you only target the local network (default is 4000))
  pollingInterval: 3000,
  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || DEFAULT_ALCHEMY_API_KEY,
  // If you want to use a different RPC for a specific network, you can add it here.
  // The key is the chain ID, and the value is the HTTP RPC URL
  rpcOverrides: {
    // Example:
    // [chains.mainnet.id]: "https://mainnet.rpc.buidlguidl.com",
  },
  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  // Configure Burner Wallet visibility:
  // - "localNetworksOnly": only show when all target networks are local (hardhat/anvil)
  // - "allNetworks": show on any configured target networks
  // - "disabled": completely disable
  burnerWalletMode: (localFirst ? "allNetworks" : "localNetworksOnly") as BaseConfig["burnerWalletMode"],
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
