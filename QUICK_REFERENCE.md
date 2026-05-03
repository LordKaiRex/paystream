# PayStream — Quick Reference Card

## 🎯 Mission
Win Superteam Frontier Hackathon with deep Kamino + QuickNode integration.

## ⏰ Deadline
**May 12, 2026** (12 days from April 30)

## 📊 Current Status
- **Devnet**: ✅ 14/16 tests passing
- **Mainnet**: 🔄 Ready to deploy (need SOL)
- **GitHub**: 🔄 Need to make public
- **Demo**: 🔄 Need to record
- **Submission**: 🔄 Not yet submitted

---

## ⚡ Next 72 Hours

### If you have mainnet SOL:
1. Buy 1-2 SOL (any CEX or Phantom wallet)
2. Update `.env`: `NETWORK=mainnet-beta`
3. Deploy to Railway/Render
4. Test the live URL

### If you don't have SOL:
1. Create YouTube account (for demo video upload)
2. Polish GitHub repo (add .env.example, README)
3. Record demo on devnet (still valid proof)
4. Prepare all documentation

---

## 📝 Documentation Created

| File | Purpose | Use When |
|------|---------|----------|
| SUBMISSION.md | Judge-facing | During submission |
| MAINNET_DEPLOYMENT.md | Setup guide | Moving to mainnet |
| DEMO_SCRIPT.md | Video guide | Recording demo |
| SUBMISSION_CHECKLIST.md | Pre-check | Before deadline |
| HACKATHON_SPRINT.md | Timeline | Daily reference |

---

## 🚀 Deploy Commands

```bash
# Test locally
npm run dev

# Run integration tests
node test-devnet.js

# Deploy to Railway
railway init
railway up

# Test live URL
curl https://your-url.railway.app/health
```

---

## 🎬 Demo (2-3 min video)

**Show**:
1. Terminal: Trigger payment API call
2. Solana Explorer: Show transaction
3. Explain: Kamino withdrawal + transfer
4. Result: Contractor received USDC

**Upload**: YouTube (unlisted or public)

---

## 📋 Submission Form

**On superteam.fun/earn:**

1. **Title**: PayStream: Automated Payroll + Yield Optimization
2. **URL**: https://your-deployed-url
3. **GitHub**: https://github.com/your-username/paystream
4. **Video**: YouTube link
5. **Track**: Kamino + QuickNode
6. **Network**: Mainnet

---

## 💰 Budget

- Mainnet SOL: ~$100-200 (one-time)
- Hosting: Free tier (Railway/Render)
- Domain: Optional ($12/yr)

---

## 🔑 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/webhook/payroll` | POST | Trigger payment |
| `/api/payments/run` | POST | Manual payment (demo) |
| `/api/prices` | GET | Get token prices |

---

## ✅ Pre-Submission Checklist

**1 day before deadline:**
- [ ] Server live on mainnet
- [ ] Demo video recorded + uploaded
- [ ] GitHub public (no .env file)
- [ ] All docs complete
- [ ] Live URL works
- [ ] Test payment succeeded

---

## 🏆 Judging Criteria

Your advantages:
- ✅ **Real utility** (solves payroll + yield)
- ✅ **Deep integration** (Kamino ops, webhooks)
- ✅ **Production quality** (error handling, tests)
- ✅ **Adoption potential** (clear market fit)

---

## 🆘 If Something Breaks

**Server won't start?**
```bash
npm install
npm start
```

**RPC errors?**
- Check QuickNode endpoint is correct
- Verify API key in .env

**Kamino errors?**
- Check vault address for network
- Verify server wallet has SOL

**Birdeye errors?**
- Not critical (can remove for submission)
- Core payment execution works without it

---

## 📞 Get Help

- QuickNode: https://discord.gg/quicknode
- Kamino: https://discord.gg/kamino
- Superteam: https://discord.gg/superteam
- Eitherway: https://t.me/+N2TyLqdF4lk3MDk0

---

## 🎯 Win Strategy

1. **Days 1-3**: Get mainnet SOL + deploy
2. **Days 4-6**: Record killer demo video
3. **Days 7-8**: Polish GitHub + docs
4. **Days 9-11**: Final testing
5. **Day 12**: SUBMIT

**Secret sauce**: Your deep integration with Kamino + QuickNode beats surface-level competitors.

---

## 💡 Remember

> "Build something that still exists 30 days after submission."

Your submission will live on mainnet handling real transactions. Perfect for this criteria.

---

## 🚀 LFG!

You've got a production-ready product, deep integrations, and clear market fit.

**12 days. 3 tasks. 1 prize pool.**

Let's do this. 🔥
