"use client";

import type { Adapter } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletProvider, ConnectionProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_NETWORK, RPC_URLS, type Network } from "@/lib/config";
import { DevWalletAdapter } from "@/lib/devWallet";

import "@solana/wallet-adapter-react-ui/styles.css";

type NetworkCtx = { network: Network; setNetwork: (n: Network) => void; rpcUrl: string };
const NetworkContext = createContext<NetworkCtx>({
  network: DEFAULT_NETWORK,
  setNetwork: () => {},
  rpcUrl: RPC_URLS[DEFAULT_NETWORK],
});
export const useNetwork = () => useContext(NetworkContext);

const STORAGE_KEY = "mm.network";
const EVENT = "mm-network-changed";

// Falls back to memory when localStorage is blocked (private windows), so the toggle still works.
let inMemory: Network | null = null;

function readNetwork(): Network {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "devnet" || saved === "mainnet-beta") return saved;
  } catch {}
  return inMemory ?? DEFAULT_NETWORK;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function buildWallets(): Adapter[] {
  // Listing Phantom and Solflare means the wallet popup always offers an install link when none is detected.
  // Other Wallet Standard wallets (Backpack and others) are still picked up automatically.
  const wallets: Adapter[] = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

  // Local testing only: a throwaway devnet key from .env.local. Never active in a production build.
  const secret = process.env.NEXT_PUBLIC_DEV_WALLET_SECRET;
  if (process.env.NODE_ENV !== "production" && secret) {
    try {
      wallets.unshift(new DevWalletAdapter(Uint8Array.from(JSON.parse(secret))));
    } catch {}
  }
  return wallets;
}

function writeNetwork(n: Network) {
  inMemory = n;
  try {
    localStorage.setItem(STORAGE_KEY, n);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export default function Providers({ children }: { children: ReactNode }) {
  // Server render and first client render use the default, then the saved choice is applied.
  const network = useSyncExternalStore(subscribe, readNetwork, () => DEFAULT_NETWORK);

  const wallets = useMemo(() => buildWallets(), []);

  const value = useMemo<NetworkCtx>(
    () => ({ network, rpcUrl: RPC_URLS[network], setNetwork: writeNetwork }),
    [network],
  );

  return (
    <NetworkContext.Provider value={value}>
      <ConnectionProvider endpoint={value.rpcUrl}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  );
}
