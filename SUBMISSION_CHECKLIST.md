# Superteam Frontier Hackathon — Submission Checklist

**Deadline:** May 12, 2026 (12 days from April 30)  
**Platform:** [superteam.fun/earn](https://superteam.fun/earn)  
**Track:** Kamino (Yield) + QuickNode (Webhooks)

---

## ✅ Submission Requirements Checklist

### Code & Deployment
- [ ] **GitHub Repository Public**
  - [ ] All source code committed
  - [ ] No `.env` files (use `.env.example`)
  - [ ] README.md with quick start instructions
  - [ ] LICENSE file (MIT recommended)
  - [ ] .gitignore excludes node_modules, .env, dist

- [ ] **Live Deployed URL**
  - [ ] Backend live on mainnet (Railway/Render/Vercel)
  - [ ] API endpoints responding (test `/health`)
  - [ ] HTTPS enabled
  - [ ] Domain or public URL ready

- [ ] **Environment Setup Documented**
  - [ ] MAINNET_DEPLOYMENT.md completed
  - [ ] QuickNode endpoint configured
  - [ ] Birdeye API key ready
  - [ ] Server keypair funded with 1-2 SOL

### Documentation
- [ ] **SUBMISSION.md** (Integration overview)
  - [ ] Explains Kamino integration depth
  - [ ] Explains QuickNode integration depth
  - [ ] Shows architecture diagram
  - [ ] Links to code examples

- [ ] **Integration Documentation**
  - [ ] How Kamino vault operations work
  - [ ] How QuickNode webhooks trigger payments
  - [ ] Error handling approach
  - [ ] Test results (test-devnet.js output)

- [ ] **API Documentation**
  - [ ] POST /webhook/payroll endpoint documented
  - [ ] GET /api/health endpoint documented
  - [ ] POST /api/payments/run endpoint documented
  - [ ] Error response formats documented

### Demo & Evidence
- [ ] **Demo Video** (2-3 minutes)
  - [ ] Uploaded to YouTube (unlisted or public)
  - [ ] Shows live payment execution
  - [ ] Shows on-chain transaction verification
  - [ ] Explains Kamino & QuickNode integration
  - [ ] Clearly visible project name/URLs

- [ ] **Live Test Evidence**
  - [ ] Screenshot of devnet test results (14/16 passing)
  - [ ] Transaction ID of test payment on devnet
  - [ ] Solana Explorer screenshot showing USDC transfer
  - [ ] Kamino vault balance change evidence

### Superteam Submission Form
- [ ] **Project Title**: "PayStream: Automated Payroll + Yield Optimization"
- [ ] **Description**: 100-200 words explaining value prop
- [ ] **Live URL**: Deployed backend URL
- [ ] **GitHub URL**: Public repository link
- [ ] **Demo Video**: YouTube link or upload MP4
- [ ] **Primary Track**: Kamino *or* QuickNode (choose one)
- [ ] **Integration Partner Dropdown**: Select Kamino AND QuickNode
- [ ] **Team**: Your name/handle + co-dev info
- [ ] **Onchain Network**: Mainnet

---

## 🎬 Demo Recording Checklist

- [ ] Recorded at 1080p or higher
- [ ] Audio is clear (no background noise)
- [ ] Shows real Solana Explorer transactions
- [ ] Total duration 2-3 minutes
- [ ] Exported as MP4 format (<100 MB)
- [ ] Uploaded to YouTube (or ready for upload)
- [ ] URL accessible and unlisted/public

---

## 🏗️ Code Quality Checklist

- [ ] No console.log spam (use structured logging)
- [ ] Error messages are descriptive
- [ ] .env.example has placeholder values
- [ ] No API keys or secrets in code
- [ ] Code is commented (especially integration code)
- [ ] README has "Installation" section
- [ ] README has "Usage" section
- [ ] All tests passing (or documented why)

---

## 🚀 Deployment Readiness Checklist

### Server
- [ ] Server runs on `node server.js` or `npm start`
- [ ] Server runs on configurable PORT (default 3001)
- [ ] Server loads .env successfully
- [ ] Server starts without errors
- [ ] Health check endpoint works

### QuickNode
- [ ] Mainnet endpoint configured
- [ ] Webhook secret configured
- [ ] Webhook URL in QuickNode dashboard set
- [ ] Can receive test webhooks

### Kamino
- [ ] Mainnet USDC vault address confirmed
- [ ] Server wallet can deposit/withdraw
- [ ] Vault operations tested on devnet
- [ ] APY calculations working

### Birdeye
- [ ] API key valid
- [ ] Price feeds returning data
- [ ] Rate limits understood

---

## 📝 Pre-Submission Review

### 24 hours before deadline:
- [ ] All documentation up to date
- [ ] Demo video uploaded and working
- [ ] Deployed URL tested from fresh browser
- [ ] GitHub repo cloned and tested locally
- [ ] MAINNET_DEPLOYMENT.md follows all steps
- [ ] No sensitive data in git history

### Test workflow one final time:
```bash
# Clone fresh from GitHub
git clone https://github.com/your-username/paystream.git
cd paystream

# Install and test
npm install
cp .env.example .env
# (fill in mainnet values)

# Start server
npm start

# In new terminal, test health
curl http://localhost:3001/health

# Test payment API
curl -X POST http://localhost:3001/api/payments/run \
  -H "Content-Type: application/json" \
  -d '{"payments": [{"to": "test.sol", "amount": 0.01}]}'
```

---

## 📋 Final Submission Form Fields

**On superteam.fun/earn:**

```
Project Title
PayStream: Automated Payroll + Yield Optimization

Short Description (1-2 lines)
Solana payroll automation that extracts yield from Kamino vaults and executes payments via QuickNode webhooks.

Detailed Description (3-5 sentences)
PayStream automates contractor payments while optimizing treasury yield. Teams trigger payments via webhook, 
which automatically withdraws USDC from Kamino vaults (earning 8-12% APY), executes transfers, and reports 
everything on-chain. Built with QuickNode for reliable webhooks and RPC, Kamino for yield extraction, 
and Birdeye for real-time pricing. Production-ready with error handling, transaction validation, and audit logging.

Live URL
https://paystream-prod.railway.app (or your deployed URL)

GitHub Repository
https://github.com/your-username/paystream

Demo Video
https://www.youtube.com/watch?v=xxxxx (or direct MP4)

Primary Integration Track
[ ] Solflare  [ ] DFlow  [X] QuickNode  [ ] Birdeye  [X] Kamino

Team Members
- Your Name (Dev)
- Co-Dev Name (Dev)

Network
[ ] Devnet  [X] Mainnet

Built With (checkboxes)
[X] Kamino Finance
[X] QuickNode
[X] Birdeye
[ ] Solflare
[ ] DFlow
```

---

## 🎯 Judging Criteria Alignment

### Real-World Utility (30%)
✅ **PayStream**: Saves 30-60 min/month, generates $500-1000/year yield

### Product Quality (30%)
✅ **PayStream**: 14/16 tests passing, error handling, retry logic, production-ready

### Integration Depth (25%)
✅ **PayStream**: Deep Kamino (vault operations), Deep QuickNode (webhooks + RPC), Birdeye pricing

### Adoption Potential (15%)
✅ **PayStream**: Clear market (DAOs, teams), demonstrated functionality, live evidence

---

## 🚨 Common Mistakes to Avoid

❌ **Don't:**
- Submit with devnet URL (must be mainnet)
- Leave API keys in GitHub
- Skip documentation
- Record demo on devnet (use mainnet for demo)
- Submit without testing the live URL first
- Choose only one partner (both Kamino + QuickNode recommended)
- Miss the deadline (submit 1 day early)

✅ **Do:**
- Test everything 24 hours before deadline
- Use clear, professional language in description
- Show real transaction evidence
- Explain why your integration is "deep"
- Have GitHub repo ready with full code
- Keep dApp live for 30+ days after submission

---

## 📅 Timeline Recommendation

**Days 1-3**: Mainnet deployment & testing
**Days 4-6**: Demo video recording & documentation
**Days 7-9**: GitHub cleanup & final testing
**Days 10-11**: Submission form + review
**Day 12**: SUBMIT (deadline)

---

## ✉️ Support

**Superteam Discord**: [Join here](https://discord.gg/superteam)
**Eitherway Support**: [Telegram](https://t.me/+N2TyLqdF4lk3MDk0)
**QuickNode Docs**: [docs.quicknode.com](https://docs.quicknode.com)
**Kamino Docs**: [kamino.finance/docs](https://kamino.finance/docs)

---

## 🏆 Remember

> **Build something that still exists 30 days after submission.**

Your submission will be judged on:
1. Does it solve a real problem?
2. Is it production-ready?
3. Does it deeply integrate partners?
4. Will real users adopt it?

**PayStream hits all four.** Now ship it. 🚀
