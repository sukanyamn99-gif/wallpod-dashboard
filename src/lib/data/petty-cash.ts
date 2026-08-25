import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PettyCashTransaction, PettyCashTransactionType } from "@/lib/types";

const COLUMNS =
  "id, doc_no, transaction_date, transaction_type, amount, description, balance_after, recorded_by, created_at, category, biller_name, job_no, vat_amount, wht_amount, profiles(full_name)";

type Row = {
  id: string;
  doc_no: string;
  transaction_date: string;
  transaction_type: string;
  amount: number | string;
  description: string;
  balance_after: number | string;
  recorded_by: string | null;
  created_at: string;
  category: string | null;
  biller_name: string | null;
  job_no: string | null;
  vat_amount: number | string;
  wht_amount: number | string;
  profiles: { full_name: string } | null;
};

function mapRow(row: Row): PettyCashTransaction {
  return {
    id: row.id,
    docNo: row.doc_no,
    transactionDate: row.transaction_date,
    transactionType: row.transaction_type as PettyCashTransactionType,
    amount: Number(row.amount),
    description: row.description,
    balanceAfter: Number(row.balance_after),
    recordedById: row.recorded_by,
    recordedByName: row.profiles?.full_name ?? "",
    createdAt: row.created_at,
    category: row.category,
    billerName: row.biller_name,
    jobNo: row.job_no,
    vatAmount: Number(row.vat_amount),
    whtAmount: Number(row.wht_amount),
  };
}

// Ordered newest-first for display; the current balance is simply the
// first row here (or 0 if the ledger is empty) since balance_after already
// reflects the running total as of that transaction.
export async function getPettyCashTransactions(): Promise<PettyCashTransaction[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("petty_cash_transactions")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // @ts-expect-error -- Supabase types the joined relation loosely here
  return (data ?? []).map(mapRow);
}

// Distinct รายการ text actually typed before, most-recent-first, split by
// เติมเงิน/ใช้จ่าย since the two mean very different things — feeds the
// quick-select chips on the entry form alongside the fixed suggestions.
export async function getRecentPettyCashDescriptions(
  limit = 8,
): Promise<Record<PettyCashTransactionType, string[]>> {
  const byType: Record<PettyCashTransactionType, string[]> = { topup: [], expense: [] };
  if (!isSupabaseConfigured()) return byType;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("petty_cash_transactions")
    .select("transaction_type, description")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const seen: Record<PettyCashTransactionType, Set<string>> = { topup: new Set(), expense: new Set() };
  for (const row of data ?? []) {
    const type = row.transaction_type as PettyCashTransactionType;
    const desc = row.description?.trim();
    if (!desc || !byType[type] || seen[type].has(desc) || byType[type].length >= limit) continue;
    seen[type].add(desc);
    byType[type].push(desc);
  }
  return byType;
}

// Distinct ผู้เบิก names actually used before, most-recent-first — same
// quick-select idea as getRecentPettyCashDescriptions, but ผู้เบิก only
// applies to ใช้จ่าย rows (เติมเงิน has no biller), so no per-type split needed.
export async function getRecentPettyCashBillers(limit = 8): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("petty_cash_transactions")
    .select("biller_name")
    .eq("transaction_type", "expense")
    .not("biller_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const seen = new Set<string>();
  const billers: string[] = [];
  for (const row of data ?? []) {
    const name = row.biller_name?.trim();
    if (!name || seen.has(name) || billers.length >= limit) continue;
    seen.add(name);
    billers.push(name);
  }
  return billers;
}
