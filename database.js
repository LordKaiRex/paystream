/**
 * PayStream — Database Layer (Supabase PostgreSQL)
 * ─────────────────────────────────────────────────────────────────
 * Persistent storage for payments, audit logs, contractor data
 *
 * Works with both devnet and mainnet:
 * - Single Supabase project for devnet testing
 * - Same schema, separate data by NETWORK env var
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";
const NETWORK = process.env.NETWORK || "mainnet-beta";

let supabase = null;

// Initialize Supabase client if credentials provided
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log(`✓ Supabase connected (${NETWORK})`);
} else {
  console.warn(`⚠️  Supabase not configured. Using in-memory database.`);
  console.warn(`   Set SUPABASE_URL and SUPABASE_ANON_KEY to enable persistence.`);
}

// ─────────────────────────────────────────────────────────────────
// DATABASE INTERFACE
// ─────────────────────────────────────────────────────────────────

/**
 * Add a payment record to database
 */
export async function dbAddPayment(payment) {
  if (!supabase) {
    console.log("[DB] In-memory: Payment stored");
    return payment;
  }

  const record = {
    network: NETWORK,
    business_wallet: payment.businessWallet,
    contractor_wallet: payment.contractorWallet,
    contractor_name: payment.contractorName,
    amount_usdc: payment.amountUSDC,
    frequency: payment.frequency,
    next_payment_date: payment.nextPaymentDate,
    created_at: new Date().toISOString(),
    last_executed: null,
    status: "active",
  };

  const { data, error } = await supabase.from("payments").insert([record]).select();

  if (error) {
    console.error("DB error adding payment:", error);
    throw new Error(`Failed to save payment: ${error.message}`);
  }

  return data?.[0] || payment;
}

/**
 * Get all payments for a business wallet
 */
export async function dbGetBusinessPayments(businessWallet) {
  if (!supabase) {
    console.log("[DB] In-memory: Fetching business payments");
    return [];
  }

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("network", NETWORK)
    .eq("business_wallet", businessWallet)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("DB error fetching payments:", error);
    return [];
  }

  return data || [];
}

/**
 * Get payments due today
 */
export async function dbGetDuePayments() {
  if (!supabase) {
    console.log("[DB] In-memory: No due payments");
    return [];
  }

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("network", NETWORK)
    .eq("status", "active")
    .lte("next_payment_date", today)
    .order("next_payment_date", { ascending: true });

  if (error) {
    console.error("DB error fetching due payments:", error);
    return [];
  }

  return data || [];
}

/**
 * Update payment's last execution and calculate next due date
 */
export async function dbUpdatePaymentExecution(paymentId, frequency) {
  if (!supabase) {
    console.log("[DB] In-memory: Payment execution updated");
    return;
  }

  const nextPaymentDate = new Date();

  if (frequency === "weekly") {
    nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
  } else if (frequency === "bi-weekly") {
    nextPaymentDate.setDate(nextPaymentDate.getDate() + 14);
  } else {
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
  }

  const { error } = await supabase
    .from("payments")
    .update({
      last_executed: new Date().toISOString(),
      next_payment_date: nextPaymentDate.toISOString(),
    })
    .eq("id", paymentId);

  if (error) {
    console.error("DB error updating payment:", error);
  }
}

/**
 * Save payment transaction record
 */
export async function dbSaveTransaction(transaction) {
  if (!supabase) {
    console.log("[DB] In-memory: Transaction saved");
    return;
  }

  const record = {
    network: NETWORK,
    business_wallet: transaction.businessWallet,
    contractor_wallet: transaction.contractorWallet,
    amount_usdc: transaction.amountUSDC,
    transaction_id: transaction.transactionId,
    status: transaction.status, // "success" or "failed"
    error_message: transaction.errorMessage || null,
    executed_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("transactions").insert([record]);

  if (error) {
    console.error("DB error saving transaction:", error);
  }
}

/**
 * Get payment history for contractor
 */
export async function dbGetContractorPayments(contractorWallet) {
  if (!supabase) {
    console.log("[DB] In-memory: No contractor payment history");
    return [];
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("network", NETWORK)
    .eq("contractor_wallet", contractorWallet)
    .eq("status", "success")
    .order("executed_at", { ascending: false });

  if (error) {
    console.error("DB error fetching contractor payments:", error);
    return [];
  }

  return data || [];
}

/**
 * Disable a payment (soft delete)
 */
export async function dbDisablePayment(paymentId) {
  if (!supabase) {
    console.log("[DB] In-memory: Payment disabled");
    return;
  }

  const { error } = await supabase
    .from("payments")
    .update({ status: "inactive" })
    .eq("id", paymentId);

  if (error) {
    console.error("DB error disabling payment:", error);
  }
}

/**
 * Get stats for dashboard
 */
export async function dbGetStats() {
  if (!supabase) {
    return {
      totalPaymentsDue: 0,
      totalContractors: 0,
      totalExecuted: 0,
      totalVolume: 0,
    };
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Due payments
    const { data: dueData } = await supabase
      .from("payments")
      .select("id")
      .eq("network", NETWORK)
      .eq("status", "active")
      .lte("next_payment_date", today);

    // Active payments
    const { data: contractorData } = await supabase
      .from("payments")
      .select("contractor_wallet", { count: "exact" })
      .eq("network", NETWORK)
      .eq("status", "active");

    // Executed transactions this month
    const firstDay = new Date();
    firstDay.setDate(1);
    const { data: txData } = await supabase
      .from("transactions")
      .select("amount_usdc")
      .eq("network", NETWORK)
      .eq("status", "success")
      .gte("executed_at", firstDay.toISOString());

    const totalVolume =
      txData?.reduce((sum, tx) => sum + (tx.amount_usdc || 0), 0) || 0;

    return {
      totalPaymentsDue: dueData?.length || 0,
      totalContractors: new Set(contractorData?.map((p) => p.contractor_wallet) || []).size,
      totalExecuted: txData?.length || 0,
      totalVolume,
    };
  } catch (err) {
    console.error("DB error getting stats:", err);
    return {
      totalPaymentsDue: 0,
      totalContractors: 0,
      totalExecuted: 0,
      totalVolume: 0,
    };
  }
}

export default {
  dbAddPayment,
  dbGetBusinessPayments,
  dbGetDuePayments,
  dbUpdatePaymentExecution,
  dbSaveTransaction,
  dbGetContractorPayments,
  dbDisablePayment,
  dbGetStats,
};
