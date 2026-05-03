# 🧪 PayStream — Devnet Setup Guide

**Goal**: Get PayStream running on Solana Devnet for testing and development.

**Timeline**: ~30-45 minutes

**By the end**, you'll have:
- ✅ Backend running on devnet
- ✅ Local API tests passing
- ✅ Frontend connecting to devnet services
- ✅ Test wallet funded with devnet SOL
- ✅ Database configured (optional Supabase)

---

## Prerequisites

```bash
# Node.js 18+
node --version

# npm or yarn
npm --version
```

---

## Step 1: Clone & Install (5 min)

```bash
cd paystream

# Install dependencies
npm install

# Verify installation
npm --version
```

**Expected output**: No errors, packages installed successfully

---

## Step 2: Generate Test Keypair (2 min)

This creates a new wallet for devnet testing.

```bash
# Generate keypair
node -e "
import('./execute.js').then(m => m.generateServerKeypair()).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
"
```

**Expected output**:
```
✓ Public key: So11111111111111111111111111111111111111112
✓ Keypair saved to: ./server-keypair.json

⚠️  IMPORTANT:
   Copy this to .env as SERVER_KEYPAIR=[1,2,3,...]
   Fund this wallet with devnet SOL before running payroll
```

Copy the public key and keypair array for next steps.

---

## Step 3: Create .env File (3 min)

```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your values
# Use nano, vi, or VS Code
```

**Fill these critical fields:**

```env
# 🌐 NETWORK
NETWORK=devnet

# 🔌 QUICKNODE (Get from dashboard.quicknode.com)
QUICKNODE_RPC_URL=https://your-endpoint.solana-devnet.quiknode.pro/YOUR_KEY/
QUICKNODE_DEVNET_RPC=https://your-endpoint.solana-devnet.quiknode.pro/YOUR_KEY/

# 🐦 BIRDEYE (Get from docs.birdeye.so)
BIRDEYE_API_KEY=your_birdeye_free_api_key

# 🔑 SERVER KEYPAIR (from step 2)
SERVER_KEYPAIR=[1,2,3,...64 bytes...]

# 🔐 SECRETS (Generate with: openssl rand -base64 32)
WEBHOOK_SECRET=random_secret_here
ADMIN_SECRET=random_admin_secret_here

# 💾 DATABASE (Optional - see Supabase section below)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_key

# 🎯 URLS (Local development)
FRONTEND_URL=http://localhost:8000
WEBHOOK_URL=http://localhost:3001
PORT=3001

# 🐛 DEBUG
DEBUG=true
```

**Verify the file:**
```bash
cat .env | grep NETWORK
# Should output: NETWORK=devnet
```

---

## Step 4: Fund Devnet Wallet (3 min)

Get free SOL on devnet:

```bash
# Get your public key from step 2
# Then go to: https://faucet.solana.com/
# Paste your public key and airdrop 2 SOL

# Or use CLI (if installed):
solana airdrop 2 So11111111111111111111111111111111111111112 --url devnet
```

**Verify funding:**
```bash
# Check balance (requires Solana CLI)
solana balance --url devnet So11111111111111111111111111111111111111112

# Expected: 2 SOL
```

---

## Step 5: Start Backend Server (5 min)

```bash
# Start in watch mode (auto-reload on changes)
npm run dev

# Or start normally:
npm start
```

**Expected output:**
```
╔═══════════════════════════════════════════════════════════╗
║           🚀 PayStream Server Running                     ║
╠═══════════════════════════════════════════════════════════╣
║  Port:         3001                                      
║  Environment:  devnet                             
║  Executor:     ✓ Ready                          
║  Frontend:     any                        
╚═══════════════════════════════════════════════════════════╝
```

If you see `Executor: ✓ Ready`, you're good! ✅

---

## Step 6: Test Backend API (5 min)

In a **new terminal**:

```bash
# Health check
curl http://localhost:3001/api/health

# Expected:
{
  "status": "ok",
  "timestamp": "2026-05-03T12:34:56.789Z",
  "executorReady": true
}
```

**More tests:**
```bash
# Get prices
curl http://localhost:3001/api/prices

# Get payments due
curl http://localhost:3001/api/payments/due

# Run full test suite
npm test
```

Expected: All tests pass ✅

---

## Step 7: Optional - Setup Supabase Database (15 min)

For persistent payment records (recommended for devnet testing):

### 7a. Create Supabase Project

1. Go to https://supabase.com
2. Sign up or login
3. Click **"New Project"**
4. Select **"Free" plan**
5. Name it: `paystream-devnet`
6. Wait for provisioning (~2 min)

### 7b. Create Tables

In **Supabase Dashboard** → **SQL Editor**, run:

```sql
-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network TEXT NOT NULL,
  business_wallet TEXT NOT NULL,
  contractor_wallet TEXT NOT NULL,
  contractor_name TEXT NOT NULL,
  amount_usdc NUMERIC NOT NULL,
  frequency TEXT DEFAULT 'monthly',
  next_payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_executed TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  UNIQUE(network, contractor_wallet, business_wallet)
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network TEXT NOT NULL,
  business_wallet TEXT NOT NULL,
  contractor_wallet TEXT NOT NULL,
  amount_usdc NUMERIC NOT NULL,
  transaction_id TEXT,
  status TEXT,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_payments_network ON payments(network);
CREATE INDEX idx_payments_due ON payments(network, status, next_payment_date);
CREATE INDEX idx_transactions_contractor ON transactions(contractor_wallet);
```

