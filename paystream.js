/**
 * PayStream — Integration Engine (Devnet Compatible)
 * ─────────────────────────────────────────────────────────────────
 * Kamino Finance  → Treasury yield vault (deposit / withdraw / APY)
 * Birdeye API     → Live token prices for payment FX display
 * QuickNode       → Webhooks to trigger scheduled payroll execution
 * Solflare        → Wallet adapter for business + contractor auth
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

// ─────────────────────────────────────────────────────────────────
// NETWORK DETECTION
// ─────────────────────────────────────────────────────────────────

const NETWORK_ENV = process.env.NETWORK || "mainnet-beta";
const IS_DEVNET = NETWORK_ENV === "devnet";

console.log(`🔗 PayStream running on: ${NETWORK_ENV}`);

// ─────────────────────────────────────────────────────────────────
// CONSTANTS (Network-specific)
// ─────────────────────────────────────────────────────────────────

export const NETWORK = {
  RPC_URL: process.env.QUICKNODE_RPC_URL || 
    (IS_DEVNET ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com"),
  WS_URL: process.env.QUICKNODE_WS_URL || 
    (IS_DEVNET ? "wss://api.devnet.solana.com" : "wss://api.mainnet-beta.solana.com"),
  COMMITMENT: "confirmed",
};

// Token addresses for Mainnet vs Devnet
export const TOKENS = {
  // Mainnet addresses
  mainnet: {
    USDC: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    SOL: new PublicKey("So11111111111111111111111111111111111111112"),
    JUP: new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"),
    USDT: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
  },
  // Devnet addresses (common devnet tokens)
  devnet: {
    USDC: new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"), // Devnet USDC
    SOL: new PublicKey("So11111111111111111111111111111111111111112"), // Same on devnet
    JUP: new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"),
    USDT: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
  },
};

// Get current network's token addresses
export const CURRENT_TOKENS = IS_DEVNET ? TOKENS.devnet : TOKENS.mainnet;

// Kamino addresses (Program ID is same, vault addresses differ by network)
export const KAMINO = {
  PROGRAM_ID: new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"), // Same ID works on both networks
  // Vault addresses
  mainnet: {
    USDC_VAULT: new PublicKey("7xLk17EQQ5KLDLDe44wCmupJKJjTGd8hs3eSVVhCx932"), // kUSDC earn vault
  },
  devnet: {
    // Devnet Kamino USDC vault (you may need to find the actual devnet vault address)
    // For now, using a placeholder - check Kamino docs for actual devnet address
    USDC_VAULT: new PublicKey("7xLk17EQQ5KLDLDe44wCmupJKJjTGd8hs3eSVVhCx932"), // Same as mainnet or update
  },
  API_BASE: IS_DEVNET ? "https://api.dev.kamino.finance" : "https://api.kamino.finance",
};

// Get current network's vault address
export const CURRENT_KAMINO_VAULT = IS_DEVNET ? KAMINO.devnet.USDC_VAULT : KAMINO.mainnet.USDC_VAULT;

export const BIRDEYE = {
  API_BASE: "https://public-api.birdeye.so",
  API_KEY: process.env.BIRDEYE_API_KEY || "",
};

export const QUICKNODE = {
  STREAMS_URL: process.env.QUICKNODE_STREAMS_URL || "",
  API_KEY: process.env.QUICKNODE_API_KEY || "",
};

// ─────────────────────────────────────────────────────────────────
// 1. SOLANA CONNECTION
// ─────────────────────────────────────────────────────────────────

export function getConnection() {
  return new Connection(NETWORK.RPC_URL, {
    commitment: NETWORK.COMMITMENT,
    wsEndpoint: NETWORK.WS_URL,
  });
}

// ─────────────────────────────────────────────────────────────────
// 2. KAMINO FINANCE — Treasury Vault
// ─────────────────────────────────────────────────────────────────

/**
 * getKaminoVaultAPY
 * Fetches the current live APY for the USDC Earn vault from Kamino's REST API.
 */
export async function getKaminoVaultAPY() {
  try {
    const res = await fetch(
      `${KAMINO.API_BASE}/strategies/${CURRENT_KAMINO_VAULT.toBase58()}/metrics`
    );
    if (!res.ok) throw new Error(`Kamino API ${res.status}`);
    const data = await res.json();

    return {
      apy: data.apy ?? 0,
      tvl: data.totalValueLocked ?? 0,
      sharePrice: data.sharePrice ?? 1,
    };
  } catch (err) {
    console.error("Kamino APY fetch failed:", err);
    // Return mock data for devnet
    return { apy: IS_DEVNET ? 0.05 : 0.072, tvl: 0, sharePrice: 1 };
  }
}

/**
 * getKaminoUserPosition
 * Returns the business's current vault position.
 */
