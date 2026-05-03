# PayStream Mainnet Deployment Guide

## Pre-Submission Checklist (Before Mainnet)

You must be on mainnet for final submission per hackathon rules. Follow these steps.

---

## Step 1: Get Mainnet SOL (1-2 SOL needed)

**Option A**: Purchase SOL (easiest)
- Phantom Wallet, Magic Eden, or any exchange
- Send to your server wallet address (see Step 2)

**Option B**: Airdrop (if eligible)
- Solana Foundation devnet airdrop has ended
- Purchase is recommended approach

---

## Step 2: Generate Mainnet Server Keypair

```bash
cd paystream
node -e "import('./execute.js').then(m => m.generateServerKeypair())"
```

**Output** will be:
```
🔑 Server Keypair Generated
  Public Key:  YOUR_MAINNET_ADDRESS
  Private Key: [array of numbers]
```

**Fund this wallet** with 1-2 SOL (for transaction fees and vault deposits)

---

## Step 3: Update .env for Mainnet

Change these values:

```bash
# Network
NETWORK=mainnet-beta

# QuickNode (get mainnet endpoint from QuickNode dashboard)
QUICKNODE_RPC_URL=https://your-mainnet-endpoint.solana-mainnet.quiknode.pro/YOUR_KEY/
QUICKNODE_WS_URL=wss://your-mainnet-endpoint.solana-mainnet.quiknode.pro/YOUR_KEY/

# Server Keypair (from Step 2)
SERVER_KEYPAIR=[... your mainnet keypair array ...]

# Birdeye (same API key works for mainnet)
BIRDEYE_API_KEY=58172f348da548c893285476b426948d
```

---

## Step 4: Test Mainnet Connectivity

```bash
node -e "
import('./paystream.js').then(async m => {
  const health = await m.getPaymentsByBusiness('test');
  console.log('✅ Mainnet RPC connected:', health);
}).catch(e => console.error('❌ Error:', e.message));
"
```

**Expected**: Returns network health status without errors

---

## Step 5: Deploy Backend

### Option 1: Railway (Recommended - Free tier works)

1. **Install Railway CLI**: `npm install -g @railway/cli`
2. **Login**: `railway login`
3. **Initialize project**: 
   ```bash
   railway init
   ```
4. **Set environment variables**:
   ```bash
   railway variables set NETWORK=mainnet-beta
   railway variables set QUICKNODE_RPC_URL=your_mainnet_rpc
   railway variables set QUICKNODE_WS_URL=your_mainnet_ws
   railway variables set SERVER_KEYPAIR='[...]'
   railway variables set BIRDEYE_API_KEY=your_key
   ```
5. **Deploy**:
   ```bash
   railway up
   ```
6. **Get URL**: `railway open` → Copy public URL

### Option 2: Render

1. **Create account**: [render.com](https://render.com)
2. **New Web Service** → Connect GitHub repo
3. **Build command**: `npm install`
4. **Start command**: `node server.js`
5. **Add environment variables** (same as Railway)
6. **Deploy**

### Option 3: Vercel (Backend + Frontend)

1. **Install Vercel CLI**: `npm install -g vercel`
2. **Deploy**: `vercel`
3. **Set secrets** in Vercel dashboard
4. **Get URL**

---

## Step 6: Update Frontend URLs

If hosting frontend separately (optional):

**index.html** (or frontend config):
```javascript
const API_URL = "https://your-deployed-backend.railway.app";
const WEBHOOK_URL = "https://your-deployed-backend.railway.app/webhook/payroll";
```

---

## Step 7: Configure QuickNode Webhook (for production)

1. **QuickNode Dashboard** → Select Mainnet Endpoint
2. **Streams** → Create New Stream
3. **Event Type**: Transaction (filter to your program)
4. **Webhook URL**: `https://your-deployed-backend.railway.app/webhook/payroll`
5. **Secret**: Copy and paste into `.env` as `WEBHOOK_SECRET`

---

## Step 8: Test on Mainnet

### Dry Run (no broadcast):
```bash
curl -X POST https://your-deployed-backend.railway.app/api/health
```

### Simulate Payment:
```bash
curl -X POST https://your-deployed-backend.railway.app/api/payments/run \
  -H "Content-Type: application/json" \
  -d '{
    "payments": [
      {"to": "YOUR_TEST_WALLET.sol", "amount": 0.01}
    ]
  }'
```

**Response** should show transaction signature or pending status.

---

## Step 9: Execute Real Test Payment

**Pick a small amount** (0.01 USDC) and test:

```bash
curl -X POST https://your-deployed-backend.railway.app/api/payments/run \
  -H "Content-Type: application/json" \
  -d '{
    "payments": [
      {"to": "contractor_wallet.sol", "amount": 0.01}
    ]
  }'
```

**Verify**:
1. Check transaction on [Solana Explorer](https://explorer.solana.com)
2. Confirm USDC received in contractor wallet
3. Confirm Kamino vault withdrawal completed
4. Log the transaction signature (for demo proof)

---

## Step 10: Update Submission Info

Before submitting to Superteam Earn, you'll need:

- **Live dApp URL**: `https://your-deployed-backend.railway.app`
- **GitHub Repo**: Commit all code + docs
- **Primary Partner**: Kamino (Yield) or QuickNode (Webhooks) — choose one
- **Secondary Partner**: Both

---

## Troubleshooting

### "500 Kamino vault error"
- Mainnet Kamino vault address is different
- Check: [Kamino Docs](https://kamino.finance/docs)
- Update `KAMINO_USDC_VAULT` constant in execute.js

### "Transaction failed: insufficient funds"
- Server wallet needs more SOL
- Send additional 1-2 SOL to server public key

### "QuickNode RPC rate limit"
- Upgrade QuickNode plan (free tier has limits)
- Or use public RPC as fallback

### "Birdeye API returning 401"
- Verify API key is correct
- Check Birdeye dashboard for key status

---

## Rollback to Devnet

If you need to revert:

```bash
# Update .env
NETWORK=devnet
QUICKNODE_RPC_URL=https://smart-fluent-dew.solana-devnet.quiknode.pro/...
```

---

## Cost Breakdown

- **QuickNode**: Free tier or ~$20/mo paid (100M compute units/mo)
- **Railway/Render**: Free tier for small deployments
- **Mainnet SOL**: 1-2 SOL (~$100-200 at current prices)
- **Domain (optional)**: $12/year

**Total startup**: ~$100-200

---

## Post-Submission

After hackathon submission:
- Keep dApp live for 30+ days (judging criteria)
- Monitor for real user activity
- Document any bugs/improvements
- Prepare for potential investor outreach

---

**Ready to deploy?** Start with Step 1!
