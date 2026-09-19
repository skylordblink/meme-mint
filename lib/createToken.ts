import { createFungible } from "@metaplex-foundation/mpl-token-metadata";
import {
  AuthorityType,
  createTokenIfMissing,
  findAssociatedTokenPda,
  mintTokensTo,
  setAuthority,
  setComputeUnitLimit,
  setComputeUnitPrice,
} from "@metaplex-foundation/mpl-toolbox";
import {
  generateSigner,
  none,
  percentAmount,
  some,
  transactionBuilder,
  type Umi,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

export type PriorityLevel = "none" | "standard" | "fast" | "turbo";

// Micro-lamports per compute unit. Real cost is price * COMPUTE_UNIT_LIMIT / 1e6 lamports.
export const PRIORITY_MICRO_LAMPORTS: Record<PriorityLevel, number> = {
  none: 0,
  standard: 100_000,
  fast: 1_000_000,
  turbo: 5_000_000,
};

// Measured on devnet: the creation uses 114k compute units, so 250k leaves a wide margin.
export const COMPUTE_UNIT_LIMIT = 250_000;

// Sizes of the three accounts a new token needs, as created by Token Metadata on devnet.
export const ACCOUNT_BYTES = { mint: 82, metadata: 607, tokenAccount: 165 } as const;

// Flat fee Metaplex charges on token creation. Verified on devnet: it lands in the metadata account.
export const METAPLEX_CREATE_FEE_LAMPORTS = 10_000_000;

const BASE_FEE_LAMPORTS = 5000 * 2; // fee payer + mint keypair signatures

export type RentLamports = { mint: number; metadata: number; tokenAccount: number };

// Rent at the rates measured on devnet. Shown until the live numbers arrive from the RPC.
export const FALLBACK_RENT: RentLamports = { mint: 1_066_800, metadata: 3_733_800, tokenAccount: 1_488_440 };

/** Reads the current rent-exempt minimums from the network, since Solana can change the rate. */
export async function fetchRent(umi: Pick<Umi, "rpc">): Promise<RentLamports> {
  const [mint, metadata, tokenAccount] = await Promise.all([
    umi.rpc.getRent(ACCOUNT_BYTES.mint),
    umi.rpc.getRent(ACCOUNT_BYTES.metadata),
    umi.rpc.getRent(ACCOUNT_BYTES.tokenAccount),
  ]);
  return {
    mint: Number(mint.basisPoints),
    metadata: Number(metadata.basisPoints),
    tokenAccount: Number(tokenAccount.basisPoints),
  };
}

export function estimateCostLamports(priority: PriorityLevel, rent: RentLamports = FALLBACK_RENT) {
  const rentTotal = rent.mint + rent.metadata + rent.tokenAccount;
  const priorityFee = Math.ceil((PRIORITY_MICRO_LAMPORTS[priority] * COMPUTE_UNIT_LIMIT) / 1_000_000);
  return {
    rent: rentTotal,
    protocol: METAPLEX_CREATE_FEE_LAMPORTS,
    network: BASE_FEE_LAMPORTS,
    priority: priorityFee,
    total: rentTotal + METAPLEX_CREATE_FEE_LAMPORTS + BASE_FEE_LAMPORTS + priorityFee,
  };
}

/** Small cushion so a wallet that is a hair short is caught before signing, not after. */
export const BALANCE_BUFFER_LAMPORTS = 200_000;

export type CreateTokenParams = {
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  /** Whole tokens (before decimals). */
  supply: bigint;
  revokeMint: boolean;
  revokeFreeze: boolean;
  immutable: boolean;
  priority?: PriorityLevel;
};

export type CreateTokenResult = {
  mint: string;
  signature: string;
  tokenAccount: string;
  transactions: number;
};

/**
 * Creates a standard SPL token with Metaplex metadata, mints the full supply to the
 * connected wallet, and optionally revokes the mint and freeze authorities.
 * The signer is whatever identity is installed on `umi` (a wallet adapter in the browser,
 * a keypair in tests). No private key is ever handled by this function.
 */
export async function createToken(umi: Umi, p: CreateTokenParams): Promise<CreateTokenResult> {
  const mint = generateSigner(umi);
  const owner = umi.identity.publicKey;
  const token = findAssociatedTokenPda(umi, { mint: mint.publicKey, owner });
  const priority = PRIORITY_MICRO_LAMPORTS[p.priority ?? "none"];

  let builder = transactionBuilder().add(setComputeUnitLimit(umi, { units: COMPUTE_UNIT_LIMIT }));
  if (priority > 0) builder = builder.add(setComputeUnitPrice(umi, { microLamports: priority }));

  builder = builder
    .add(
      createFungible(umi, {
        mint,
        name: p.name,
        symbol: p.symbol,
        uri: p.uri,
        sellerFeeBasisPoints: percentAmount(0),
        decimals: some(p.decimals),
        isMutable: !p.immutable,
      }),
    )
    .add(createTokenIfMissing(umi, { mint: mint.publicKey, owner, token }))
    .add(
      mintTokensTo(umi, {
        mint: mint.publicKey,
        token,
        amount: p.supply * 10n ** BigInt(p.decimals),
      }),
    );

  if (p.revokeMint) {
    builder = builder.add(
      setAuthority(umi, {
        owned: mint.publicKey,
        owner: umi.identity,
        authorityType: AuthorityType.MintTokens,
        newAuthority: none(),
      }),
    );
  }
  if (p.revokeFreeze) {
    builder = builder.add(
      setAuthority(umi, {
        owned: mint.publicKey,
        owner: umi.identity,
        authorityType: AuthorityType.FreezeAccount,
        newAuthority: none(),
      }),
    );
  }

  // Parts are sent one after another and each is confirmed before the next, so order is preserved.
  const parts = builder.fitsInOneTransaction(umi) ? [builder] : builder.unsafeSplitByTransactionSize(umi);

  let lastSignature: Uint8Array = new Uint8Array();
  for (const part of parts) {
    const res = await part.sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });
    if (res.result.value.err) throw new Error("The transaction was rejected by the network.");
    lastSignature = res.signature;
  }

  return {
    mint: mint.publicKey.toString(),
    signature: base58.deserialize(lastSignature)[0],
    tokenAccount: token[0].toString(),
    transactions: parts.length,
  };
}

/** Turns wallet and RPC errors into one plain sentence a non-technical user can act on. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.toLowerCase();
  if (m.includes("user rejected") || m.includes("rejected the request") || m.includes("declined"))
    return "You cancelled the request in your wallet. Nothing was created and nothing was charged.";
  if (m.includes("insufficient") || m.includes("0x1") || m.includes("attempt to debit"))
    return "Your wallet doesn't have enough SOL for this. Add a little more SOL and try again.";
  if (m.includes("blockhash") || m.includes("expired"))
    return "The network was slow and the transaction expired. Nothing was charged. Try again, or pick a faster priority.";
  if (m.includes("403") || m.includes("forbidden"))
    return "The RPC endpoint refused the request. Solana's free public RPC blocks browsers on mainnet. Set NEXT_PUBLIC_MAINNET_RPC_URL to your own RPC (free at helius.dev) and try again.";
  if (m.includes("429") || m.includes("too many requests"))
    return "The RPC endpoint is rate limiting requests. Set a dedicated RPC URL (see the README) and try again.";
  if (m.includes("wallet not connected") || m.includes("wallet"))
    return "Your wallet isn't connected. Connect it and try again.";
  return msg.length > 220 ? `${msg.slice(0, 220)}...` : msg;
}
