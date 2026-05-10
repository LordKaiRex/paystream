# ⚡ PayStream — Solana Payroll Infrastructure

> **"Deel on Solana, with your idle treasury earning yield while you sleep."**

Built for the **Colosseum Frontier Hackathon 2026** · Eitherway Sidetrack

---

## 🎯 The Problem

50M+ remote workers and contractors globally are paid through:
- **Wire transfers**: 3–5 day delays, $25–50 fees per transaction, FX losses
- **Deel / Remote**: 3–8% total cost, requires bank accounts, excludes the unbanked
- **Manual crypto payments**: No scheduling, no automation, no yield

Meanwhile, businesses hold **millions in idle USDC** in their treasury — earning nothing — while waiting for payroll day.

## ✨ The Solution

PayStream is a **production-grade payroll platform on Solana** that:

1. **Deposits business treasury into Kamino Earn vaults** → earns 6–8% APY automatically while waiting for payday
2. **Schedules recurring payments** to contractor wallet addresses (weekly / bi-weekly / monthly)
3. **Auto-withdraws from Kamino and pays contractors** on schedule via QuickNode webhooks
4. **Displays live token prices via Birdeye** for FX-aware payments in SOL or any SPL token
5. **Connects via Solflare wallet** for secure, non-custodial signing

**Net result:** Businesses pay contractors in <1 second globally, with zero FX fees, AND earn yield on funds until disbursement. The yield alone pays for the platform.

---

## 🏗️ Integration Architecture

```
Business (Solflare Wallet)
         │
         ▼
┌─────────────────────────────────────────────┐
│              PayStream Frontend              │
│         (Eitherway · React/HTML)             │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┼───────────────────────────┐
       │       │                           │
       ▼       ▼                           ▼
  ┌─────────┐ ┌─────────────────┐  ┌────────────────┐
  │ Kamino  │ │    Birdeye      │  │   QuickNode    │
  │ Finance │ │  Price Oracle   │  │  RPC + Stream  │
  └────┬────┘ └────────┬────────┘  └───────┬────────┘
       │               │                   │
       ▼               ▼                   ▼
  USDC Earn      Live Prices          Webhook Trigger
  7.2% APY      SOL/USDC/JUP         on Payment Day
       │                                   │
       └──────────────┬────────────────────┘
                      │
                      ▼
              Contractor Wallets
              (instant, global)
```

---

## 🔌 Sponsor Integrations

### ⚗️ Kamino Finance
- Business USDC deposited into Kamino USDC Earn vault (kUSDC)
- Auto-compounding yield: currently **7.2% APY**
- Auto-withdraws the exact amount needed before each payroll run
- Uses Kamino REST API for deposit/withdraw unsigned transactions
- SDK: `@kamino-finance/klend-sdk`

### 🐦 Birdeye
- Live token prices displayed in topbar ticker (SOL, USDC, JUP)
- FX calculator: "Pay $3,200 in SOL" → real-time conversion
- Historical price at time of payment stored for contractor records
- API: `GET /defi/multi_price`

### ⚡ QuickNode
- RPC endpoint for all Solana transactions (fast, reliable, no rate limits)
- **QuickNode Streams** webhook fires on payroll day → triggers automated payout
- WebSocket connection for real-time transaction confirmation

### 🌐 Solflare
- Primary wallet adapter for business dashboard login
- Signs Kamino deposit/withdraw transactions
- Contractor portal: connect Solflare to view payment history
- Fallback: Phantom wallet support

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- A Solana wallet (Solflare or Phantom recommended)

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy the example and fill in your credentials:

```bash
cp env.example .env
```

Then populate `.env`:

```bash
# QuickNode RPC endpoint
QUICKNODE_RPC_URL=https://your-endpoint.solana-mainnet.quiknode.pro/YOUR_KEY/
QUICKNODE_WS_URL=wss://your-endpoint.solana-mainnet.quiknode.pro/YOUR_KEY/

# Birdeye API key
BIRDEYE_API_KEY=your_birdeye_api_key

# Server keypair (generate with command below)
SERVER_KEYPAIR=[...]

# Admin secret for testing
ADMIN_SECRET=your_admin_secret
WEBHOOK_SECRET=your_webhook_secret

# Frontend URL (set after deployment)
FRONTEND_URL=http://localhost:3000
```

### 3. Generate Server Keypair

```bash
node -e "import('./execute.js').then(m => m.generateServerKeypair())"
```

Copy the output to `.env`:

```bash
SERVER_KEYPAIR=[12,34,56,...]
```

**Important:** Fund this address with ~0.05 SOL for transaction fees.

### 4. Start the Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### 5. Open Frontend

Open `index.html` in your browser or serve it:

```bash
# Using Python
python -m http.server 8000

# Or using Node
npx http-server .
```

Visit `http://localhost:8000` in your browser.

---

## 📋 File Structure

