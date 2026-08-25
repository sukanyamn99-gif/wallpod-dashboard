import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PaymentVoucher } from "@/lib/types";

const COLUMNS =
  "id, doc_no, voucher_date, payee_name, category, amount, payment_method, reference_no, note, recorded_by, created_at, profiles(full_name)";

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
  profiles: { full_name: string } | null;
};

function mapRow(row: Row): PaymentVoucher {
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
  };
}

export async function getPaymentVouchers(): Promise<PaymentVoucher[]> {
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
  const { data, error } = await supabase.from("payment_vouchers").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  // @ts-expect-error -- Supabase types the joined relation loosely here
  return data ? mapRow(data) : null;
}
