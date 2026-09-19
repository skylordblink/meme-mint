import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

export function makeUmi(rpcUrl: string) {
  return createUmi(rpcUrl, { commitment: "confirmed" }).use(mplTokenMetadata()).use(mplToolbox());
}
