"use client";

import dynamic from "next/dynamic";
import { APP_NAME, type Network } from "@/lib/config";
import { useNetwork } from "./Providers";

// The wallet button renders differently on server and client, so load it client-side only.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-[42px] w-36 rounded-[10px] border-2 border-ink/20 bg-paperhi" /> },
);

const NETWORKS: { id: Network; label: string }[] = [
  { id: "mainnet-beta", label: "Mainnet" },
  { id: "devnet", label: "Devnet" },
];

function Mark() {
  return (
    <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="19" fill="#14120e" />
      <circle cx="20" cy="20" r="16.5" fill="none" stroke="#c8f43a" strokeWidth="2.6" strokeDasharray="1.6 2.3" />
      <circle cx="20" cy="20" r="10" fill="#ece4cf" />
      <path d="M14.5 24.5V15.5l5.5 6 5.5-6v9" fill="none" stroke="#14120e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Header() {
  const { network, setNetwork } = useNetwork();

  return (
    <header>
      {network === "devnet" && (
        <div className="bg-hot px-4 py-1.5 text-center font-mono text-[0.7rem] font-bold uppercase tracking-[0.16em] text-ink">
          Test mode / Devnet / tokens made here have no real value
        </div>
      )}
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Mark />
          <span className="font-display text-2xl font-extrabold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex overflow-hidden rounded-[10px] border-2 border-ink bg-card" role="group" aria-label="Network">
            {NETWORKS.map((n) => {
              const active = network === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setNetwork(n.id)}
                  aria-pressed={active}
                  className={`px-3.5 py-2.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] transition-colors ${
                    active ? (n.id === "devnet" ? "bg-hot text-ink" : "bg-ink text-lime") : "text-ink hover:bg-lime"
                  }`}
                >
                  {n.label}
                </button>
              );
            })}
          </div>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