### 7c. Get API Credentials

1. Go to **Settings** → **API**
2. Copy:
   - `Project URL` → `SUPABASE_URL` in .env
   - `anon public` key → `SUPABASE_ANON_KEY` in .env

### 7d. Update .env

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...your_key...
```

### 7e. Restart Backend

```bash
# Kill the running server (Ctrl+C)
# Restart
npm run dev

# Check logs
# Should see: ✓ Supabase connected (devnet)
```

---

## Step 8: Start Frontend (3 min)

In another terminal:

```bash
# Option 1: Python HTTP server
python -m http.server 8000

# Option 2: Node http-server
npx http-server . --port 8000

# Option 3: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

**Expected output:**
```
Serving HTTP on http://localhost:8000
```

Open: http://localhost:8000 in browser

---

## Step 9: Test Frontend (5 min)

### 9a. Check Dashboard

1. Open http://localhost:8000
2. Look for:
   - ✅ "Dashboard" page loads
   - ✅ Network shows "devnet"
   - ✅ Top-right shows real SOL/USDC prices

### 9b. Test Wallet Connection

1. Install **Solflare** browser extension
2. Create/import devnet wallet
3. Click "Connect Wallet" on PayStream
4. Should see your wallet address

### 9c. Add Test Payment

1. Go to **"Payroll"** tab
2. Click **"+ Add Payment"**
3. Fill:
   - Contractor: "Test Contractor"
   - Wallet: Your other test wallet
   - Amount: 100 USDC
   - Frequency: Monthly
4. Click **"Schedule Payment"**
5. Should see success toast 🎉

### 9d. View Payments

1. Go to **"Treasury"** tab
2. Should show:
   - Mock Kamino vault balance
   - 7.2% APY
   - Daily/monthly yield

---

## Step 10: Run Full Integration Test (5 min)

```bash
# Terminal 1: Backend running (from Step 5)
# npm run dev

# Terminal 2: Run test suite
npm test

# Expected output:
# ✅ Passed: 15+
# ❌ Failed: 0
# 🎉 All tests passed!
```

---

## Troubleshooting

### "Executor not configured"

**Problem**: Server shows `Executor: ✗ Not Configured`

**Solution**:
```bash
# Check SERVER_KEYPAIR is set
grep SERVER_KEYPAIR .env

# If empty or invalid, regenerate:
node -e "import('./execute.js').then(m => m.generateServerKeypair())"

# Copy the new keypair to .env
```

### "QUICKNODE_RPC_URL not found"

**Problem**: API errors with RPC connection

**Solution**:
```bash
# Verify .env has QuickNode URL
grep QUICKNODE_RPC_URL .env

# For devnet, use this instead:
QUICKNODE_DEVNET_RPC=https://api.devnet.solana.com

# Or get free QuickNode endpoint:
# 1. Go to https://dashboard.quicknode.com
# 2. Sign up
# 3. Create Endpoint → Solana Devnet
# 4. Copy the URL to .env
```

### "Supabase connection failed"

**Problem**: Database errors when adding payments

**Solution**:
```bash
# Either:
# 1. Set SUPABASE_URL and SUPABASE_ANON_KEY correctly
# 2. Or leave them empty to use in-memory database

# Check logs:
grep Supabase .env
```

### Wallet balance is 0

**Problem**: Can't execute payments

**Solution**:
```bash
# Your SERVER_KEYPAIR wallet needs SOL for fees
# 1. Get your public key from step 2
# 2. Go to https://faucet.solana.com/
# 3. Paste wallet address, airdrop 2 SOL
# 4. Verify: solana balance --url devnet <address>
```

---

## Next Steps After Devnet Testing

✅ **Devnet working?** Now you're ready for:

1. **Deploy to Production**
   - See [MAINNET_DEPLOYMENT.md](MAINNET_DEPLOYMENT.md)
   - Deploy backend to Railway/Render
   - Deploy frontend to Vercel

2. **Record Demo Video**
   - Show frontend connecting wallet
   - Add payment and execute
   - Show transaction on Solana Explorer

3. **Submit to Hackathon**
   - Push to GitHub (make it public)
   - Submit to Superteam (see SUBMISSION_CHECKLIST.md)

---

## Useful Commands

```bash
# Watch logs while developing
npm run dev

# Run tests
npm test

# Check network status
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# View Solana Explorer (devnet)
# https://explorer.solana.com/?cluster=devnet

# Get devnet token prices
curl "https://public-api.birdeye.so/defi/multi_price?list_address=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" \
  -H "X-API-KEY: your_birdeye_key"
```

---

## Quick Reference

| Service | URL | Status |
|---------|-----|--------|
| Backend | http://localhost:3001 | ✅ Local |
| Frontend | http://localhost:8000 | ✅ Local |
| Devnet RPC | https://api.devnet.solana.com | ✅ Public |
| Birdeye API | https://public-api.birdeye.so | ✅ Live |
| Supabase | https://supabase.com | ⚙️ Optional |

---

## Success! 🎉

If all tests pass and you can add payments through the UI, your devnet setup is **complete**!

Next: [MAINNET_DEPLOYMENT.md](MAINNET_DEPLOYMENT.md)