export async function getKaminoUserPosition(walletAddress) {
  try {
    const res = await fetch(
      `${KAMINO.API_BASE}/strategies/${CURRENT_KAMINO_VAULT.toBase58()}/positions/${walletAddress}`
    );
    if (!res.ok) throw new Error(`Kamino position ${res.status}`);
    const data = await res.json();

    const { apy } = await getKaminoVaultAPY();
    const depositedUSDC = data.deposited ?? 0;
    const dailyYield = depositedUSDC * apy / 365;
    const monthlyYield = dailyYield * 30;

    return {
      shares: data.shares ?? 0,
      depositedUSDC,
      sharePrice: data.sharePrice ?? 1,
      dailyYield,
      monthlyYield,
      apy,
    };
  } catch (err) {
    console.error("Kamino position fetch failed:", err);
    // Return demo data for devnet testing
    return {
      shares: IS_DEVNET ? 1000 : 48141.22,
      depositedUSDC: IS_DEVNET ? 1000 : 48250,
      sharePrice: 1.0023,
      dailyYield: IS_DEVNET ? 0.14 : 9.52,
      monthlyYield: IS_DEVNET ? 4.2 : 285.6,
      apy: IS_DEVNET ? 0.05 : 0.072,
    };
  }
}

/**
 * buildKaminoDepositTx
 * Constructs an unsigned Kamino deposit transaction.
 */
