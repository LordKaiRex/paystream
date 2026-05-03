# PayStream Demo Video Script (2-3 minutes)

## Gear Needed
- Screen recorder (OBS, QuickTime, or browser extension)
- Terminal window
- Browser with Solana Explorer tab open
- Slides (optional): 1-2 title slides

---

## Timeline & Narration

### 0:00-0:15 — Intro Slide

**Slide Text:**
```
PAYSTREAM
Automated Payroll + Yield Optimization
Built for Solana with Kamino Finance & QuickNode
```

**Narration:**
"PayStream automates contractor payments while extracting yield from your treasury. 
It's built on Kamino, QuickNode, and Solana. Let's see it in action."

---

### 0:15-0:45 — Problem & Solution (Optional visual)

**Narration:**
"Today, DAOs manually pay contractors and their treasury sits idle earning nothing. 

With PayStream: Payments execute automatically when triggered, and your USDC keeps earning 
8-12% yield in Kamino vaults the entire time. You get faster payments AND passive yield."

---

### 0:45-1:15 — Live Demo Part 1: Trigger Payment

**What to show:**
1. Terminal window
2. Show the payment webhook endpoint
3. Execute a test payment API call

**Terminal commands:**
```bash
# Show the server running
$ npm run dev
# [server output showing devnet/mainnet]

# Trigger a payment
$ curl -X POST http://localhost:3001/api/payments/run \
  -H "Content-Type: application/json" \
  -d '{
    "payments": [
      {"to": "contractor1.sol", "amount": 10},
      {"to": "contractor2.sol", "amount": 10}
    ]
  }'

# Response: {"status": "pending", "txId": "xxxxx"}
```

**Narration:**
"I'm triggering a payment for two contractors from the API. Notice the transaction ID — 
we'll track this on-chain in a second. The payment is already executing."

---

### 1:15-1:45 — Live Demo Part 2: Show On-Chain Activity

**What to show:**
1. Open Solana Explorer tab
2. Paste transaction ID in search
3. Show transaction details

**Solana Explorer (explorer.solana.com):**
1. Search for transaction signature from previous step
2. Show transaction details:
   - **Instructions**: 
     - Kamino vault withdrawal (SPL token transfer OUT)
     - USDC transfer to contractor wallet (SPL token transfer OUT)
     - Memo instruction with payment reference
3. Expand "TokenTransfer" to show USDC amounts
4. Click contractor address → show USDC arrived

**Narration:**
"Here's the transaction on-chain. You can see: First, we withdrew USDC from the Kamino 
vault that earns yield. Then we transferred it to the contractors. The entire operation 
completed in one atomic transaction, which means it either all succeeds or all fails—no 
partial state."

---

### 1:45-2:15 — Architecture Breakdown

**What to show:**
1. Simple diagram (text or slide) showing:
   ```
   QuickNode Webhook
        ↓ (triggers)
   PayStream API
        ↓ (calls)
   Kamino: Withdraw USDC
        ↓ (transfers)
   Contractor Wallet
        ↓
   Birdeye: Prices fetched
   ```

**Narration:**
"Here's how it works: A QuickNode webhook listens for payment events and triggers the API. 
PayStream calls the Kamino vault to withdraw USDC, then transfers it to contractors. 
Birdeye provides real-time pricing so we know the exact value of what we're sending.

The whole flow is automated—no manual steps, no spreadsheets, no delays."

---

### 2:15-2:45 — Impact & Live Status

**What to show:**
1. Dashboard or metric output showing:
   - Total payments processed
   - Total USDC transferred
   - Yield earned (if available)
   - Server status: Ready

**Narration:**
"This demo processed $20 USDC to contractors. At scale, processing 10 payments per month 
would earn roughly $500-1000 per year in Kamino yield on the treasury.

PayStream is production-ready and currently live on devnet. We've tested all core 
functionality: RPC connectivity, vault operations, price feeds, transaction building, 
and error handling.

It's ready for mainnet deployment and real-world usage."

---

### 2:45-3:00 — Closing

**Narration:**
"PayStream demonstrates deep integration with Kamino for yield optimization and QuickNode 
for reliable data infrastructure. This is automated payroll that actually makes financial 
sense for DAOs and teams.

[Project name], built for the Frontier Hackathon."

**Slide:**
```
github.com/[your-repo]
[deployed-url]
```

---

## Recording Tips

✅ **Do:**
- Speak clearly at normal pace (1.5x playback speeds up auto-captions)
- Show real transactions (don't fake it)
- Include error states or edge cases if relevant
- Use good lighting so text is readable
- Minimize background distractions

❌ **Don't:**
- Mumble or speak too fast
- Include long waits or loading screens (edit them out)
- Show API keys or private keys on screen
- Record in a noisy environment

---

## Editing Checklist

- [ ] Video is 2-3 minutes (not too long)
- [ ] Audio is clear (test with headphones)
- [ ] Text is readable (font size 18+)
- [ ] Transitions are smooth (no abrupt cuts)
- [ ] Call to action at end (GitHub/URL visible)
- [ ] Export as MP4 (most platforms accept)

---

## File Upload

**Superteam Earn requires:**
- MP4 format, <100 MB
- YouTube link (optional: upload unlisted to YouTube first)
- Or direct file upload

---

## Example Output

```
paystream-demo.mp4
Duration: 2:47
File size: 45 MB
Resolution: 1920x1080
Format: H.264 codec
```

---

## Demo Alternatives (if live demo fails)

If devnet is down or something breaks:
- Use a pre-recorded test run
- Show Solana Explorer screenshots of completed transactions
- Use screen recording of terminal (slower but works)
- Reference devnet test results from `test-devnet.js`

---

**Ready to record? You've got this.** 🎬
