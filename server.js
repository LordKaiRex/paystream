/**
 * PayStream — Backend Server (Production-ready with Security)
 * Receives QuickNode webhook → executes real on-chain payroll
 *
 * Endpoints:
 *   POST /webhook/payroll     — QuickNode Stream trigger
 *   GET  /api/health          — Health check
 *   GET  /api/treasury/:wallet — Kamino vault position
 *   GET  /api/prices          — Birdeye token prices
 *   GET  /api/payments/due    — Due payments today
 *   POST /api/payments/run    — Manual payroll trigger (demo)
 *   POST /api/payments/add    — Add scheduled payment
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  getDuePayments,
  getKaminoUserPosition,
  getTokenPrices,
  getPaymentsByBusiness,
  addPayment,
} from "./paystream.js";
import { createExecutor } from "./execute.js";
import {
  requestLogger,
  securityHeaders,
  createRateLimiter,
  validateAddPaymentRequest,
  validateWalletParam,
  verifyWebhookSignature,
  auditLogger,
} from "./middleware.js";
import { dbGetStats } from "./database.js";

dotenv.config();

// Global error handlers for Railway stability
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  // Don't exit in production, just log
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, just log
});

const app = express();

// ─────────────────────────────────────────────────────────────────
// SECURITY MIDDLEWARE
// ─────────────────────────────────────────────────────────────────

// Parse JSON with size limit
app.use(express.json({ limit: "1mb" }));

// Security headers
app.use(securityHeaders);

// Serve static files (index.html, CSS, JS)
app.use(express.static('.'));

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

// Request logging
app.use(requestLogger);

// Rate limiting
const generalLimiter = createRateLimiter(100, 60000); // 100 requests per minute
const webhookLimiter = createRateLimiter(10, 60000); // 10 webhook calls per minute
const paymentLimiter = createRateLimiter(20, 60000); // 20 payment adds per minute

app.use("/api/", generalLimiter.middleware({ skipSuccessfulRequests: false }));
app.use(
  "/webhook/",
  webhookLimiter.middleware({ skipSuccessfulRequests: false })
);

// Initialize payment executor (loads SERVER_KEYPAIR from env)
let executor;
try {
  executor = createExecutor();
  console.log("✓ PaymentExecutor initialized successfully");
} catch (err) {
  console.warn(`⚠️  PaymentExecutor not initialized: ${err.message}`);
  console.warn(`   Payroll automation disabled. Set QUICKNODE_RPC_URL and SERVER_KEYPAIR to enable.`);
}

// ─────────────────────────────────────────────────────────────────
// HEALTH & STATUS
// ─────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile('index.html', { root: '.' });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "PayStream",
    executor: executor ? "ready" : "not configured",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    executorReady: !!executor,
  });
});

// ─────────────────────────────────────────────────────────────────
// WEBHOOK — QuickNode Stream Integration
// ─────────────────────────────────────────────────────────────────

/**
 * POST /webhook/payroll
 * Receives webhook from QuickNode Stream on payment day.
 * Validates secret, queues due payments, executes in background.
 */
