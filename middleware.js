/**
 * PayStream — Middleware & Security Layer
 * ─────────────────────────────────────────────────────────────────
 * Input validation, rate limiting, webhook verification, audit logging
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PublicKey } from "@solana/web3.js";

// ─────────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────────

class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isLimited(key) {
    const now = Date.now();
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key);
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return true;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return false;
  }

  middleware(options = {}) {
    const {
      keyGenerator = (req) => req.ip,
      maxRequests = this.maxRequests,
      windowMs = this.windowMs,
      skipSuccessfulRequests = false,
    } = options;

    const limiter = new RateLimiter(maxRequests, windowMs);

    return (req, res, next) => {
      const key = keyGenerator(req);

      if (limiter.isLimited(key)) {
        return res.status(429).json({
          error: "Too many requests",
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      next();
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// INPUT VALIDATION
// ─────────────────────────────────────────────────────────────────

export function validatePublicKey(value) {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function validateAmount(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0 && num < 1000000000; // Max 1B USDC
}

export function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateFrequency(value) {
  return ["weekly", "bi-weekly", "monthly"].includes(value);
}

export function validatePaymentPayload(payload) {
  const errors = [];

  if (!payload.contractorWallet || !validatePublicKey(payload.contractorWallet)) {
    errors.push("Invalid contractorWallet (must be valid Solana address)");
  }

  if (!payload.amountUSDC || !validateAmount(payload.amountUSDC)) {
    errors.push("Invalid amountUSDC (must be 0 < amount < 1B)");
  }

  if (payload.frequency && !validateFrequency(payload.frequency)) {
    errors.push("Invalid frequency (must be weekly, bi-weekly, or monthly)");
  }

  if (!payload.contractorName || payload.contractorName.length < 2) {
    errors.push("Invalid contractorName (minimum 2 characters)");
  }

  if (payload.businessWallet && !validatePublicKey(payload.businessWallet)) {
    errors.push("Invalid businessWallet (must be valid Solana address)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sanitizeString(value, maxLength = 255) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength).replace(/[<>"']/g, "");
}

/**
 * Validation middleware for POST /api/payments/add
 */
export function validateAddPaymentRequest(req, res, next) {
  const validation = validatePaymentPayload(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      error: "Invalid payment data",
      details: validation.errors,
    });
  }

  // Sanitize inputs
  req.body.contractorName = sanitizeString(req.body.contractorName);
  req.body.contractorWallet = req.body.contractorWallet.trim();
  req.body.businessWallet = req.body.businessWallet?.trim() || "";
  req.body.amountUSDC = parseFloat(req.body.amountUSDC);
  req.body.frequency = req.body.frequency?.toLowerCase() || "monthly";

  next();
}

/**
 * Validation middleware for GET /api/treasury/:wallet
 */
export function validateWalletParam(req, res, next) {
  const { wallet } = req.params;

  if (!validatePublicKey(wallet)) {
    return res.status(400).json({
      error: "Invalid wallet address",
      details: ["wallet parameter must be a valid Solana public key"],
    });
  }

  next();
}

// ─────────────────────────────────────────────────────────────────
// WEBHOOK SIGNATURE VERIFICATION (QuickNode)
// ─────────────────────────────────────────────────────────────────

/**
 * Verify webhook signature from QuickNode
 * QuickNode signs webhooks with HMAC-SHA256
 */
export function verifyWebhookSignature(req, res, next) {
  const signature = req.headers["x-quicknode-signature"];
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    console.warn("⚠️  WEBHOOK_SECRET not configured");
    return res.status(503).json({ error: "Webhook secret not configured" });
  }

  if (!signature) {
    console.warn("⚠️  Missing webhook signature header");
    return res.status(401).json({ error: "Missing signature" });
  }

  // Get the raw body for signature verification
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.warn("⚠️  Invalid webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  next();
}

// ─────────────────────────────────────────────────────────────────
// AUDIT LOGGING
// ─────────────────────────────────────────────────────────────────

class AuditLogger {
  constructor(logDir = "./logs") {
    this.logDir = logDir;
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Log audit event to file and console
   */
  log(event, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      event,
      details,
    };

    // Console output
    console.log(`[AUDIT] ${event}:`, details);

    // File output - one file per day
    const dateStr = timestamp.split("T")[0];
    const logFile = path.join(this.logDir, `audit-${dateStr}.log`);

    try {
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
    } catch (err) {
      console.error("Failed to write audit log:", err);
    }
  }

  logPaymentScheduled(payment) {
    this.log("PAYMENT_SCHEDULED", {
      contractorWallet: payment.contractorWallet,
      amountUSDC: payment.amountUSDC,
      frequency: payment.frequency,
    });
  }

  logPaymentExecuted(payment, txId) {
    this.log("PAYMENT_EXECUTED", {
      contractorWallet: payment.contractorWallet,
      amountUSDC: payment.amountUSDC,
      transactionId: txId,
    });
  }

  logPaymentFailed(payment, error) {
    this.log("PAYMENT_FAILED", {
      contractorWallet: payment.contractorWallet,
      amountUSDC: payment.amountUSDC,
      error: error.message,
    });
  }

  logWebhookReceived(success, details) {
    this.log(success ? "WEBHOOK_SUCCESS" : "WEBHOOK_FAILED", details);
  }

  logAPIError(endpoint, error) {
    this.log("API_ERROR", {
      endpoint,
      error: error.message,
    });
  }

  logUnauthorizedAttempt(endpoint, reason) {
    this.log("UNAUTHORIZED_ATTEMPT", {
      endpoint,
      reason,
    });
  }
}

export const auditLogger = new AuditLogger();

// ─────────────────────────────────────────────────────────────────
// REQUEST LOGGING MIDDLEWARE
// ─────────────────────────────────────────────────────────────────

export function requestLogger(req, res, next) {
  const start = Date.now();
  const method = req.method;
  const path = req.path;

  // Log response when it's finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor =
      status >= 200 && status < 300
        ? "✅"
        : status >= 300 && status < 400
          ? "➡️"
          : status >= 400 && status < 500
            ? "⚠️"
            : "❌";

    console.log(
      `${statusColor} [${method}] ${path} → ${status} (${duration}ms)`
    );
  });

  next();
}

// ─────────────────────────────────────────────────────────────────
// SECURITY HEADERS
// ─────────────────────────────────────────────────────────────────

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:");
  next();
}

// ─────────────────────────────────────────────────────────────────
// RAW BODY CAPTURE (for webhook signature verification)
// ─────────────────────────────────────────────────────────────────

export function captureRawBody(req, res, next) {
  let data = "";

  req.on("data", (chunk) => {
    data += chunk;
  });

  req.on("end", () => {
    req.rawBody = data;
    next();
  });
}

// ─────────────────────────────────────────────────────────────────
// EXPORT RATE LIMITER
// ─────────────────────────────────────────────────────────────────

export const createRateLimiter = (maxRequests, windowMs) => {
  return new RateLimiter(maxRequests, windowMs);
};

export default {
  validatePublicKey,
  validateAmount,
  validateEmail,
  validateFrequency,
  validatePaymentPayload,
  sanitizeString,
  validateAddPaymentRequest,
  validateWalletParam,
  verifyWebhookSignature,
  auditLogger,
  requestLogger,
  securityHeaders,
  captureRawBody,
  createRateLimiter,
};
