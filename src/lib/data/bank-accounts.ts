import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { normalizeBankName } from "@/lib/bank-name";
import type { BankAccount, BankTransaction } from "@/lib/types";

type ReceivedPayment = {
  id: string;
  amount: number;
  receivedDate: string;
  docNo: string;
  description: string;
};

// The single source of truth for "was this installment actually received,
// and when" — receipt_no/received_date get set here identically whether a
// formal ใบเสร็จรับเงิน was issued (billing-documents/actions.ts syncs both
// fields onto this exact row) or someone just typed the receipt number and
// amount straight into WALLPOD Project Sales. Reading from payments instead
// of billing_notes is what makes both paths count — per the user's explicit
// ask, this account's balance shouldn't care which one was used. amount
// (not amount + wht_amount) is the actual cash that reached the bank; the
// WHT portion is settled via a certificate, never a bank movement.
async function getReceivedPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ReceivedPayment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, received_date, receipt_no, projects(job_no, project_name, is_cancelled, customers(name))")
    .not("receipt_no", "is", null)
    .not("received_date", "is", null);
  if (error) throw error;

  return (data ?? [])
    .filter((row) => {
      // @ts-expect-error -- Supabase types the joined relation loosely here
      return row.projects && !row.projects.is_cancelled;
    })
    .map((row) => {
      // @ts-expect-error -- Supabase types the joined relation loosely here
      const project = row.projects as { job_no: string | null; project_name: string; customers: { name: string } | null };
      return {
        id: row.id,
        amount: Number(row.amount),
        receivedDate: row.received_date as string,
        docNo: row.receipt_no as string,
        description: project.customers?.name || project.project_name,
      };
    });
}

async function getVoucherOutflowByBankName(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("payment_vouchers")
    .select("bank_name, amount, wht_amount")
    .eq("payment_method", "โอนเงิน");
  if (error) throw error;

  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    const key = normalizeBankName(row.bank_name);
    if (!key) continue;
    // The WHT portion is remitted to the tax authority, not paid out via
    // this bank transfer — same net-paid convention as the voucher's own
    // print view (netPaid = amount - whtAmount).
    const netPaid = Number(row.amount) - Number(row.wht_amount);
    totals.set(key, (totals.get(key) ?? 0) + netPaid);
  }
  return totals;
}

function cutoffDate(createdAt: string): string {
  return createdAt.slice(0, 10);
}

// Itemized version of the inflow/outflow totals above, for the account
// page's transaction list. Only one bank account exists in this company
// today, so every qualifying inflow (received on/after that account's own
// created_at — its opening_balance already covers everything before that)
// is attributed to it directly; a second real account would need its own
// way to tell which account each direct-entry receipt actually landed in,
// since payments carries no bank_name of its own the way payment_vouchers
// does. Outflow still matches by payment_vouchers.bank_name unchanged.
export async function getBankTransactions(accounts: BankAccount[]): Promise<BankTransaction[]> {
  if (!isSupabaseConfigured() || accounts.length === 0) return [];
  const supabase = await createClient();

  const [receivedPayments, { data: vouchers, error: voucherErr }] = await Promise.all([
    getReceivedPayments(supabase),
    supabase
      .from("payment_vouchers")
      .select("id, doc_no, voucher_date, bank_name, payee_name, amount, wht_amount")
      .eq("payment_method", "โอนเงิน"),
  ]);
  if (voucherErr) throw voucherErr;

  const inflows: BankTransaction[] = accounts.flatMap((account) => {
    const cutoff = cutoffDate(account.createdAt);
    return receivedPayments
      .filter((p) => p.receivedDate >= cutoff)
      .map((p) => ({
        id: `${account.id}-${p.id}`,
        bankName: account.bankName,
        type: "in" as const,
        date: p.receivedDate,
        docNo: p.docNo,
        description: p.description,
        amount: p.amount,
      }));
  });

  const outflows: BankTransaction[] = (vouchers ?? [])
    .filter((row) => (row.bank_name ?? "").trim())
    .map((row) => ({
      id: row.id,
      bankName: (row.bank_name ?? "").trim(),
      type: "out" as const,
      date: row.voucher_date,
      docNo: row.doc_no,
      description: row.payee_name,
      // Same net-paid convention as getVoucherOutflowByBankName: the WHT
      // portion never leaves via this bank transfer.
      amount: Number(row.amount) - Number(row.wht_amount),
    }));

  return [...inflows, ...outflows].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const [{ data: accountRows, error: accountErr }, receivedPayments, outflowByBank] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select(
        "id, bank_name, account_no, account_type, account_name, opening_balance, actual_balance, actual_balance_updated_at, active, created_at",
      )
      .order("bank_name", { ascending: true }),
    getReceivedPayments(supabase),
    getVoucherOutflowByBankName(supabase),
  ]);
  if (accountErr) throw accountErr;

  return (accountRows ?? []).map((row) => {
    const cutoff = cutoffDate(row.created_at);
    const inflow = receivedPayments
      .filter((p) => p.receivedDate >= cutoff)
      .reduce((sum, p) => sum + p.amount, 0);
    const outflow = outflowByBank.get(normalizeBankName(row.bank_name)) ?? 0;
    return {
      id: row.id,
      bankName: row.bank_name,
      accountNo: row.account_no,
      accountType: row.account_type,
      accountName: row.account_name,
      openingBalance: Number(row.opening_balance),
      actualBalance: Number(row.actual_balance),
      actualBalanceUpdatedAt: row.actual_balance_updated_at,
      systemBalance: Math.round((Number(row.opening_balance) + inflow - outflow) * 100) / 100,
      active: row.active,
      createdAt: row.created_at,
    };
  });
}
