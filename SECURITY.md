# PayStream — Security & Best Practices

This document covers security implementation, wallet safety, and production hardening.

---

## 🔐 Security Layers Implemented

### 1. Input Validation
All API endpoints validate and sanitize input:
```javascript
// Validates Solana wallet addresses
validatePublicKey(address)

// Validates payment amounts (0 < amount < 1B)
validateAmount(amount)

// Validates payment frequencies
validateFrequency(frequency)

// Sanitizes string inputs (removes <>" etc)
sanitizeString(input, maxLength)
```

**Location**: [middleware.js](middleware.js)

### 2. Rate Limiting
Protects against abuse and DDoS:
```javascript
// General API: 100 requests/minute per IP
app.use("/api/", generalLimiter)

// Webhooks: 10 calls/minute per IP
app.use("/webhook/", webhookLimiter)

// Payment adds: 20 requests/minute per IP
paymentLimiter.middleware()
```

### 3. Webhook Verification
QuickNode webhooks are cryptographically signed:
```javascript
// Signature header: x-quicknode-signature
// Uses: HMAC-SHA256 with WEBHOOK_SECRET
verifyWebhookSignature(req, res, next)
```

**How it works**:
1. QuickNode signs webhook payload with WEBHOOK_SECRET
2. We verify the signature matches
3. Prevents spoofed webhook requests

### 4. Audit Logging
Every critical action is logged:
```javascript
auditLogger.logPaymentScheduled(payment)
auditLogger.logPaymentExecuted(payment, txId)
auditLogger.logPaymentFailed(payment, error)
auditLogger.logWebhookReceived(success, details)
auditLogger.logUnauthorizedAttempt(endpoint, reason)
```

**Logs saved to**: `./logs/audit-YYYY-MM-DD.log`

**Format**: JSON lines (one event per line)

### 5. Security Headers
HTTP response headers prevent common attacks:
```
X-Content-Type-Options: nosniff          (prevent MIME sniffing)
X-Frame-Options: DENY                    (prevent clickjacking)
X-XSS-Protection: 1; mode=block          (enable XSS filter)
Strict-Transport-Security: ...           (enforce HTTPS)
Content-Security-Policy: ...             (prevent injection)
```

### 6. Authentication
Two levels of auth:

**Webhook Auth** (from QuickNode):
```javascript
// Header: x-paystream-secret
if (secret !== process.env.WEBHOOK_SECRET) {
  return res.status(401).json({ error: "Unauthorized" })
}
```

**Admin Auth** (for manual triggers):
```javascript
// Header: x-admin-secret
if (adminSecret !== process.env.ADMIN_SECRET) {
  return res.status(401).json({ error: "Unauthorized" })
}
```

---

## 🛡️ Secrets & Credentials Management

### Never Hardcode Secrets
✅ Use environment variables (.env)
✅ Keep .env in .gitignore
✅ Rotate secrets regularly

### Critical Secrets
```
SERVER_KEYPAIR         - Server wallet private key (signs on-chain tx)
WEBHOOK_SECRET         - QuickNode webhook validation
ADMIN_SECRET           - Manual payroll trigger
SUPABASE_ANON_KEY      - Database access
BIRDEYE_API_KEY        - Price feed access
QUICKNODE_API_KEY      - RPC + Streams access
```

### Devnet vs Mainnet

**DEVNET** (Testing):
- Use free/test API keys
- Use devnet RPC endpoints
- SERVER_KEYPAIR can be test wallet (no real funds)
- Secrets can be simpler

**MAINNET** (Production):
- Use production API keys
- Use mainnet RPC endpoints
- SERVER_KEYPAIR must be funded with real SOL
- Secrets should be 32+ random characters
- Use secret management service (AWS Secrets, HashiCorp Vault, etc.)

---

## 💳 Wallet Security

### Server Keypair
**The most critical secret** — signs every payment transaction

```javascript
// Load from .env (never hardcode!)
const keypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(process.env.SERVER_KEYPAIR))
);

// Used to sign transactions
await sendAndConfirmTransaction(connection, transaction, [keypair]);
```

**Best Practices**:
- ✅ Keep in .env (excluded from git)
- ✅ Rotate on schedule (monthly)
- ✅ Fund with minimum needed SOL (not 1000s)
- ✅ Use a dedicated server wallet (not your personal wallet)
- ✅ Monitor for unusual activity