```
paystream/
├── server.js               # Express backend with all API endpoints
├── paystream.js           # Core integration engine (Kamino, Birdeye, etc.)
├── execute.js             # On-chain transaction executor
├── api-client.js          # Frontend API client + wallet integration
├── index.html             # Full-featured dashboard UI
├── test-devnet.js         # Devnet testing utilities
├── package.json           # Dependencies
├── env.example            # Environment template
├── README.md              # This file
└── .gitignore             # Git ignore rules
```

---

## 🧪 Testing

### Automated Test Suite

Run comprehensive API tests:

```bash
# Make sure backend is running (npm run dev)
npm test
```

Expected output: All tests pass ✅

**Test Coverage:**
- Input validation (invalid wallets, amounts, frequencies)
- Authorization (webhook secret, admin secret)
- Rate limiting (100 req/min per IP)
- Error handling (404s, 500s, invalid JSON)
- Payload validation (required fields, data types)

### Devnet Testing

For complete step-by-step devnet setup, see [DEVNET_SETUP.md](DEVNET_SETUP.md):

```bash
# Quick start:
cp .env.example .env
# Edit .env: NETWORK=devnet, add your API keys
npm install
npm run dev
npm test
```

---

## 🔐 Security Features

PayStream implements production-grade security:

### ✅ Input Validation
- Validates all Solana wallet addresses
- Sanitizes string inputs (no XSS/injection attacks)
- Enforces valid payment amounts (0 < amount < 1B)
- Validates payment frequencies

### ✅ Rate Limiting
- General API: 100 requests/minute per IP
- Webhooks: 10 calls/minute per IP
- Payment adds: 20 requests/minute per IP

### ✅ Webhook Verification
- QuickNode webhooks signed with HMAC-SHA256
- Verifies `x-quicknode-signature` header
- Prevents spoofed webhook requests

### ✅ Audit Logging
- Every payment action logged to `./logs/audit-YYYY-MM-DD.log`
- Includes: payment scheduled, executed, failed, errors, unauthorized attempts
- JSON format for monitoring/alerting

### ✅ Security Headers
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection enabled
- Strict-Transport-Security (HTTPS)
- Content-Security-Policy

### ✅ Error Handling
- Sensitive errors logged, user-friendly responses
- No stack traces in production
- Debug mode for development only

For full security details, see [SECURITY.md](SECURITY.md)

---

## 📊 Database Integration (Supabase)

PayStream supports persistent storage for production:

### Setup Supabase (Optional for Devnet)

```bash
# 1. Create project at https://supabase.com
# 2. Get credentials from Settings → API
# 3. Add to .env:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_key

# 4. Database auto-initializes on first payment
```

**Stores:**
- Payment schedules (with frequency and status)
- Transaction history (success/failure/amount)
- Audit trail (who, what, when)

**Without Supabase:**
- Uses in-memory database (data lost on restart)
- Fine for devnet testing
- Not recommended for production

---

## 📦 Deployment

### Option 1: Railway (Recommended)

```bash
# Login
railway login

# Create project
railway init

# Deploy
railway up
```

### Option 2: Render

1. Create a new Web Service on Render
2. Connect your GitHub repo
3. Set environment variables in Render dashboard
4. Deploy

### Option 3: Fly.io

```bash
# Install fly
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
fly deploy
```

### Frontend Deployment

Deploy `index.html` and `api-client.js` to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

Update `FRONTEND_URL` in `.env` after deployment.

---

## 🔧 API Endpoints

### Health & Status
- `GET /` — Server status
- `GET /api/health` — Health check

### Treasury (Kamino)
- `GET /api/treasury/:wallet` — Get vault position
  - Response: `{ depositedUSDC, shares, sharePrice, dailyYield, monthlyYield, apy }`

### Prices (Birdeye)
- `GET /api/prices` — Get live token prices
  - Response: `{ [tokenAddress]: { price, change24h, symbol } }`

### Payments
- `GET /api/payments/due` — Get payments due today
- `GET /api/payments/business/:wallet` — Get all payments for business
- `POST /api/payments/add` — Schedule new payment
  - Body: `{ contractorName, contractorWallet, amountUSDC, frequency, nextPaymentDate, businessWallet? }`
  - `businessWallet` is optional; schedule payments without connecting a wallet
- `POST /api/payments/run` — Manual payroll trigger (demo)
  - Header: `x-admin-secret: <ADMIN_SECRET>`

### Webhooks
- `POST /webhook/payroll` — QuickNode Stream trigger
  - Header: `x-paystream-secret: <WEBHOOK_SECRET>`

---

## 🎬 Live Demo

1. **Connect Wallet** — Click "Connect Solflare" in bottom left
2. **View Treasury** — See Kamino vault balance and live APY
3. **Schedule Payment** — Click "+ Add" to schedule contractor payment
4. **View Prices** — Real-time SOL/USDC/JUP prices in topbar
5. **Contractor Portal** — View as contractor receiving payments

