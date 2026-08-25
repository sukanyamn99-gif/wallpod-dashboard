import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PettyCashTransaction, PettyCashTransactionType } from "@/lib/types";

const COLUMNS =
  "id, doc_no, transaction_date, transaction_type, amount, description, balance_after, recorded_by, created_at, profiles(full_name)";

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
