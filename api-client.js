/**
 * PayStream Frontend API Client
 * Handles all communication with the PayStream backend.
 * 
 * Usage: import or include as <script> tag
 *   const api = new PayStreamAPI('https://backend-url');
 *   const treasury = await api.getTreasury(walletAddress);
 *   const prices = await api.getPrices();
 */

class PayStreamAPI {
  constructor(baseURL = "") {
    this.baseURL = baseURL || window.location.origin;
    this.timeout = 10000; // 10 second timeout
  }

  /**
   * Internal fetch wrapper with error handling and timeout
   */
  async _fetch(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw err;
    }
  }

  // ─── Health & Status ──────────────────────────────────────────

  async health() {
    return this._fetch("/api/health");
  }

  // ─── Treasury (Kamino) ────────────────────────────────────────

  async getTreasury(walletAddress) {
    return this._fetch(`/api/treasury/${walletAddress}`);
  }

  // ─── Prices (Birdeye) ─────────────────────────────────────────

  async getPrices() {
    return this._fetch("/api/prices");
  }

  // ─── Payments ─────────────────────────────────────────────────

  async getPaymentsDue() {
    return this._fetch("/api/payments/due");
  }

  async getBusinessPayments(walletAddress) {
    return this._fetch(`/api/payments/business/${walletAddress}`);
  }

  async addPayment(paymentData) {
    return this._fetch("/api/payments/add", {
      method: "POST",
      body: JSON.stringify(paymentData),
    });
  }

  async runPayroll(adminSecret) {
    return this._fetch("/api/payments/run", {
      method: "POST",
      headers: {
        "x-admin-secret": adminSecret,
      },
    });
  }
}

/**
 * Solflare Wallet Integration
 * Detects and manages wallet connection for transaction signing
 */
class SolflareWallet {
  constructor() {
    this.provider = null;
    this.publicKey = null;
    this.isConnected = false;
  }

  /**
   * Detect available wallet provider
   * Prefers Solflare, falls back to Phantom
   */
  detect() {
    if (typeof window === "undefined") return null;

    // Check for Solflare
    if (window.solflare?.isSolflare) {
      console.log("✓ Solflare wallet detected");
      return window.solflare;
    }

    // Check for Phantom
    if (window.phantom?.solana?.isPhantom) {
      console.log("✓ Phantom wallet detected");
      return window.phantom.solana;
    }

    return null;
  }

  /**
   * Connect to wallet
   */
  async connect() {
    const provider = this.detect();

    if (!provider) {
      throw new Error(
        "No Solana wallet found. Please install Solflare from https://solflare.com or Phantom from https://phantom.app"
      );
    }

    try {
      await provider.connect();
      this.provider = provider;
      this.publicKey = provider.publicKey;
      this.isConnected = true;

      console.log(`✓ Wallet connected: ${this.publicKey.toBase58()}`);

      // Listen for disconnection
      provider.on("disconnect", () => {
        this.isConnected = false;
        this.publicKey = null;
        console.log("Wallet disconnected");
        this.onDisconnect?.();
      });

      // Listen for account changes
      provider.on("accountChanged", (newPubkey) => {
        this.publicKey = newPubkey;
        if (newPubkey) {
          console.log(`Account changed: ${newPubkey.toBase58()}`);
          this.onAccountChanged?.(newPubkey);
        }
      });

      return this.publicKey;
    } catch (err) {
      if (err.message !== "User rejected the request.") {
        console.error("Connection error:", err);
      }
      throw err;
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect() {
    try {
      await this.provider?.disconnect();
      this.isConnected = false;
      this.publicKey = null;
      console.log("Wallet disconnected");
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  }

  /**
   * Get formatted short address (e.g., "7xKp...4mNq")
   */
  getShortAddress() {
    if (!this.publicKey) return "";
    const full = this.publicKey.toBase58();
    return full.slice(0, 4) + "..." + full.slice(-4);
  }

  /**
   * Get wallet name (Solflare or Phantom)
   */
  getWalletName() {
    if (!this.provider) return "Unknown";
    return this.provider.isSolflare ? "Solflare" : "Phantom";
  }
}

/**
 * PayStream Frontend Manager
 * Coordinates API calls, wallet management, and UI updates
 */
class PayStreamManager {
  constructor(apiBaseURL = "") {
    this.api = new PayStreamAPI(apiBaseURL);
    this.wallet = new SolflareWallet();
    this.prices = {};
    this.treasury = null;
    this.payments = [];
    this.priceRefreshInterval = null;
  }

  /**
   * Initialize the manager
   */
  async init() {
    console.log("🚀 Initializing PayStream Manager...");

    // Check server health
    try {
      const health = await this.api.health();
      console.log("✓ Backend connected:", health);
    } catch (err) {
      console.warn("⚠️ Backend not reachable:", err.message);
    }

    // Refresh prices immediately and then every 30 seconds
    await this.refreshPrices();
    this.priceRefreshInterval = setInterval(() => this.refreshPrices(), 30000);
  }

  /**
   * Connect wallet and load user data
   */
  async connectWallet() {
    try {
      const pubkey = await this.wallet.connect();
      console.log(`✓ Connected wallet: ${pubkey.toBase58()}`);

      // Load user data
      await Promise.all([this.loadTreasury(), this.loadPayments()]);

      return pubkey;
    } catch (err) {
      console.error("Wallet connection failed:", err);
      throw err;
    }
  }

  /**
   * Refresh token prices from backend
   */
  async refreshPrices() {
    try {
      const response = await this.api.getPrices();
      if (response.success) {
        this.prices = response.data;
        this.onPricesUpdated?.(this.prices);
      }
    } catch (err) {
      console.warn("Price refresh failed:", err.message);
    }
  }

  /**
   * Load treasury position for current wallet
   */
  async loadTreasury() {
    if (!this.wallet.publicKey) return;

    try {
      const response = await this.api.getTreasury(this.wallet.publicKey.toBase58());
      if (response.success) {
        this.treasury = response.data;
        this.onTreasuryUpdated?.(this.treasury);
      }
    } catch (err) {
      console.warn("Treasury load failed:", err.message);
    }
  }

  /**
   * Load payment schedule for current wallet
   */
  async loadPayments() {
    if (!this.wallet.publicKey) return;

    try {
      const response = await this.api.getBusinessPayments(this.wallet.publicKey.toBase58());
      if (response.success) {
        this.payments = response.data;
        this.onPaymentsUpdated?.(this.payments);
      }
    } catch (err) {
      console.warn("Payments load failed:", err.message);
    }
  }

  /**
   * Add a new scheduled payment
   */
  async addPayment(paymentData) {
    try {
      const response = await this.api.addPayment({
        businessWallet: this.wallet.publicKey.toBase58(),
        ...paymentData,
      });

      if (response.success) {
        await this.loadPayments();
        return response.data;
      }

      throw new Error(response.error);
    } catch (err) {
      console.error("Failed to add payment:", err);
      throw err;
    }
  }

  /**
   * Get price for a specific token
   */
  getTokenPrice(tokenAddress) {
    return this.prices[tokenAddress]?.price || null;
  }

  /**
   * Convert USD amount to token amount
   */
  usdToToken(usdAmount, tokenAddress) {
    const price = this.getTokenPrice(tokenAddress);
    if (!price) return null;
    return usdAmount / price;
  }

  /**
   * Cleanup (stop intervals, etc.)
   */
  destroy() {
    if (this.priceRefreshInterval) {
      clearInterval(this.priceRefreshInterval);
    }
  }
}

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PayStreamAPI, SolflareWallet, PayStreamManager };
}