### Contractor Wallets
User-provided Solana addresses (no private keys stored)

**Validation**:
```javascript
try {
  new PublicKey(contractorWallet);
  // Valid Solana address
} catch {
  // Invalid address
}
```

### Business Wallet
Connected via Solflare — users sign transactions themselves

---

## 🔍 On-Chain Security

### Transaction Memo
Every payment includes on-chain memo:
```
PayStream:{paymentId}:{amount}:{timestamp}
```
Provides auditable record even on public blockchain

### Atomic Execution
Two-step payment with automatic retry:
1. Withdraw from Kamino vault
2. Transfer to contractor

If step 2 fails, step 1's funds remain in business ATA

### Slippage Protection
Kamino operations include 0.1% slippage tolerance
```javascript
body: JSON.stringify({
  slippage: 0.001,  // 0.1% max slippage
})
```

---

## 🚨 Error Handling

### Secure Error Responses

**User-facing** (safe):
```json
{
  "error": "Invalid payment data",
  "details": ["Invalid contractorWallet"]
}
```

**Debug mode** (only in development):
```javascript
// Only if DEBUG=true in .env
message: process.env.DEBUG === "true" ? err.message : undefined
```

### No Sensitive Info in Errors
❌ Don't expose:
- Full stack traces
- Database connection strings
- Private key details
- Internal server paths

✅ Log detailed errors to audit log (safe location)

---

## 📊 Audit Trail

### What Gets Logged
- ✅ Payment scheduled (who, what amount, when)
- ✅ Payment executed (transaction ID)
- ✅ Payment failed (error reason)
- ✅ Webhook received (success/failure)
- ✅ Unauthorized attempts (IP, reason)
- ✅ API errors (endpoint, error)

### Log Files
```
./logs/audit-2026-05-03.log   (one per day)
./logs/audit-2026-05-04.log
```

**Format**: One JSON object per line
```json
{"timestamp":"2026-05-03T12:34:56.789Z","event":"PAYMENT_EXECUTED","details":{...}}
```

### Monitoring
```bash
# View today's activity
tail -f ./logs/audit-$(date +%Y-%m-%d).log

# Search for errors
grep "ERROR" ./logs/audit-*.log

# Search for specific wallet
grep "abc123def456" ./logs/audit-*.log
```

---

## 🔄 Deployment Security

### Before Going Live

- [ ] Change all WEBHOOK_SECRET and ADMIN_SECRET
- [ ] Use mainnet QuickNode endpoint
- [ ] Use mainnet Birdeye API key
- [ ] Set NETWORK=mainnet-beta in production
- [ ] Set DEBUG=false in production
- [ ] Use production DATABASE_URL
- [ ] Enable HTTPS on frontend
- [ ] Set up SSL certificate (Railway/Render auto)
- [ ] Configure CORS properly (not "*")
- [ ] Enable request logging/monitoring
- [ ] Set up alerts for errors

### Environment Checklist

```bash
# ✅ DEVNET
NETWORK=devnet
QUICKNODE_RPC_URL=https://api.devnet.solana.com
DEBUG=true

# ✅ PRODUCTION
NETWORK=mainnet-beta
QUICKNODE_RPC_URL=https://your-endpoint.solana-mainnet.quiknode.pro/YOUR_KEY/
DEBUG=false
```

---

## 🆘 Incident Response

### If Keypair is Compromised
1. **Immediately** disable the wallet (don't use for new payments)
2. Move remaining SOL to new wallet
3. Generate new keypair
4. Update .env and redeploy
5. Audit transaction logs for unauthorized payments
6. Notify affected contractors

### If WEBHOOK_SECRET is Leaked
1. Change WEBHOOK_SECRET in .env
2. Update in QuickNode dashboard
3. Redeploy backend
4. Revoke old secret from QuickNode

### If Database is Breached
1. Check Supabase audit logs
2. Rotate SUPABASE_ANON_KEY
3. Enable Row-Level Security on tables
4. Audit payment records for tampering

---

## 🔗 Related Docs

- [DEVNET_SETUP.md](DEVNET_SETUP.md) - Local testing setup
- [MAINNET_DEPLOYMENT.md](MAINNET_DEPLOYMENT.md) - Production deployment
- [middleware.js](middleware.js) - Security middleware implementation
- [.env.example](.env.example) - Environment variables reference

