# MemeMint: Solana token creator

A web app for creating standard Solana (SPL) tokens. The user connects a wallet, fills in a form, signs once, and gets a live token with a logo, metadata and the full supply in their wallet.

- Works with Phantom, Solflare, Backpack and any Wallet Standard wallet
- Private keys never leave the wallet. There is no backend that signs anything
- Standard SPL token with Metaplex metadata, so it shows up correctly in wallets, Solscan, Jupiter and Raydium
- Optional one-way switches: revoke mint authority, revoke freeze authority, lock metadata
- Live cost estimate before signing, mainnet and devnet toggle, history of tokens created

## What you need

| Item | Where | Cost |
|---|---|---|
| Node.js 20 or newer | nodejs.org | free |
| A Pinata account (stores the logo and token info on IPFS) | app.pinata.cloud | free tier is enough |
| A dedicated Solana RPC URL for mainnet | helius.dev or quicknode.com | free tier is enough |

Mainnet needs your own RPC URL. Solana's free public RPC (`api.mainnet-beta.solana.com`) refuses requests from browsers with a 403 error, so nothing works on mainnet until `NEXT_PUBLIC_MAINNET_RPC_URL` is set. Devnet works with the public one.

## Setup (5 minutes)

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in:

1. `PINATA_JWT`: in Pinata go to API Keys > New Key, enable `pinFileToIPFS` and `pinJSONToIPFS`, copy the JWT.
2. `NEXT_PUBLIC_MAINNET_RPC_URL`: your Helius or QuickNode mainnet URL.
3. `NEXT_PUBLIC_APP_NAME`: your brand name (optional).

Then run it:

```bash
npm run dev
```

Open http://localhost:3000.

Without `PINATA_JWT`, local development still works: the logo and metadata are saved in a local `.dev-uploads` folder. That fallback is disabled in production builds, where `PINATA_JWT` is required.

## Try it for free first (devnet)

1. Switch the toggle in the header to **Devnet**.
2. Get free test SOL at https://faucet.solana.com (select devnet, paste your wallet address).
3. In your wallet, switch to devnet if it asks. Create a token. Devnet tokens have no value.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel choose **Add New > Project** and import the repository.
3. Under Environment Variables add `PINATA_JWT`, `NEXT_PUBLIC_MAINNET_RPC_URL` and `NEXT_PUBLIC_APP_NAME`.
4. Deploy. Add your own domain in the project settings if you want one.

## How it works

`lib/createToken.ts` builds one transaction that:

1. creates the mint and its Metaplex metadata account,
2. creates your token account and mints the full supply to it,
3. optionally revokes the mint and freeze authorities.

If a transaction would be too large for Solana it is split automatically. The upload route (`app/api/upload/route.ts`) pins the logo and the metadata JSON to IPFS using your Pinata key, which never reaches the browser.

## Costs per token (mainnet)

About 0.0163 SOL in total, measured on devnet:

| Part | Amount |
|---|---|
| Account rent (mint, metadata, token account), a deposit set by Solana | about 0.0063 SOL |
| Metaplex fee for creating token metadata, flat | 0.0100 SOL |
| Network fee | 0.00001 SOL |
| Optional priority fee | 0.00003 to 0.0013 SOL |

This app charges no fee of its own. The rent amount is read live from the network, so the receipt on the page is always current. The Metaplex fee is a fixed 0.01 SOL that was confirmed on devnet, so confirm it on your first mainnet token.

## Tests

```bash
npm run typecheck
npm run build
npm run test:devnet
```

`test:devnet` creates two real tokens on Solana devnet with a throwaway wallet and checks the result on-chain: supply, decimals, revoked authorities, metadata and the cost estimate. It uses the same function the website uses.

To read any devnet token back from the chain and print what is stored:

```bash
npx tsx scripts/verify-mint.ts <mint address>
```

### Testing without a wallet extension (local only)

Set `NEXT_PUBLIC_DEV_WALLET_SECRET` in `.env.local` to the secret key (a JSON array of numbers) of a throwaway devnet wallet. A "Dev Test Wallet" then appears in the wallet popup so the whole flow can be clicked through in any browser. It is ignored in production builds. Never set it on a real host and never use a wallet that holds real funds.

## Good to know

- The site and its upload endpoint are public, and each visitor is limited to 8 uploads per minute. Anyone who finds your link can create tokens using your Pinata storage, so keep the link to yourself or put the site behind a password (Vercel offers password protection on paid plans).
- Vercel's free Hobby plan is meant for personal, non-commercial use. If you will use the site for business, use a paid plan or another host that runs Next.js.
- Logos and token info load through Pinata's public gateway by default. It works out of the box but the first load can take several seconds. A free dedicated gateway in your Pinata account is faster: create one under Gateways and set `IPFS_GATEWAY` to `https://your-name.mypinata.cloud/ipfs`.
- Revoking authorities and locking metadata cannot be undone. The form defaults to all three on, which is what buyers of a new token usually look for.
- This tool creates tokens. It does not add liquidity or trade. To make a token tradable, create a pool on a DEX such as Raydium or Meteora.
- You are responsible for the tokens you create and for following the laws where you operate. Nothing in this project is financial advice.