app.post("/webhook/payroll", async (req, res) => {
  try {
    const secret = req.headers["x-paystream-secret"];

    if (secret !== process.env.WEBHOOK_SECRET) {
      auditLogger.logUnauthorizedAttempt("/webhook/payroll", "Invalid webhook secret");
      console.warn("⚠️  Webhook: unauthorized attempt (wrong secret)");
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!executor) {
      auditLogger.logWebhookReceived(false, { reason: "Executor not configured" });
      console.error("❌ Webhook received but executor not configured");
      return res.status(503).json({ error: "Executor not configured" });
    }

    const duePayments = await getDuePayments();
    console.log(`📢 Webhook received: ${duePayments.length} payments due today`);
    auditLogger.logWebhookReceived(true, {
      paymentsQueued: duePayments.length,
    });

    if (duePayments.length === 0) {
      return res.json({
        success: true,
        message: "No payments due today",
        processed: 0,
      });
    }

    // Respond immediately to avoid webhook timeout
    res.json({
      success: true,
      message: "Payroll execution started",
      queued: duePayments.length,
    });

    // Process in background
    setImmediate(async () => {
      try {
        const results = await executor.executePayrollBatch(duePayments);
        console.log(
          `✓ Payroll complete: ${results.succeeded.length} succeeded, ${results.failed.length} failed`
        );

        // Log detailed results
        if (results.failed.length > 0) {
          console.error("Failed payments:", results.failed);
          results.failed.forEach((f) => {
            auditLogger.logPaymentFailed(f.payment, f.error);
          });
        }
      } catch (err) {
        console.error("❌ Payroll execution error:", err);
        auditLogger.logAPIError("/webhook/payroll (background)", err);
      }
    });
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    auditLogger.logAPIError("/webhook/payroll", err);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.DEBUG === "true" ? err.message : undefined,
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// TREASURY — Kamino Vault Integration
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/treasury/:wallet
 * Returns the Kamino vault position for a wallet.
 */
app.get("/api/treasury/:wallet", validateWalletParam, async (req, res) => {
  try {
    const position = await getKaminoUserPosition(req.params.wallet);
    res.json({ success: true, data: position });
  } catch (err) {
    console.error("Treasury API error:", err);
    auditLogger.logAPIError("/api/treasury/:wallet", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// PRICES — Birdeye Integration
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/prices
 * Returns live token prices from Birdeye.
 */
app.get("/api/prices", async (req, res) => {
  try {
    const prices = await getTokenPrices();
    res.json({ success: true, data: prices });
  } catch (err) {
    console.error("Prices API error:", err);
    auditLogger.logAPIError("/api/prices", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// PAYMENTS — Schedule & Management
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/payments/due
 * Returns all payments due today.
 */
app.get("/api/payments/due", async (req, res) => {
  try {
    const payments = await getDuePayments();
    res.json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (err) {
    console.error("Payments due API error:", err);
    auditLogger.logAPIError("/api/payments/due", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/payments/business/:wallet
 * Returns all scheduled payments for a business wallet.
 */
app.get("/api/payments/business/:wallet", validateWalletParam, async (req, res) => {
  try {
    const payments = await getPaymentsByBusiness(req.params.wallet);
    res.json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (err) {
    console.error("Business payments API error:", err);
    auditLogger.logAPIError("/api/payments/business/:wallet", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/stats
 * Returns dashboard statistics
 */
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await dbGetStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error("Stats API error:", err);
    auditLogger.logAPIError("/api/stats", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/payments/add
 * Adds a new scheduled payment.
 */
app.post(
  "/api/payments/add",
  paymentLimiter.middleware({ skipSuccessfulRequests: false }),
  validateAddPaymentRequest,
  async (req, res) => {
    try {
      const {
        businessWallet,
        contractorName,
        contractorWallet,
        amountUSDC,
        frequency,
        nextPaymentDate,
      } = req.body;

      const payment = await addPayment({
        businessWallet,
        contractorName,
        contractorWallet,
        amountUSDC,
        frequency: frequency || "monthly",
        nextPaymentDate: nextPaymentDate || new Date(),
      });

      auditLogger.logPaymentScheduled(payment);

      res.json({
        success: true,
        message: "Payment scheduled successfully",
        data: payment,
      });
    } catch (err) {
      console.error("Add payment API error:", err);
      auditLogger.logAPIError("/api/payments/add", err);
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

/**
 * POST /api/payments/run
 * Manually trigger payroll execution (admin only, for testing/demo).
 */
app.post("/api/payments/run", async (req, res) => {
  try {
    const adminSecret = req.headers["x-admin-secret"] || req.body.adminSecret;

    if (adminSecret !== process.env.ADMIN_SECRET) {
      auditLogger.logUnauthorizedAttempt("/api/payments/run", "Invalid admin secret");
      console.warn("⚠️  Unauthorized manual payroll attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!executor) {
      return res.status(503).json({ error: "Executor not configured" });
    }

    console.log("🚀 Manual payroll run initiated");
    const payments = await getDuePayments();

    if (payments.length === 0) {
      return res.json({
        success: true,
        message: "No payments due today",
        processed: 0,
      });
    }

    const results = await executor.executePayrollBatch(payments);

    res.json({
      success: true,
      message: "Payroll execution complete",
      ...results,
    });
  } catch (err) {
    console.error("❌ Manual payroll error:", err);
    auditLogger.logAPIError("/api/payments/run", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────────────────────────

app.use((req, res) => {
  console.warn(`⚠️  404 Not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Not found",
    path: req.path,
    method: req.method,
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  auditLogger.logAPIError(req.path, err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.DEBUG === "true" ? err.message : "An error occurred",
    requestId: Date.now(),
  });
});

// ─────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           🚀 PayStream Server Running                     ║
╠═══════════════════════════════════════════════════════════╣
║  Port:         ${PORT}                                      
║  Environment:  ${process.env.NETWORK || "mainnet-beta"}                             
║  Executor:     ${executor ? "✓ Ready" : "✗ Not Configured"}                          
║  Frontend:     ${process.env.FRONTEND_URL || "any"}                        
╚═══════════════════════════════════════════════════════════╝
  `);
  
  console.log(`
  ⚡ PayStream v1.0 — ${new Date().toLocaleDateString()}
  ─────────────────────────────────────────
  🌐 Server:    http://localhost:${PORT}
  ⚗️  Kamino:   USDC Earn Vault (mainnet)
  🐦 Birdeye:  ${process.env.BIRDEYE_API_KEY ? "✅ API key set" : "⚠️  No API key"}
  ⚡ QuickNode: ${process.env.QUICKNODE_RPC_URL ? "✅ Connected" : "⚠️  Using public RPC"}
  💳 Executor:  ${executor ? "✅ Ready" : "⚠️  Set SERVER_KEYPAIR to enable"}
  ─────────────────────────────────────────
  Webhook: POST /webhook/payroll
  Health:  GET  /health
  `);
});

export default app;