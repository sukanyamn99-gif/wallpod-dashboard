import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { computeBillingDocumentSummary } from "@/lib/billing-document-summary";
import { normalizeBankName } from "@/lib/bank-name";
import type { BankAccount, BankTransaction } from "@/lib/types";

// ยอดในระบบ (system/book balance) is an approximation, not a real ledger —
// it only counts transactions this app already knows are โอนเงิน (bank
// transfer) and whose own bank_name text matches this account (trimmed,
// case-insensitive; payment vouchers also match bank_account_no when the
// voucher has one). "เงินสด"/"เช็ค"/"บัตรเครดิต" entries never touch a bank
// balance in this calculation. This is the same class of trade-off already
// accepted for quotation↔customer name matching elsewhere in this app —
// good enough at this company's real scale (one bank account today), not a
// bank-verified reconciliation.
async function getReceiptInflowByBankName(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("billing_notes")
    .select(
      "bank_name, discount_amount, wht_percent, retention_percent, billing_note_items(amount, apply_wht)",
    )
    .eq("doc_type", "receipt")
    .eq("payment_method", "โอนเงิน");
  if (error) throw error;

  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    const key = normalizeBankName(row.bank_name);
    if (!key) continue;
    const items = (row.billing_note_items ?? []) as unknown as { amount: number; apply_wht: boolean }[];
    const summary = computeBillingDocumentSummary(
      items.map((it) => ({ amount: Number(it.amount), applyWht: it.apply_wht })),
      Number(row.discount_amount),
      Number(row.wht_percent),
      Number(row.retention_percent),
    );
    totals.set(key, (totals.get(key) ?? 0) + summary.netPayable);
  }
  return totals;
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

// Itemized version of getReceiptInflowByBankName/getVoucherOutflowByBankName
// above — same rows, same netPayable/netPaid math, just kept as individual
// lines instead of summed per bank, for the account page's transaction
// list. bankName is left raw (trimmed, not lowercased) so the UI can show
// it and still match it against an account via normalizeBankName itself.
export async function getBankTransactions(): Promise<BankTransaction[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const [{ data: receipts, error: receiptErr }, { data: vouchers, error: voucherErr }] = await Promise.all([
    supabase
      .from("billing_notes")
      .select(
        "id, doc_no, doc_date, bank_name, discount_amount, wht_percent, retention_percent, billing_note_items(amount, apply_wht), customers(name)",
      )
      .eq("doc_type", "receipt")
      .eq("payment_method", "โอนเงิน"),
    supabase
      .from("payment_vouchers")
      .select("id, doc_no, voucher_date, bank_name, payee_name, amount, wht_amount")
      .eq("payment_method", "โอนเงิน"),
  ]);
  if (receiptErr) throw receiptErr;
  if (voucherErr) throw voucherErr;

  const inflows: BankTransaction[] = (receipts ?? [])
    .filter((row) => (row.bank_name ?? "").trim())
    .map((row) => {
      const items = (row.billing_note_items ?? []) as unknown as { amount: number; apply_wht: boolean }[];
      const summary = computeBillingDocumentSummary(
        items.map((it) => ({ amount: Number(it.amount), applyWht: it.apply_wht })),
        Number(row.discount_amount),
        Number(row.wht_percent),
        Number(row.retention_percent),
      );
      // @ts-expect-error -- Supabase types the joined relation loosely here
      const customerName: string = row.customers?.name ?? "";
      return {
        id: row.id,
        bankName: (row.bank_name ?? "").trim(),
        type: "in" as const,
        date: row.doc_date,
        docNo: row.doc_no,
        description: customerName || row.doc_no,
        amount: summary.netPayable,
      };
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

  const [{ data: accountRows, error: accountErr }, inflowByBank, outflowByBank] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select(
        "id, bank_name, account_no, account_type, account_name, opening_balance, actual_balance, actual_balance_updated_at, active, created_at",
      )
      .order("bank_name", { ascending: true }),
    getReceiptInflowByBankName(supabase),
    getVoucherOutflowByBankName(supabase),
  ]);
  if (accountErr) throw accountErr;

  return (accountRows ?? []).map((row) => {
    const key = normalizeBankName(row.bank_name);
    const inflow = inflowByBank.get(key) ?? 0;
    const outflow = outflowByBank.get(key) ?? 0;
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
