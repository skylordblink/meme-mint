import { BaseSignerWalletAdapter, WalletReadyState, type SupportedTransactionVersions, type WalletName } from "@solana/wallet-adapter-base";
import { Keypair, type PublicKey, type Transaction, type VersionedTransaction } from "@solana/web3.js";

const ICON =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#14120e"/><circle cx="16" cy="16" r="9" fill="none" stroke="#c8f43a" stroke-width="2.4" stroke-dasharray="2 2.6"/><circle cx="16" cy="16" r="4.5" fill="#c8f43a"/></svg>`,
  );

/**
 * DEVELOPMENT ONLY. A wallet that signs with a throwaway devnet keypair taken from the environment,
 * so the whole flow can be clicked through without a browser extension.
 * It is never registered in production builds (see Providers) and holds no real funds.
 */
export class DevWalletAdapter extends BaseSignerWalletAdapter<"Dev Test Wallet"> {
  name = "Dev Test Wallet" as WalletName<"Dev Test Wallet">;
  url = "https://faucet.solana.com";
  icon = ICON;
  supportedTransactionVersions: SupportedTransactionVersions = new Set(["legacy", 0]);
  readyState = WalletReadyState.Installed;
  connecting = false;

  private keypair: Keypair;
  private key: PublicKey | null = null;

  constructor(secretKey: Uint8Array) {
    super();
    this.keypair = Keypair.fromSecretKey(secretKey);
  }

  get publicKey() {
    return this.key;
  }

  async connect() {
    this.key = this.keypair.publicKey;
    this.emit("connect", this.key);
  }

  async disconnect() {
    this.key = null;
    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if ("version" in transaction) transaction.sign([this.keypair]);
    else transaction.partialSign(this.keypair);
    return transaction;
  }
}
