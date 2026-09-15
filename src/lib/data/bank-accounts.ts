import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
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
//
// receipt_no alone isn't proof the money actually landed — a receipt can be
// issued ahead of payment (the one customer, ร้อกเวิธ, who requires an
// advance receipt before their own payment cycle actually pays it), so
// status is what genuinely flips once the money lands. Same
// isAwaitingPayment rule already used by project-sale-form.tsx's own
// paidAmount, applied here so a job stuck at รอชำระเงิน never counts as a
// bank inflow just because it already has a receipt number on file.
async function getReceivedPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ReceivedPayment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, amount, received_date, receipt_no, status, projects(job_no, project_name, is_cancelled, customers(name))",
    )
    .not("receipt_no", "is", null)
    .not("received_date", "is", null)
    .neq("status", "รอชำระเงิน");
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

type VoucherOutflow = {
  id: string;
  amount: number;
  date: string;
  docNo: string;
  description: string;
};

// bank_name/bank_account_no on a voucher are the PAYEE's destination
// details (confirmed with the user — they can be any bank at all, whatever
// the payee happens to use) — not which of the company's own accounts paid
// out. Every โอนเงิน voucher leaves from this company's one real bank
// account regardless, so none of them are matched or filtered by bank_name;
// only the payment_method itself decides whether a voucher is a bank
// movement at all.
async function getVoucherOutflows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<VoucherOutflow[]> {
  const { data, error } = await supabase
    .from("payment_vouchers")
    .select("id, doc_no, voucher_date, bank_transfer_date, payee_name, amount, wht_amount")
    .eq("payment_method", "โอนเงิน")
    // A voucher can be written up before the money actually moves (e.g.
    // prepared ahead of payday) — bank_transfer_date is when it really
    // left. Without a transfer date yet, no money has left the account,
    // so it must not count as an outflow at all — previously this fell
    // back to voucher_date, which deducted the balance for a transfer
    // that hadn't happened yet.
    .not("bank_transfer_date", "is", null);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    // The WHT portion is remitted to the tax authority, not paid out via
    // this bank transfer — same net-paid convention as the voucher's own
    // print view (netPaid = amount - whtAmount).
    amount: Number(row.amount) - Number(row.wht_amount),
    date: row.bank_transfer_date as string,
    docNo: row.doc_no,
    description: row.payee_name,
  }));
}

function cutoffDate(createdAt: string): string {
  return createdAt.slice(0, 10);
}

// Itemized version of the inflow/outflow totals above, for the account
// page's transaction list. Only one bank account exists in this company
// today, so every qualifying inflow/outflow (dated on/after that account's
// own created_at — its opening_balance already covers everything before
// that) is attributed to it directly; a second real account would need its
// own way to tell which account each transaction actually moved through,
// since neither payments nor payment_vouchers records that.
export async function getBankTransactions(accounts: BankAccount[]): Promise<BankTransaction[]> {
  if (!isSupabaseConfigured() || accounts.length === 0) return [];
  const supabase = await createClient();

  const [receivedPayments, voucherOutflows] = await Promise.all([
    getReceivedPayments(supabase),
    getVoucherOutflows(supabase),
  ]);

  const inflows: BankTransaction[] = accounts.flatMap((account) => {
    const cutoff = cutoffDate(account.createdAt);
    return receivedPayments
      .filter((p) => p.receivedDate >= cutoff)
      .map((p) => ({
        id: `${account.id}-in-${p.id}`,
        bankName: account.bankName,
        type: "in" as const,
        date: p.receivedDate,
        docNo: p.docNo,
        description: p.description,
        amount: p.amount,
      }));
  });

  const outflows: BankTransaction[] = accounts.flatMap((account) => {
    const cutoff = cutoffDate(account.createdAt);
    return voucherOutflows
      .filter((v) => v.date >= cutoff)
      .map((v) => ({
        id: `${account.id}-out-${v.id}`,
        bankName: account.bankName,
        type: "out" as const,
        date: v.date,
        docNo: v.docNo,
        description: v.description,
        amount: v.amount,
      }));
  });

  return [...inflows, ...outflows].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const [{ data: accountRows, error: accountErr }, receivedPayments, voucherOutflows] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select(
        "id, bank_name, account_no, account_type, account_name, opening_balance, actual_balance, actual_balance_updated_at, active, created_at",
      )
      .order("bank_name", { ascending: true }),
    getReceivedPayments(supabase),
    getVoucherOutflows(supabase),
  ]);
  if (accountErr) throw accountErr;

  return (accountRows ?? []).map((row) => {
    const cutoff = cutoffDate(row.created_at);
    const inflow = receivedPayments
      .filter((p) => p.receivedDate >= cutoff)
      .reduce((sum, p) => sum + p.amount, 0);
    const outflow = voucherOutflows
      .filter((v) => v.date >= cutoff)
      .reduce((sum, v) => sum + v.amount, 0);
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
