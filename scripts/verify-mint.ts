/** Reads a token back from devnet and prints what is on-chain. Usage: npx tsx scripts/verify-mint.ts <mint> */
import { fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { fetchToken, findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox";
import { isSome, publicKey } from "@metaplex-foundation/umi";
import { makeUmi } from "../lib/umi";

async function main() {
  const umi = makeUmi(process.env.DEVNET_RPC || "https://api.devnet.solana.com");
  const mint = publicKey(process.argv[2]);
  const owner = publicKey(process.argv[3] || "5cU48tpBJLxt18bTpxYz8qKJXfeNk3wvdukaPuXuHj1r");
  const a = await fetchDigitalAsset(umi, mint);
  const ata = findAssociatedTokenPda(umi, { mint, owner });
  const tok = await fetchToken(umi, ata);

  console.log("name           :", a.metadata.name);
  console.log("symbol         :", a.metadata.symbol);
  console.log("uri            :", a.metadata.uri);
  console.log("decimals       :", a.mint.decimals);
  console.log("supply (raw)   :", a.mint.supply.toString());
  console.log("supply (tokens):", (a.mint.supply / 10n ** BigInt(a.mint.decimals)).toString());
  console.log("mint authority :", isSome(a.mint.mintAuthority) ? "STILL SET" : "revoked");
  console.log("freeze authority:", isSome(a.mint.freezeAuthority) ? "STILL SET" : "revoked");
  console.log("metadata       :", a.metadata.isMutable ? "editable" : "locked");
  console.log("held by wallet :", tok.amount.toString());

  try {
    const meta = await (await fetch(a.metadata.uri)).json();
    console.log("metadata json  :", JSON.stringify({ name: meta.name, symbol: meta.symbol, description: meta.description, image: meta.image }));
    const img = await fetch(meta.image);
    console.log("logo reachable :", img.status, img.headers.get("content-type"));
  } catch (e) {
    console.log("metadata json  : could not fetch,", (e as Error).message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
