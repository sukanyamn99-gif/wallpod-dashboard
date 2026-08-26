import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PaymentVoucher, PaymentVoucherLedgerLine, WhtFormType } from "@/lib/types";

const COLUMNS =
  "id, doc_no, voucher_date, payee_name, category, amount, payment_method, reference_no, note, recorded_by, created_at, wht_cert_no, description, wht_rate, wht_form_type, wht_amount, bank_name, bank_account_no, bank_transfer_date, job_no, profiles(full_name)";

type Row = {
  id: string;
  doc_no: string;
  voucher_date: string;
  payee_name: string;
  category: string | null;
  amount: number | string;
  payment_method: string | null;
  reference_no: string | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  wht_cert_no: string | null;
  description: string | null;
  wht_rate: number | string | null;
  wht_form_type: string | null;
  wht_amount: number | string;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_transfer_date: string | null;
  job_no: string | null;
  profiles: { full_name: string } | null;
};

function mapRow(row: Row): Omit<PaymentVoucher, "ledgerLines"> {
  return {
    id: row.id,
    docNo: row.doc_no,
    voucherDate: row.voucher_date,
    payeeName: row.payee_name,
    category: row.category,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    referenceNo: row.reference_no,
    note: row.note,
    recordedById: row.recorded_by,
    recordedByName: row.profiles?.full_name ?? "",
    createdAt: row.created_at,
    whtCertNo: row.wht_cert_no,
    description: row.description,
    whtRate: row.wht_rate === null ? null : Number(row.wht_rate),
    whtFormType: row.wht_form_type as WhtFormType | null,
    whtAmount: Number(row.wht_amount),
    bankName: row.bank_name,
    bankAccountNo: row.bank_account_no,
    bankTransferDate: row.bank_transfer_date,
    jobNo: row.job_no,
  };
}

export async function getPaymentVouchers(): Promise<Omit<PaymentVoucher, "ledgerLines">[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_vouchers")
    .select(COLUMNS)
    .order("voucher_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  // @ts-expect-error -- Supabase types the joined relation loosely here
  return (data ?? []).map(mapRow);
}

export async function getPaymentVoucherById(id: string): Promise<PaymentVoucher | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const [{ data, error }, { data: lines, error: linesErr }] = await Promise.all([
    supabase.from("payment_vouchers").select(COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("payment_voucher_ledger_lines")
      .select("id, account_code, description, debit, credit")
      .eq("voucher_id", id)
      .order("sort_order", { ascending: true }),
  ]);
  if (error) throw error;
  if (!data) return null;
  if (linesErr) throw linesErr;

  const ledgerLines: PaymentVoucherLedgerLine[] = (lines ?? []).map((row) => ({
    id: row.id,
    accountCode: row.account_code,
    description: row.description,
    debit: Number(row.debit),
    credit: Number(row.credit),
  }));

  // @ts-expect-error -- Supabase types the joined relation loosely here
  return { ...mapRow(data), ledgerLines };
}
