/**
 * End-to-end test of the token creation logic on Solana devnet, using a throwaway keypair
 * instead of a browser wallet. It runs the exact same createToken() the UI calls, then reads
 * the result back from the chain and asserts on it.
 *
 * Run:  npm run test:devnet
 * Optional: DEVNET_RPC=<your rpc>  and  DEVNET_SECRET=<base58 secret key of an already funded devnet wallet>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { fetchToken, findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox";
import { generateSigner, isSome, keypairIdentity, sol } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { createToken, estimateCostLamports, fetchRent } from "../lib/createToken";
import { makeUmi } from "../lib/umi";

const RPC = process.env.DEVNET_RPC || "https://api.devnet.solana.com";
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const KEY_FILE = path.join(__dirname, ".devnet-key.json");

async function fund(umi: ReturnType<typeof makeUmi>) {
  for (const amount of [1, 0.5]) {
    try {
      await umi.rpc.airdrop(umi.identity.publicKey, sol(amount));
      const bal = await umi.rpc.getBalance(umi.identity.publicKey);
      if (bal.basisPoints > 0n) return true;
    } catch (e) {
      console.log(`airdrop of ${amount} SOL failed: ${(e as Error).message.slice(0, 80)}`);
    }
  }
  return false;
}

async function main() {
  const umi = makeUmi(RPC);
  // Reuse one throwaway wallet between runs so it only ever needs funding once.
  if (process.env.DEVNET_SECRET) {
    umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(base58.serialize(process.env.DEVNET_SECRET))));
  } else if (existsSync(KEY_FILE)) {
    umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(JSON.parse(readFileSync(KEY_FILE, "utf8"))))));
  } else {
    const signer = generateSigner(umi);
    writeFileSync(KEY_FILE, JSON.stringify(Array.from(signer.secretKey)));
    umi.use(keypairIdentity(signer));
  }
  console.log("Test wallet:", umi.identity.publicKey.toString());

  const before = await umi.rpc.getBalance(umi.identity.publicKey);
  if (before.basisPoints < 100_000_000n && !(await fund(umi))) {
    console.log("\nThe devnet faucet is rate limited. Send this wallet 1 devnet SOL and re-run:");
    console.log(`  Address: ${umi.identity.publicKey.toString()}`);
    console.log("  Faucet:  https://faucet.solana.com  (choose Devnet)");
    process.exit(2);
  }
  const start = await umi.rpc.getBalance(umi.identity.publicKey);
  console.log("Balance:", Number(start.basisPoints) / 1e9, "SOL\n");

  // Case 1: everything revoked and locked (the default in the UI)
  console.log("Case 1: revoke mint + freeze, immutable metadata, 9 decimals");
  const r1 = await createToken(umi, {
    name: "Test Meme One",
    symbol: "TMO",
    uri: "https://example.com/tmo.json",
    decimals: 9,
    supply: 1_000_000_000n,
    revokeMint: true,
    revokeFreeze: true,
    immutable: true,
    priority: "none",
  });
  console.log("  mint", r1.mint, "| txs:", r1.transactions, "| sig", r1.signature.slice(0, 16) + "...");
  const a1 = await fetchDigitalAsset(umi, r1.mint as never);
  check("name", a1.metadata.name === "Test Meme One", a1.metadata.name);
  check("symbol", a1.metadata.symbol === "TMO");
  check("uri", a1.metadata.uri === "https://example.com/tmo.json");
  check("decimals = 9", a1.mint.decimals === 9);
  check("supply = 1e9 * 1e9", a1.mint.supply === 1_000_000_000n * 10n ** 9n, String(a1.mint.supply));
  check("mint authority revoked", !isSome(a1.mint.mintAuthority));
  check("freeze authority revoked", !isSome(a1.mint.freezeAuthority));
  check("metadata immutable", a1.metadata.isMutable === false);
  const ata1 = findAssociatedTokenPda(umi, { mint: a1.publicKey, owner: umi.identity.publicKey });
  const tok1 = await fetchToken(umi, ata1);
  check("full supply in creator wallet", tok1.amount === a1.mint.supply, String(tok1.amount));

  // Case 2: keep authorities, mutable, 6 decimals, with priority fee
  console.log("\nCase 2: keep authorities, mutable metadata, 6 decimals, standard priority fee");
  const r2 = await createToken(umi, {
    name: "Test Meme Two",
    symbol: "TMT",
    uri: "https://example.com/tmt.json",
    decimals: 6,
    supply: 21_000_000n,
    revokeMint: false,
    revokeFreeze: false,
    immutable: false,
    priority: "standard",
  });
  console.log("  mint", r2.mint, "| txs:", r2.transactions);
  const a2 = await fetchDigitalAsset(umi, r2.mint as never);
  check("decimals = 6", a2.mint.decimals === 6);
  check("supply = 21e6 * 1e6", a2.mint.supply === 21_000_000n * 10n ** 6n);
  check("mint authority kept", isSome(a2.mint.mintAuthority));
  check("freeze authority kept", isSome(a2.mint.freezeAuthority));
  check("metadata mutable", a2.metadata.isMutable === true);

  // Cost estimate vs what the chain actually charged
  const end = await umi.rpc.getBalance(umi.identity.publicKey);
  const spent = Number(start.basisPoints - end.basisPoints);
  const rent = await fetchRent(umi);
  const est = estimateCostLamports("none", rent).total + estimateCostLamports("standard", rent).total;
  console.log(`\nSpent ${spent} lamports for two tokens, estimator said ${est}`);
  check("cost estimate matches what the wallet actually paid (within 1%)", Math.abs(spent - est) / est < 0.01, `${spent} vs ${est}`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nTest crashed:", e);
  process.exit(1);
});