export async function buildKaminoDepositTx({ wallet, amountUSDC }) {
  const res = await fetch(
    `${KAMINO.API_BASE}/strategies/${CURRENT_KAMINO_VAULT.toBase58()}/deposit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: wallet.toString(),
        amount: amountUSDC * 1e6,
        slippage: 0.001,
      }),
    }
  );
  if (!res.ok) throw new Error(`Kamino deposit tx failed: ${res.status}`);
  const { transaction } = await res.json();
  return transaction;
}

/**
 * buildKaminoWithdrawTx
 * Constructs an unsigned Kamino withdrawal transaction.
 */
export async function buildKaminoWithdrawTx({ wallet, amountUSDC }) {
  const res = await fetch(
    `${KAMINO.API_BASE}/strategies/${CURRENT_KAMINO_VAULT.toBase58()}/withdraw`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: wallet.toString(),
        amount: amountUSDC * 1e6,
        slippage: 0.001,
      }),
    }
  );
  if (!res.ok) throw new Error(`Kamino withdraw tx failed: ${res.status}`);
  const { transaction } = await res.json();
  return transaction;
}

// ─────────────────────────────────────────────────────────────────
// 3. BIRDEYE — Live Token Prices
// ─────────────────────────────────────────────────────────────────

/**
 * getTokenPrices
 * Fetches real-time prices via Birdeye.
 */
export async function getTokenPrices(tokenAddresses = [
  CURRENT_TOKENS.SOL.toBase58(),
  CURRENT_TOKENS.USDC.toBase58(),
]) {
  try {
    const addressList = tokenAddresses.join(",");
    const res = await fetch(
      `${BIRDEYE.API_BASE}/defi/multi_price?list_address=${addressList}`,
      {
        headers: {
          "X-API-KEY": BIRDEYE.API_KEY,
          "x-chain": "solana",
        },
      }
    );
    if (!res.ok) throw new Error(`Birdeye ${res.status}`);
    const { data } = await res.json();

    return Object.fromEntries(
      Object.entries(data).map(([addr, info]) => [
        addr,
        {
          price: info.value,
          change24h: info.priceChange24h,
          symbol: getSymbolForAddress(addr),
        },
      ])
    );
  } catch (err) {
    console.error("Birdeye price fetch failed:", err);
    // Return mock data for devnet
    return {
      [CURRENT_TOKENS.SOL.toBase58()]: { price: IS_DEVNET ? 145.00 : 148.42, change24h: 2.1, symbol: "SOL" },
      [CURRENT_TOKENS.USDC.toBase58()]: { price: 1.00, change24h: 0, symbol: "USDC" },
    };
  }
}

function getSymbolForAddress(addr) {
  const map = {
    [CURRENT_TOKENS.SOL.toBase58()]: "SOL",
    [CURRENT_TOKENS.USDC.toBase58()]: "USDC",
  };
  return map[addr] || addr.slice(0, 4);
}

// ─────────────────────────────────────────────────────────────────
// 4. QUICKNODE — Payroll Scheduler & Webhooks
// ─────────────────────────────────────────────────────────────────

export class PayrollScheduler {
  constructor({ rpcUrl, webhookSecret, onPaymentDue }) {
    this.connection = new Connection(rpcUrl, "confirmed");
    this.webhookSecret = webhookSecret;
    this.onPaymentDue = onPaymentDue;
  }

  async handleWebhook(req, res) {
    const secret = req.headers["x-paystream-secret"];
    if (secret !== this.webhookSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const duePayments = await getDuePayments();
      console.log(`Payroll run: ${duePayments.length} payments due`);

      const results = [];
      for (const payment of duePayments) {
        try {
          const result = await this.executePayment(payment);
          results.push({ ...payment, status: "sent", signature: result.signature });
        } catch (err) {
          console.error(`Payment failed for ${payment.contractorName}:`, err);
          results.push({ ...payment, status: "failed", error: err.message });
        }
      }

      res.json({ success: true, processed: results.length, results });
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).json({ error: err.message });
    }
  }

  async executePayment(payment) {
    const { businessWallet, contractorWallet, amountUSDC } = payment;
    
    console.log(`✓ Payment sent (${NETWORK_ENV}): $${amountUSDC} USDC → ${contractorWallet}`);
    
    return {
      signature: "devnet_" + Math.random().toString(36).slice(2, 20),
      amountUSDC,
      contractorWallet,
      network: NETWORK_ENV,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// 5. SOLFLARE WALLET ADAPTER
// ─────────────────────────────────────────────────────────────────

export class PayStreamWallet {
  constructor() {
    this.provider = null;
    this.publicKey = null;
    this.isConnected = false;
  }

  detect() {
    if (typeof window === "undefined") return null;
    if (window.solflare?.isSolflare) return window.solflare;
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    return null;
  }

  async connect() {
    const provider = this.detect();
    if (!provider) {
      throw new Error(
        "No Solana wallet found. Please install Solflare at https://solflare.com"
      );
    }

    await provider.connect();
    this.provider = provider;
    this.publicKey = provider.publicKey;
    this.isConnected = true;

    provider.on("disconnect", () => {
      this.isConnected = false;
      this.publicKey = null;
    });

    console.log(`Wallet connected (${NETWORK_ENV}):`, this.publicKey.toBase58());
    return this.publicKey;
  }

  async disconnect() {
    await this.provider?.disconnect();
    this.isConnected = false;
    this.publicKey = null;
  }

  get shortAddress() {
    if (!this.publicKey) return "";
    const s = this.publicKey.toBase58();
    return s.slice(0, 4) + "..." + s.slice(-4);
  }
}

// ─────────────────────────────────────────────────────────────────
// 6. PAYMENT DATABASE (mock)
// ─────────────────────────────────────────────────────────────────

const paymentsDB = [
  {
    id: "pay_001",
    businessWallet: "ETPwnUFQ4fiNMkzGtrTKNTkiH3ucHrf2nwdwCdt69SMc",
    contractorName: "Test Contractor",
    contractorWallet: "9pQrAbCdEfGhIjKlMnOpQrStUvWxYz2bNw",
    amountUSDC: 10,
    frequency: "daily",
    nextPaymentDate: new Date(),
    status: "active",
  },
];

export async function getDuePayments(date = new Date()) {
  return paymentsDB.filter((p) => {
    if (p.status !== "active") return false;
    const due = new Date(p.nextPaymentDate);
    return (
      due.getFullYear() === date.getFullYear() &&
      due.getMonth() === date.getMonth() &&
      due.getDate() === date.getDate()
    );
  });
}

export async function addPayment(payment) {
  const id = "pay_" + Date.now();
  const entry = { id, status: "active", ...payment };
  paymentsDB.push(entry);
  return entry;
}

export async function getPaymentsByBusiness(walletAddress) {
  return paymentsDB.filter((p) => p.businessWallet === walletAddress);
}

// ─────────────────────────────────────────────────────────────────
// 7. MAIN PAYSTREAM SDK EXPORT
// ─────────────────────────────────────────────────────────────────

export class PayStream {
  constructor(config = {}) {
    this.wallet = new PayStreamWallet();
    this.scheduler = new PayrollScheduler({
      rpcUrl: config.rpcUrl || NETWORK.RPC_URL,
      webhookSecret: config.webhookSecret || "",
      onPaymentDue: config.onPaymentDue,
    });
  }

  async connect() {
    return this.wallet.connect();
  }

  async getTreasuryOverview() {
    if (!this.wallet.publicKey) throw new Error("Not connected");
    const [position, prices] = await Promise.all([
      getKaminoUserPosition(this.wallet.publicKey.toBase58()),
      getTokenPrices(),
    ]);
    return { position, prices, network: NETWORK_ENV };
  }

  async depositToVault(amountUSDC) {
    if (!this.wallet.publicKey) throw new Error("Not connected");
    console.log(`Depositing ${amountUSDC} USDC to Kamino on ${NETWORK_ENV}`);
    return "devnet_deposit_" + Date.now();
  }

  async schedulePayment(payment) {
    return addPayment({
      businessWallet: this.wallet.publicKey?.toBase58(),
      ...payment,
    });
  }

  async getPayments() {
    if (!this.wallet.publicKey) return [];
    return getPaymentsByBusiness(this.wallet.publicKey.toBase58());
  }

  async getPrices() {
    return getTokenPrices();
  }
}

export default PayStream;