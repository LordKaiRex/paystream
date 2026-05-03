/**
 * PayStream — On-Chain Execution Engine
 * ─────────────────────────────────────────────────────────────────
 * The core of what makes PayStream real:
 *   1. Withdraw exact USDC from Kamino vault
 *   2. Transfer USDC to contractor wallet (SPL token transfer)
 *   3. Handle ATA creation if contractor has never received USDC
 *   4. Retry on transient failures
 *   5. Record every payment on-chain (via memo program)
 *
 * This is the file you wire to your server keypair on mainnet.
 * ─────────────────────────────────────────────────────────────────
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const NETWORK = {
  RPC_URL: process.env.QUICKNODE_RPC_URL || "https://api.mainnet-beta.solana.com",
  WS_URL: process.env.QUICKNODE_WS_URL || "wss://api.mainnet-beta.solana.com",
  COMMITMENT: "confirmed",
};

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDC_DECIMALS = 6;
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const KAMINO_API = "https://api.kamino.finance";
const KAMINO_USDC_VAULT = "7xLk17EQQ5KLDLDe44wCmupJKJjTGd8hs3eSVVhCx932";

// Max retries for transient RPC failures
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ─────────────────────────────────────────────────────────────────
// PAYMENT EXECUTOR
// ─────────────────────────────────────────────────────────────────

export class PaymentExecutor {
  /**
   * @param {Connection} connection - Solana RPC connection (QuickNode)
   * @param {Keypair} payer - Server keypair that signs payroll transactions
   *   In production: load from environment variable, never hardcode
   *   process.env.SERVER_KEYPAIR → JSON.parse → Uint8Array → Keypair.fromSecretKey()
   */
  constructor(connection, payer) {
    this.connection = connection;
    this.payer = payer;
  }

  /**
   * executePayment
   * ─────────────────────────────────────────────────────────────
   * Full atomic payment execution:
   *   Step 1: Withdraw USDC from Kamino vault → business wallet
   *   Step 2: Transfer USDC from business wallet → contractor wallet
   *   Step 3: Record memo on-chain for auditing
   *
   * Both steps are separate transactions. Kamino's withdraw lands funds
   * in the business ATA, then we sweep immediately to contractor.
   *
   * @param {Object} payment
   * @param {string} payment.id               - Payment ID (for memo)
   * @param {string} payment.businessWallet   - Business wallet pubkey string
   * @param {string} payment.contractorWallet - Contractor wallet pubkey string
   * @param {number} payment.amountUSDC       - Amount in USDC (e.g. 3200)
   * @param {string} payment.contractorName   - For memo recording
   *
   * @returns {Promise<PaymentResult>}
   */
  async executePayment(payment) {
    const { id, businessWallet, contractorWallet, amountUSDC, contractorName } = payment;
    const startTime = Date.now();

    console.log(`\n  💸 Executing payment #${id}`);
    console.log(`     → ${contractorName}: $${amountUSDC} USDC`);
    console.log(`     → Destination: ${contractorWallet}`);

    try {
      const businessPubkey = new PublicKey(businessWallet);
      const contractorPubkey = new PublicKey(contractorWallet);
      const amountRaw = Math.floor(amountUSDC * Math.pow(10, USDC_DECIMALS));

      // ── Step 1: Withdraw from Kamino ──────────────────────────
      console.log(`     [1/3] Withdrawing $${amountUSDC} USDC from Kamino vault...`);
      const withdrawSig = await this.kaminoWithdraw({
        businessPubkey,
        amountUSDC,
      });
      console.log(`     ✓ Kamino withdraw: ${withdrawSig}`);

      // ── Step 2: Transfer to contractor ───────────────────────
      console.log(`     [2/3] Sending USDC to contractor...`);
      const transferSig = await this.sendUSDC({
        from: businessPubkey,
        to: contractorPubkey,
        amountRaw,
        paymentId: id,
        contractorName,
      });
      console.log(`     ✓ Transfer: ${transferSig}`);

      // ── Step 3: Record completion ─────────────────────────────
      const elapsed = Date.now() - startTime;
      console.log(`     ✓ Payment complete in ${elapsed}ms`);

      return {
        success: true,
        paymentId: id,
        withdrawSignature: withdrawSig,
        transferSignature: transferSig,
        amountUSDC,
        contractorWallet,
        contractorName,
        executedAt: new Date().toISOString(),
        durationMs: elapsed,
        explorerUrl: `https://solscan.io/tx/${transferSig}`,
      };

    } catch (err) {
      console.error(`     ❌ Payment failed: ${err.message}`);
      return {
        success: false,
        paymentId: id,
        error: err.message,
        amountUSDC,
        contractorWallet,
        contractorName,
        executedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * kaminoWithdraw
   * ─────────────────────────────────────────────────────────────
   * Calls Kamino API to get an unsigned withdrawal transaction,
   * signs it with the payer keypair, and broadcasts it.
   *
   * Kamino returns a base64-encoded VersionedTransaction.
   * We deserialize, sign, and send via QuickNode.
   */
  async kaminoWithdraw({ businessPubkey, amountUSDC }) {
    // 1. Request unsigned withdraw tx from Kamino
    const res = await fetchWithRetry(
      `${KAMINO_API}/strategies/${KAMINO_USDC_VAULT}/withdraw`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: businessPubkey.toBase58(),
          amount: Math.floor(amountUSDC * 1e6),
          slippage: 0.001,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Kamino withdraw API failed (${res.status}): ${err}`);
    }

    const { transaction: txBase64 } = await res.json();

    // 2. Deserialize the transaction
    const txBuffer = Buffer.from(txBase64, "base64");
    const tx = Transaction.from(txBuffer);

    // 3. Set blockhash and sign
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);

    // 4. Send and confirm
    const signature = await sendAndConfirmTransactionWithRetry(
      this.connection,
      tx,
      [this.payer],
      { commitment: "confirmed", lastValidBlockHeight }
    );

    return signature;
  }

  /**
   * sendUSDC
   * ─────────────────────────────────────────────────────────────
   * Builds and sends a USDC SPL token transfer.
   *
   * Handles two scenarios:
   *   A. Contractor already has a USDC ATA → just transfer
   *   B. Contractor has no USDC ATA → create it first, then transfer
   *      (costs ~0.002 SOL extra, paid by business — worth it for UX)
   *
   * Also attaches a memo instruction for on-chain audit trail.
   */
  async sendUSDC({ from, to, amountRaw, paymentId, contractorName }) {
    const fromATA = await getAssociatedTokenAddress(USDC_MINT, from);
    const toATA = await getAssociatedTokenAddress(USDC_MINT, to);

    const tx = new Transaction();

    // Check if contractor's USDC ATA exists
    const toATAExists = await accountExists(this.connection, toATA);

    // Create ATA if needed (contractor's first payment ever)
    if (!toATAExists) {
      console.log(`     ℹ️  Creating USDC account for ${contractorName}...`);
      tx.add(
        createAssociatedTokenAccountInstruction(
          this.payer.publicKey, // payer (business)
          toATA,                // ATA to create
          to,                   // ATA owner (contractor)
          USDC_MINT,            // token mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    // SPL token transfer instruction
    tx.add(
      createTransferInstruction(
        fromATA,              // source
        toATA,                // destination
        from,                 // owner of source
        amountRaw,            // amount in raw units
        [],                   // multisig signers (none)
        TOKEN_PROGRAM_ID
      )
    );

    // Memo instruction — recorded on-chain forever
    // Format: "paystream:v1:{paymentId}:{contractorName}"
    const memo = `paystream:v1:${paymentId}:${contractorName.replace(/\s+/g, "_")}`;
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: from, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, "utf8"),
      })
    );

    // Set blockhash and fee payer
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = this.payer.publicKey;

    // Sign (business wallet + payer are both needed for transfer)
    tx.sign(this.payer);

    // Send
    const signature = await sendAndConfirmTransactionWithRetry(
      this.connection,
      tx,
      [this.payer],
      { commitment: "confirmed", lastValidBlockHeight }
    );

    return signature;
  }

  /**
   * executePayrollBatch
   * ─────────────────────────────────────────────────────────────
   * Process multiple payments sequentially with error isolation.
   * One failed payment does NOT stop the others.
   *
   * Called by the QuickNode webhook handler on payroll day.
   */
  async executePayrollBatch(payments) {
    console.log(`\n  🚀 PayStream Payroll Run — ${payments.length} payments`);
    console.log(`  Time: ${new Date().toISOString()}\n`);

    const results = {
      succeeded: [],
      failed: [],
      totalSent: 0,
      startedAt: new Date().toISOString(),
    };

    for (const payment of payments) {
      const result = await this.executePayment(payment);

      if (result.success) {
        results.succeeded.push(result);
        results.totalSent += payment.amountUSDC;
      } else {
        results.failed.push(result);
        // Alert via webhook / email / Slack here in production
        await alertPaymentFailure(result);
      }

      // Small delay between payments to avoid RPC rate limits
      if (payments.indexOf(payment) < payments.length - 1) {
        await sleep(500);
      }
    }

    results.completedAt = new Date().toISOString();

    console.log(`\n  ═══ Payroll Run Complete ═══`);
    console.log(`  ✅ Succeeded: ${results.succeeded.length} payments, $${results.totalSent.toLocaleString()} USDC`);
    console.log(`  ❌ Failed:    ${results.failed.length} payments`);
    console.log(`  ═══════════════════════════\n`);

    return results;
  }
}


// ─────────────────────────────────────────────────────────────────
// FACTORY — Load Executor from Environment
// ─────────────────────────────────────────────────────────────────

/**
 * createExecutor
 * Loads the server keypair from environment and creates a PaymentExecutor.
 *
 * Usage in server.js:
 *   import { createExecutor } from './execute.js';
 *   const executor = createExecutor();
 *   const result = await executor.executePayment(payment);
 *
 * Environment variable:
 *   SERVER_KEYPAIR = JSON array of 64 bytes
 *   e.g. [12,34,56,...] (output of Keypair.generate().secretKey)
 *
 * Security note:
 *   This keypair only needs to hold ~0.01 SOL for fees.
 *   The USDC it transfers is pulled from the business's ATA,
 *   which it is authorized to transfer (set up during onboarding).
 *   Never give this keypair more SOL than needed for ~1 week of fees.
 */
export function createExecutor() {
  const rpcUrl = process.env.QUICKNODE_RPC_URL;
  const keypairJson = process.env.SERVER_KEYPAIR;

  if (!rpcUrl) throw new Error("QUICKNODE_RPC_URL not set");
  if (!keypairJson) throw new Error("SERVER_KEYPAIR not set");

  const connection = new Connection(rpcUrl, {
    commitment: "confirmed",
    wsEndpoint: process.env.QUICKNODE_WS_URL,
  });

  const keypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(keypairJson))
  );

  console.log(`PaymentExecutor ready. Payer: ${keypair.publicKey.toBase58()}`);

  return new PaymentExecutor(connection, keypair);
}


// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * accountExists
 * Checks if a given account/ATA exists on-chain.
 */
async function accountExists(connection, pubkey) {
  try {
    const info = await connection.getAccountInfo(pubkey);
    return info !== null;
  } catch {
    return false;
  }
}

/**
 * fetchWithRetry
 * Retries HTTP requests on transient failures (5xx, network errors).
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status < 500) return res; // Don't retry 4xx
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`     ⟳ Retry ${attempt}/${retries} after ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS * attempt); // exponential backoff
    }
  }
}

/**
 * sendAndConfirmTransactionWithRetry
 * Wraps sendAndConfirmTransaction with retry logic for:
 *   - BlockhashNotFound (get fresh blockhash)
 *   - TransactionExpiredBlockheightExceeded (resubmit)
 */
async function sendAndConfirmTransactionWithRetry(connection, tx, signers, opts, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Refresh blockhash on retry
      if (attempt > 1) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.sign(...signers);
        opts.lastValidBlockHeight = lastValidBlockHeight;
      }

      return await sendAndConfirmTransaction(connection, tx, signers, {
        commitment: "confirmed",
        ...opts,
      });
    } catch (err) {
      const isRetriable =
        err.message?.includes("BlockhashNotFound") ||
        err.message?.includes("TransactionExpiredBlockheightExceeded") ||
        err.message?.includes("429"); // rate limit

      if (!isRetriable || attempt === retries) throw err;
      console.log(`     ⟳ Tx retry ${attempt}/${retries}: ${err.message.slice(0, 60)}`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}

/**
 * alertPaymentFailure
 * In production: send Slack/email/PagerDuty alert on payment failure.
 * Replace with your alerting provider.
 */
async function alertPaymentFailure(result) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 *PayStream Payment Failed*\n*Contractor:* ${result.contractorName}\n*Amount:* $${result.amountUSDC} USDC\n*Error:* ${result.error}\n*ID:* ${result.paymentId}`,
      }),
    });
  } catch (e) {
    console.error("Alert failed:", e.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// ─────────────────────────────────────────────────────────────────
// UTILITY: Generate Server Keypair (run once during setup)
// ─────────────────────────────────────────────────────────────────

/**
 * Run this once to generate your server keypair:
 *   node -e "import('./execute.js').then(m => m.generateServerKeypair())"
 *
 * Copy the output to SERVER_KEYPAIR in your .env
 * Fund the pubkey with ~0.05 SOL for fees
 */
export function generateServerKeypair() {
  const keypair = Keypair.generate();
  console.log("\n  🔑 Server Keypair Generated");
  console.log(`  Public Key:  ${keypair.publicKey.toBase58()}`);
  console.log(`  Private Key: ${JSON.stringify(Array.from(keypair.secretKey))}`);
  console.log(`\n  → Add to .env:`);
  console.log(`  SERVER_KEYPAIR='${JSON.stringify(Array.from(keypair.secretKey))}'`);
  console.log(`\n  → Fund with SOL for fees:`);
  console.log(`  solana transfer ${keypair.publicKey.toBase58()} 0.05 --url mainnet-beta\n`);
  return keypair;
}
