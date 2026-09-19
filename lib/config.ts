export type Network = "mainnet-beta" | "devnet";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "MemeMint";

// NEXT_PUBLIC_* values must be read with static property access so Next can inline them.
export const RPC_URLS: Record<Network, string> = {
  "mainnet-beta":
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL || "https://api.mainnet-beta.solana.com",
  devnet: process.env.NEXT_PUBLIC_DEVNET_RPC_URL || "https://api.devnet.solana.com",
};

// Solana's free public mainnet RPC answers 403 to browsers, so mainnet needs the owner's own endpoint.
export const NEEDS_MAINNET_RPC = !process.env.NEXT_PUBLIC_MAINNET_RPC_URL;

export const DEFAULT_NETWORK: Network =
  process.env.NEXT_PUBLIC_DEFAULT_NETWORK === "devnet" ? "devnet" : "mainnet-beta";

const clusterQuery = (n: Network) => (n === "devnet" ? "?cluster=devnet" : "");

export const tokenUrl = (mint: string, n: Network) =>
  `https://solscan.io/token/${mint}${clusterQuery(n)}`;

export const txUrl = (sig: string, n: Network) =>
  `https://solscan.io/tx/${sig}${clusterQuery(n)}`;