---

## 🔐 Security Considerations

### For Production:
- Use a **hardware wallet or multi-sig** for `SERVER_KEYPAIR`
- Store secrets in a vault (AWS Secrets Manager, HashiCorp Vault, etc.)
- Enable HTTPS for all endpoints
- Rate-limit webhook endpoints
- Add request signing (HMAC-SHA256)
- Implement database encryption for sensitive data

### Development:
- Never commit `.env` to git
- Use devnet for all testing
- Test with small amounts first
- Use separate keypair for each environment

---

## 📚 Resources

### Documentation
- **Kamino**: https://docs.kamino.finance/
- **Birdeye**: https://docs.birdeye.so/
- **QuickNode**: https://www.quicknode.com/docs/solana
- **Solflare**: https://docs.solflare.com/
- **Solana Web3.js**: https://solana-labs.github.io/solana-web3.js/

### Useful Commands

```bash
# Start server
npm start

# Development with hot-reload
npm run dev

# Generate server keypair
node -e "import('./execute.js').then(m => m.generateServerKeypair())"

# Check wallet balance
solana balance <wallet_address>

# Airdrop devnet funds
solana airdrop 2 <wallet_address> --url devnet
```

---

## 🎯 Hackathon Judging Criteria

PayStream is optimized for:

| Criterion | Score |
|-----------|-------|
| **Real-world Utility** | ✅ Solves actual contractor payroll problem |
| **Product Quality** | ✅ Production-ready, polished UX, error handling |
| **Integration Depth** | ✅ Deep use of all 4 partner APIs (Kamino, Birdeye, QuickNode, Solflare) |
| **Adoption Potential** | ✅ Clear path to real users, active development |

---

## 🤝 Contributing

To extend PayStream:

1. Add database support (Supabase PostgreSQL)
2. Implement multi-sig wallet support
3. Add more token support (JUP, USDT, SOL)
4. Create Telegram bot for payment notifications
5. Build admin dashboard for managing multiple businesses
6. Add tax reporting/export features

---

## 📄 License

MIT

---

## 💬 Support

- **Telegram**: [Join PayStream Community](https://t.me/paystream)
- **GitHub Issues**: Report bugs and feature requests
- **Discord**: Join Solana dev community

---

## 🚀 Next Steps

1. ✅ Setup `.env` with your API keys
2. ✅ Generate `SERVER_KEYPAIR`
3. ✅ Fund keypair with 0.05 SOL
4. ✅ Start server: `npm run dev`
5. ✅ Open frontend and connect wallet
6. ✅ Schedule test payments
7. ✅ Deploy to mainnet

**Good luck! 🎉**

---

*Built with ❤️ for Solana developers. "Ship it" - Eitherway, 2026*
```

### .env
```
QUICKNODE_RPC_URL=https://your-quicknode-endpoint.solana-mainnet.quiknode.pro/xxx/
QUICKNODE_WS_URL=wss://your-quicknode-endpoint.solana-mainnet.quiknode.pro/xxx/
QUICKNODE_API_KEY=your_quicknode_api_key
QUICKNODE_STREAMS_URL=https://api.quicknode.com/streams/rest/v1
BIRDEYE_API_KEY=your_birdeye_api_key
WEBHOOK_SECRET=your_random_secret_string
WEBHOOK_URL=https://your-deployed-backend.railway.app
ADMIN_SECRET=your_admin_secret
PORT=3001
```

### Run frontend
```bash
# Open index.html in browser — fully functional demo
open index.html
```

### Run backend
```bash
node server.js
```

---

## Key Files

| File | Purpose |
|------|---------|
| `index.html` | Full production UI — business dashboard + contractor portal |
| `paystream.js` | Core SDK — Kamino, Birdeye, QuickNode, Solflare integrations |
| `server.js` | Express backend — QuickNode webhook handler, payroll executor |
| `README.md` | This file |

---

## Business Model

| Revenue Stream | Detail |
|---------------|--------|
| **Platform fee** | 0.5% of payroll processed |
| **Yield spread** | Keep 0.5% of Kamino APY (e.g. earn 7.2%, pass 6.7% to users) |
| **Premium tier** | $99/mo for teams >10 contractors (advanced analytics, multi-sig) |

**Unit economics:** A business with $100K monthly payroll → $500/month platform fee + we earn ~$40/mo yield spread = **$540 MRR per business**.

---

## Roadmap

- [ ] Multi-sig treasury for DAO payroll
- [ ] CSV payroll import (from Notion/Airtable)
- [ ] Tax reporting export (1099 equivalent)
- [ ] Fiat on-ramp integration (MoonPay)
- [ ] Mobile app (Solana Mobile / Seeker)
- [ ] zkTLS-verified employment contracts (Arcium)

---

## Team

Built during Colosseum Frontier Hackathon 2026.

---

## License

MIT
