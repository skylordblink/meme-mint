"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  BALANCE_BUFFER_LAMPORTS,
  FALLBACK_RENT,
  createToken,
  estimateCostLamports,
  fetchRent,
  friendlyError,
  type CreateTokenResult,
  type PriorityLevel,
  type RentLamports,
} from "@/lib/createToken";
import { formatSol, formatSupply, lamportsToSol, shortAddr, tick } from "@/lib/format";
import { saveToken, useSavedTokens } from "@/lib/history";
import { makeUmi } from "@/lib/umi";
import { LIMITS, parseSupply, validateForm, type FormErrors, type FormValues } from "@/lib/validate";
import { NEEDS_MAINNET_RPC, tokenUrl, txUrl, type Network } from "@/lib/config";
import Coin from "./Coin";
import { useNetwork } from "./Providers";
import { CopyButton, Field, Seal, Step } from "./ui";

type Stage = "idle" | "uploading" | "signing" | "done";
type Struck = CreateTokenResult & { name: string; symbol: string; network: Network };

const INITIAL: FormValues = {
  name: "",
  symbol: "",
  decimals: 6,
  supply: "1000000000",
  description: "",
  website: "",
  twitter: "",
  telegram: "",
  revokeMint: true,
  revokeFreeze: true,
  immutable: true,
};

const SUPPLY_PRESETS = ["1000000", "100000000", "1000000000", "1000000000000"];

const SPEEDS: { id: PriorityLevel; label: string }[] = [
  { id: "standard", label: "Standard" },
  { id: "fast", label: "Fast" },
  { id: "turbo", label: "Turbo" },
];

const netLabel = (n: Network) => (n === "devnet" ? "Devnet" : "Mainnet");

// This app takes no cut. The line stays on the receipt so it is clear nothing extra is added.
const APP_FEE_LABEL = "App fee";

