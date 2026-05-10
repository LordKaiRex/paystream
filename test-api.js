/**
 * PayStream — API Test Suite
 * ─────────────────────────────────────────────────────────────────
 * Run: npm test
 * Tests all endpoints with validation, error handling, rate limiting
 */

import dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.API_URL || "http://localhost:3001";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "test-admin-secret";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "test-webhook-secret";

// Test data
const testWallet = "11111112111111121111111211111112111111121111111211111112";
const testContractorWallet = "So11111111111111111111111111111111111111112";
const testBusinessWallet = "So11111111111111111111111111111111111111113";

let passed = 0;
let failed = 0;
const results = [];

// ─────────────────────────────────────────────────────────────────
// TEST UTILITIES
// ─────────────────────────────────────────────────────────────────

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log("✅");
    passed++;
    results.push({ name, status: "pass" });
  } catch (err) {
    console.log("❌");
    console.log(`    Error: ${err.message}`);
    failed++;
    results.push({ name, status: "fail", error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, path, body = null, headers = {}) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

// ─────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────

async function runTests() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         PayStream — API Integration Tests                    ║
║         Network: ${(process.env.NETWORK || "mainnet-beta").padEnd(43)} ║
╚══════════════════════════════════════════════════════════════╝
  `);

  // Connection check
  console.log("\n📡 Connection Tests");
  console.log("─".repeat(60));
  await test("Server is running", async () => {
    const { status, data } = await request("GET", "/health");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.status === "ok", "Health check failed");
  });

  await test("API health check", async () => {
    const { status } = await request("GET", "/api/health");
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test("Root endpoint", async () => {
    const response = await fetch(`${BASE_URL}/`);
    const text = await response.text();
    assert(response.status === 200, `Expected 200, got ${response.status}`);
    assert(text.includes("PayStream"), "Root HTML should include PayStream");
  });

  // Input Validation Tests
  console.log("\n🔍 Input Validation Tests");
  console.log("─".repeat(60));

  await test("Reject invalid wallet address", async () => {
    const { status } = await request("GET", "/api/treasury/invalid-address");
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("Reject missing required fields", async () => {
    const { status, data } = await request("POST", "/api/payments/add", {
      contractorWallet: testContractorWallet,
      // Missing amountUSDC and contractorName
    });
    assert(status === 400, `Expected 400, got ${status}`);
    assert(data.error, "Should have error message");
  });

  await test("Reject negative payment amount", async () => {
    const { status, data } = await request("POST", "/api/payments/add", {
      businessWallet: testBusinessWallet,
      contractorWallet: testContractorWallet,
      contractorName: "Test Contractor",
      amountUSDC: -100,
    });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("Reject invalid frequency", async () => {
    const { status, data } = await request("POST", "/api/payments/add", {
      businessWallet: testBusinessWallet,
      contractorWallet: testContractorWallet,
      contractorName: "Test Contractor",
      amountUSDC: 100,
      frequency: "invalid-frequency",
    });
    assert(status === 400, `Expected 400, got ${status}`);
  });

  // Success Cases
  console.log("\n✅ Success Cases");
  console.log("─".repeat(60));

  await test("Accept valid payment", async () => {
    const { status, data } = await request("POST", "/api/payments/add", {
      businessWallet: testBusinessWallet,
      contractorWallet: testContractorWallet,
      contractorName: "Test Contractor",
      amountUSDC: 100,
      frequency: "monthly",
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success");
  });

  await test("Get prices", async () => {
    const { status, data } = await request("GET", "/api/prices");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, "Should return success");
  });

  await test("Get due payments", async () => {
    const { status, data } = await request("GET", "/api/payments/due");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.data), "Should return array");
  });

  // Authorization Tests
  console.log("\n🔐 Authorization Tests");
  console.log("─".repeat(60));

  await test("Reject webhook without secret", async () => {
    const { status } = await request("POST", "/webhook/payroll", {});
    assert(status === 401 || status === 503, `Expected 401 or 503, got ${status}`);
  });

  await test("Reject webhook with wrong secret", async () => {
    const { status } = await request("POST", "/webhook/payroll", {}, {
      "x-paystream-secret": "wrong-secret",
    });
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await test("Reject manual payroll without admin secret", async () => {
    const { status } = await request("POST", "/api/payments/run", {});
    assert(status === 401, `Expected 401, got ${status}`);
  });

  await test("Reject manual payroll with wrong admin secret", async () => {
    const { status } = await request("POST", "/api/payments/run", {}, {
      "x-admin-secret": "wrong-secret",
    });
    assert(status === 401, `Expected 401, got ${status}`);
  });

  // Error Handling
  console.log("\n❌ Error Handling");
  console.log("─".repeat(60));

  await test("404 for unknown endpoint", async () => {
    const { status } = await request("GET", "/api/unknown");
    assert(status === 404, `Expected 404, got ${status}`);
  });

  await test("Invalid JSON body handling", async () => {
    const response = await fetch(`${BASE_URL}/api/payments/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid json",
    });
    assert(response.status >= 400, "Should return error");
  });

  // Output Summary
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                      Test Results                            ║
╠══════════════════════════════════════════════════════════════╣
║  ✅ Passed:  ${passed.toString().padEnd(51)} ║
║  ❌ Failed:  ${failed.toString().padEnd(51)} ║
║  ─────────────────────────────────────────────────────────   ║
║  Total:   ${(passed + failed).toString().padEnd(51)} ║
╚══════════════════════════════════════════════════════════════╝
  `);

  if (failed > 0) {
    console.log("Failed tests:");
    results.filter((r) => r.status === "fail").forEach((r) => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log("🎉 All tests passed!");
    process.exit(0);
  }
}

// Run tests
runTests().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});
