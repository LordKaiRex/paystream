#!/bin/bash

# PayStream Quick Start Helper
# Checks prerequisites and guides through setup

echo "🚀 PayStream Setup Helper"
echo "========================="
echo ""

# Check Node.js
echo "📦 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✓ npm: $(npm --version)"

echo ""
echo "📚 Installation steps:"
echo ""

# Step 1: Install dependencies
echo "1️⃣  Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi
echo "✓ Dependencies installed"

echo ""

# Step 2: Environment setup
if [ ! -f .env ]; then
    echo "2️⃣  Setting up environment..."
    cp env.example .env
    echo "✓ Created .env file"
    echo "  → Edit .env with your API keys"
    echo "  → QUICKNODE_RPC_URL, BIRDEYE_API_KEY, etc."
else
    echo "2️⃣  .env already exists (skipping)"
fi

echo ""

# Step 3: Generate keypair
if grep -q "SERVER_KEYPAIR=\[\]" .env || ! grep -q "SERVER_KEYPAIR" .env; then
    echo "3️⃣  Generating server keypair..."
    echo "Run this to generate:"
    echo "  node -e \"import('./execute.js').then(m => m.generateServerKeypair())\""
    echo ""
    echo "Then update .env with the generated keypair"
else
    echo "3️⃣  SERVER_KEYPAIR already configured"
fi

echo ""
echo "4️⃣  Next steps:"
echo ""
echo "  a) Edit .env with your credentials:"
echo "     QUICKNODE_RPC_URL=your_quicknode_url"
echo "     BIRDEYE_API_KEY=your_birdeye_key"
echo "     SERVER_KEYPAIR=[generated_above]"
echo ""
echo "  b) Fund your server keypair with ~0.05 SOL"
echo ""
echo "  c) Start the backend:"
echo "     npm run dev"
echo ""
echo "  d) In another terminal, open index.html:"
echo "     npx http-server ."
echo ""
echo "  e) Open http://localhost:8080 in your browser"
echo ""
echo "✨ Setup complete! Happy hacking!"
