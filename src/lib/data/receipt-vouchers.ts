import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ReceiptVoucher } from "@/lib/types";

const COLUMNS =
  "id, doc_no, doc_date, receipt_id, receipt_no, contact_name, contact_tax_id, contact_address, note, recorded_by, created_at, profiles(full_name), receipt_voucher_items(description, amount, sort_order)";

type Row = {
  id: string;
  doc_no: string;
  doc_date: string;
  receipt_id: string | null;
  receipt_no: string | null;
  contact_name: string;
  contact_tax_id: string | null;
  contact_address: string | null;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
  receipt_voucher_items: { description: string; amount: number | string; sort_order: number }[] | null;
};

function mapRow(row: Row): ReceiptVoucher {
  const items = [...(row.receipt_voucher_items ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((it) => ({ description: it.description, amount: Number(it.amount) }));
  return {
    id: row.id,
    docNo: row.doc_no,
    docDate: row.doc_date,
    receiptId: row.receipt_id,
    receiptNo: row.receipt_no,
    contactName: row.contact_name,
    contactTaxId: row.contact_tax_id,
    contactAddress: row.contact_address,
    note: row.note,
    recordedById: row.recorded_by,
    recordedByName: row.profiles?.full_name ?? "",
    createdAt: row.created_at,
    items,
    amount: Math.round(items.reduce((sum, it) => sum + it.amount, 0) * 100) / 100,
  };
}

export async function getReceiptVouchers(): Promise<ReceiptVoucher[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receipt_vouchers")
    .select(COLUMNS)
    .order("doc_date", { ascending: false })
    .order("doc_no", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

export async function getReceiptVoucherById(id: string): Promise<ReceiptVoucher | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("receipt_vouchers").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as unknown as Row) : null;
}