export default function TokenCreator() {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const { network, rpcUrl } = useNetwork();

  const [v, setV] = useState<FormValues>(INITIAL);
  const [image, setImage] = useState<File | null>(null);
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [speed, setSpeed] = useState<PriorityLevel>("standard");
  const [stage, setStage] = useState<Stage>("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<Struck | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rent, setRent] = useState<RentLamports>(FALLBACK_RENT);
  const history = useSavedTokens();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Rent is set by the network and can change, so read the live numbers for the chosen network.
  useEffect(() => {
    let cancelled = false;
    fetchRent(makeUmi(rpcUrl))
      .then((r) => {
        if (!cancelled) setRent(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rpcUrl]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const pickImage = (file: File | null) => {
    setImage(file);
    setErrors((p) => ({ ...p, image: undefined }));
  };

  const priority: PriorityLevel = network === "devnet" ? "none" : speed;
  const cost = useMemo(() => estimateCostLamports(priority, rent), [priority, rent]);
  const busy = stage === "uploading" || stage === "signing";
  const struck = stage === "done" && result !== null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);

    const errs = validateForm(v, image);
    setErrors(errs);
    if (Object.keys(errs).length > 0 || !image) {
      document.querySelector("[aria-invalid='true'], .err")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!wallet.connected || !wallet.publicKey) {
      setVisible(true);
      return;
    }

    try {
      setStage("uploading");
      const body = new FormData();
      body.append("image", image);
      body.append("name", v.name.trim());
      body.append("symbol", v.symbol.trim());
      body.append("description", v.description.trim());
      body.append("website", v.website.trim());
      body.append("twitter", v.twitter.trim());
      body.append("telegram", v.telegram.trim());
      const up = await fetch("/api/upload", { method: "POST", body });
      const upJson = await up.json().catch(() => ({}));
      if (!up.ok || !upJson.uri) throw new Error(upJson.error || "Could not upload the logo and metadata.");

      const umi = makeUmi(rpcUrl).use(walletAdapterIdentity(wallet));
      const balance = await umi.rpc.getBalance(umi.identity.publicKey);
      if (balance.basisPoints < BigInt(cost.total + BALANCE_BUFFER_LAMPORTS)) {
        throw new Error(
          `Your wallet has ${formatSol(lamportsToSol(balance.basisPoints))} SOL and this needs about ${formatSol(lamportsToSol(cost.total))} SOL. Insufficient funds.`,
        );
      }

      setStage("signing");
      const created = await createToken(umi, {
        name: v.name.trim(),
        symbol: v.symbol.trim(),
        uri: upJson.uri,
        decimals: v.decimals,
        supply: parseSupply(v.supply) as bigint,
        revokeMint: v.revokeMint,
        revokeFreeze: v.revokeFreeze,
        immutable: v.immutable,
        priority,
      });

      setResult({ ...created, name: v.name.trim(), symbol: v.symbol.trim(), network });
      saveToken({
        mint: created.mint,
        name: v.name.trim(),
        symbol: v.symbol.trim(),
        network,
        signature: created.signature,
        createdAt: Date.now(),
      });
      setStage("done");
    } catch (err) {
      setFailure(friendlyError(err));
      setStage("idle");
    }
  }

  function reset() {
    setV(INITIAL);
    setImage(null);
    setErrors({});
    setResult(null);
    setFailure(null);
    setStage("idle");
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (!busy) pickImage(e.dataTransfer.files?.[0] ?? null);
  }

  const supplyDisplay = formatSupply(v.supply) || "0";
  const inputProps = (key: keyof FormValues) => ({
    id: key,
    "aria-invalid": errors[key] ? (true as const) : undefined,
    disabled: busy,
  });

  return (
    <>
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Coin and receipt: first on phones, sticky column on desktop */}
        <div className="contents lg:col-start-2 lg:row-start-1 lg:block lg:space-y-10 lg:self-start lg:sticky lg:top-6">
          <div className="sheet coin-rings order-1 p-6">
            <div className="mb-5 flex items-center justify-between">
              <span className="eyebrow">The coin</span>
              <span className={`chip ${network === "devnet" ? "!border-hot !bg-hot/15" : ""}`}>{netLabel(network)}</span>
            </div>

            <Coin name={v.name} symbol={v.symbol} image={preview} struck={struck} />

            <div className="mt-7 text-center">
              <p className="font-display truncate text-[1.7rem] font-extrabold leading-tight">{v.name.trim() || "Token name"}</p>
              <p className="mt-1 font-mono text-[0.8rem] font-bold tracking-wide">
                {tick(v.symbol.trim() || "SYMBOL")} <span className="text-muted">/</span> {supplyDisplay} <span className="text-muted">supply</span>
              </p>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-x-3 gap-y-2.5">
              <span className={`stamp ${v.revokeMint ? "stamp-on" : "stamp-off"}`} style={{ ["--r" as string]: "-3deg" }}>
                {v.revokeMint ? "Mint sealed" : "Mint open"}
              </span>
              <span className={`stamp ${v.revokeFreeze ? "stamp-on" : "stamp-off"}`} style={{ ["--r" as string]: "2deg" }}>
                {v.revokeFreeze ? "Freeze sealed" : "Freeze open"}
              </span>
              <span className={`stamp ${v.immutable ? "stamp-on" : "stamp-off"}`} style={{ ["--r" as string]: "-1.5deg" }}>
                {v.immutable ? "Meta locked" : "Meta editable"}
              </span>
            </div>
          </div>

          <div className="receipt-wrap order-3 pb-3">
            <div className="receipt">
              <p className="eyebrow text-center">Mint receipt</p>
              <div className="mt-4 space-y-2.5">
                <div className="leader">
                  <span>Account rent</span>
                  <i />
                  <span>{formatSol(lamportsToSol(cost.rent))}</span>
                </div>
                <div className="leader">
                  <span>Metaplex fee</span>
                  <i />
                  <span>{formatSol(lamportsToSol(cost.protocol))}</span>
                </div>
                <div className="leader">
                  <span>Network fee</span>
                  <i />
                  <span>{formatSol(lamportsToSol(cost.network))}</span>
                </div>
                {cost.priority > 0 && (
                  <div className="leader">
                    <span>Priority fee</span>
                    <i />
                    <span>{formatSol(lamportsToSol(cost.priority))}</span>
                  </div>
                )}
                <div className="leader">
                  <span>{APP_FEE_LABEL}</span>
                  <i />
                  <span>0.0000</span>
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t-2 border-dashed border-ink pt-3">
                <span className="font-display text-xl font-extrabold">Total</span>
                <span className="font-display text-[2rem] font-extrabold leading-none">
                  {formatSol(lamportsToSol(cost.total))} <span className="font-mono text-sm font-bold">SOL</span>
                </span>
              </div>
              <p className="hint">
                Paid from your connected wallet. Rent is the deposit Solana holds for the three accounts your token needs. Metaplex charges a flat fee to create token metadata.
              </p>
              <div className="barcode mt-4" aria-hidden />
            </div>
          </div>
        </div>

        {/* Form, or the certificate once the coin is struck */}
        {struck && result ? (
          <Certificate result={result} onReset={reset} />
        ) : (
          <form onSubmit={onSubmit} className="sheet order-2 space-y-10 p-5 sm:p-8 lg:col-start-1 lg:row-start-1" noValidate>
            <section>
              <Step n="01" title="Identity" note="What people will see" />
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-[1fr_170px]">
                  <Field label="Name" htmlFor="name" error={errors.name}>
                    <input {...inputProps("name")} className="input" placeholder="Doge Rocket" maxLength={40} value={v.name} onChange={(e) => set("name", e.target.value)} />
                  </Field>
                  <Field label="Symbol" htmlFor="symbol" error={errors.symbol} hint="Ticker only, no $ needed">
                    <input {...inputProps("symbol")} className="input font-mono uppercase" placeholder="DROCKET" maxLength={12} value={v.symbol} onChange={(e) => set("symbol", e.target.value.toUpperCase().replace(/^[$\s]+/, ""))} />
                  </Field>
                </div>
                <Field label="Description" htmlFor="description" error={errors.description} hint={`${v.description.length} / ${LIMITS.descriptionMax}`}>
                  <textarea {...inputProps("description")} className="input min-h-24 resize-y" placeholder="What is this coin about?" value={v.description} onChange={(e) => set("description", e.target.value)} />
                </Field>
              </div>
            </section>

            <section>
              <Step n="02" title="Supply" note="Minted to your wallet" />
              <div className="grid gap-5 sm:grid-cols-[1fr_170px]">
                <Field label="Total supply" htmlFor="supply" error={errors.supply} hint={`${supplyDisplay} tokens`}>
                  <input {...inputProps("supply")} className="input font-mono" inputMode="numeric" value={v.supply} onChange={(e) => set("supply", e.target.value.replace(/[^\d,]/g, ""))} />
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {SUPPLY_PRESETS.map((p) => (
                      <button key={p} type="button" disabled={busy} className="chip" onClick={() => set("supply", p)}>
                        {formatSupply(p)}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Decimals" htmlFor="decimals" error={errors.decimals} hint="6 is the usual for memecoins">
                  <input {...inputProps("decimals")} className="input font-mono" type="number" min={0} max={9} value={v.decimals} onChange={(e) => set("decimals", e.target.value === "" ? NaN : Number(e.target.value))} />
                </Field>
              </div>
            </section>

            <section>
              <Step n="03" title="Face" note="Stamped on the coin" />
              <label
                htmlFor="logo"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex cursor-pointer items-center gap-5 rounded-xl border-2 border-dashed p-4 transition-colors ${
                  errors.image ? "border-hot bg-hot/10" : dragging ? "border-ink bg-lime" : "border-ink bg-paperhi hover:bg-lime/40"
                }`}
              >
                <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-ink bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {preview ? <img src={preview} alt="Logo preview" className="h-full w-full object-cover" /> : <span className="font-display text-3xl font-extrabold">+</span>}
                </span>
                <span>
                  <span className="block font-display text-lg font-extrabold leading-tight">{image ? image.name : "Drop a logo or click to browse"}</span>
                  <span className="mt-1 block text-[0.8rem] text-muted">PNG, JPG, WEBP or GIF, under 1.5 MB. Square works best.</span>
                </span>
                <input
                  id="logo"
                  type="file"
                  accept={LIMITS.imageTypes.join(",")}
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                />
              </label>
              {errors.image && <p className="err">{errors.image}</p>}
            </section>

            <section>
              <Step n="04" title="Links" note="Optional" />
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="Website" htmlFor="website" error={errors.website}>
                  <input {...inputProps("website")} className="input" placeholder="https://" value={v.website} onChange={(e) => set("website", e.target.value)} />
                </Field>
                <Field label="X / Twitter" htmlFor="twitter" error={errors.twitter}>
                  <input {...inputProps("twitter")} className="input" placeholder="https://x.com/..." value={v.twitter} onChange={(e) => set("twitter", e.target.value)} />
                </Field>
                <Field label="Telegram" htmlFor="telegram" error={errors.telegram}>
                  <input {...inputProps("telegram")} className="input" placeholder="https://t.me/..." value={v.telegram} onChange={(e) => set("telegram", e.target.value)} />
                </Field>
              </div>
            </section>

            <section>
              <Step n="05" title="Seals" note="One way. Cannot be undone" />
              <div className="space-y-3">
                <Seal checked={v.revokeMint} onChange={(x) => set("revokeMint", x)} title="Seal the mint" description="Nobody can ever create more of this token. Buyers look for this first." />
                <Seal checked={v.revokeFreeze} onChange={(x) => set("revokeFreeze", x)} title="Seal the freeze" description="Nobody can freeze a holder's tokens. Also checked by buyers." />
                <Seal checked={v.immutable} onChange={(x) => set("immutable", x)} title="Lock the metadata" description="Name, symbol and logo are fixed for good. Leave it open if you may change them." onLabel="Locked" offLabel="Editable" />
              </div>
            </section>

            {network === "mainnet-beta" && (
              <section>
                <Step n="06" title="Speed" note="Priority fee" />
                <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Transaction speed">
                  {SPEEDS.map((s) => {
                    const c = estimateCostLamports(s.id, rent).priority;
                    const on = speed === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={busy}
                        onClick={() => setSpeed(s.id)}
                        className={`rounded-xl border-2 border-ink px-3 py-3 text-left transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)] ${
                          on ? "bg-lime shadow-[4px_4px_0_var(--ink)]" : "bg-card"
                        }`}
                      >
                        <span className="block font-display text-base font-extrabold">{s.label}</span>
                        <span className="block font-mono text-[0.7rem] font-semibold text-inksoft">+{formatSol(lamportsToSol(c))} SOL</span>
                      </button>
                    );
                  })}
                </div>
                <p className="hint">A higher speed pays a small priority fee so the transaction lands faster when Solana is busy.</p>
              </section>
            )}

            {network === "mainnet-beta" && NEEDS_MAINNET_RPC && (
              <div className="rounded-xl border-2 border-dashed border-ink bg-lime/30 p-4 text-sm leading-relaxed">
                <p className="font-display text-base font-extrabold">Setup needed for mainnet</p>
                Solana&apos;s free public RPC blocks browsers. Set <code className="font-mono font-bold">NEXT_PUBLIC_MAINNET_RPC_URL</code> to your own RPC URL (free at helius.dev), then restart. Devnet works as is.
              </div>
            )}

            {failure && (
              <div role="alert" className="rounded-xl border-2 border-hot bg-hot/10 p-4 text-sm font-medium">
                {failure}
              </div>
            )}

            <div className="space-y-3">
              <button type="submit" className="btn-strike" disabled={busy}>
                {stage === "uploading"
                  ? "Pinning your logo to IPFS..."
                  : stage === "signing"
                    ? "Approve in your wallet..."
                    : wallet.connected
                      ? `Strike token on ${netLabel(network)}`
                      : "Connect wallet to strike"}
              </button>
              {stage === "signing" && <p className="text-center font-mono text-xs font-semibold">Approve the request in your wallet. It confirms on Solana in a few seconds.</p>}
              {network === "devnet" && <p className="text-center font-mono text-xs font-bold text-[#c2310f]">Devnet is a free test network. Nothing minted here has real value.</p>}
            </div>
          </form>
        )}
      </div>

      {history.length > 0 && (
        <section className="mt-16">
          <div className="mb-4 flex items-end gap-3 border-b-2 border-ink pb-2">
            <h2 className="font-display text-2xl font-extrabold leading-none">Ledger</h2>
            <span className="eyebrow pb-0.5">Coins struck in this browser</span>
          </div>
          <div className="sheet divide-y-2 divide-ink/15 overflow-hidden">
            {history.map((t) => (
              <div key={t.mint} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-extrabold">
                    {t.name} <span className="font-mono text-sm">{tick(t.symbol)}</span>
                    <span className={`chip ml-2 align-middle ${t.network === "devnet" ? "!border-hot !bg-hot/15" : ""}`}>{netLabel(t.network)}</span>
                  </p>
                  <p className="font-mono text-xs text-muted">{shortAddr(t.mint, 6)}</p>
                </div>
                <div className="flex gap-2">
                  <CopyButton value={t.mint} label="Copy mint" />
                  <a className="btn-ghost" href={tokenUrl(t.mint, t.network)} target="_blank" rel="noreferrer">
                    Solscan
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Certificate({ result, onReset }: { result: Struck; onReset: () => void }) {
  return (
    <div className="sheet relative order-2 space-y-7 overflow-hidden p-6 sm:p-10 lg:col-start-1 lg:row-start-1">
      <div className="flex flex-wrap-reverse items-start justify-between gap-x-8 gap-y-5">
        <div className="min-w-[15rem] flex-1">
          <p className="eyebrow">Certificate of minting / {netLabel(result.network)}</p>
          <h2 className="font-display mt-3 break-words text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
            {result.name} <span className="marker">is live.</span>
          </h2>
          <p className="mt-4 max-w-md text-[1.02rem] text-inksoft">
            <span className="font-mono font-bold">{tick(result.symbol)}</span> now exists on Solana and the full supply is sitting in your wallet.
          </p>
        </div>
        <span
          className="stamp-in mr-2 mt-2 shrink-0 rounded-md border-4 border-hot px-4 py-1 font-display text-3xl font-extrabold uppercase tracking-wide text-hot sm:text-4xl"
          aria-hidden
        >
          Struck
        </span>
      </div>

      <div>
        <p className="label">Token address (mint)</p>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-ink bg-ink p-4">
          <code className="min-w-0 flex-1 break-all font-mono text-[0.9rem] font-semibold text-lime">{result.mint}</code>
          <CopyButton value={result.mint} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a className="btn-ghost" href={tokenUrl(result.mint, result.network)} target="_blank" rel="noreferrer">
          View on Solscan
        </a>
        <a className="btn-ghost" href={txUrl(result.signature, result.network)} target="_blank" rel="noreferrer">
          View transaction
        </a>
      </div>

      <div className="rounded-xl border-2 border-dashed border-ink bg-paperhi p-4 text-sm leading-relaxed">
        <p className="font-display text-base font-extrabold">Next step</p>
        To let people trade it, add liquidity on a DEX such as Raydium or Meteora. Wallets can take a minute to show the logo.
      </div>

      <button type="button" className="btn-strike" onClick={onReset}>
        Strike another coin
      </button>
    </div>
  );
}
