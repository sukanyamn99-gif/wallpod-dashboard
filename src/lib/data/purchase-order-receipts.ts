import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PurchaseOrderReceipt, PurchaseOrderReceiptItem } from "@/lib/types";

const HEADER_COLUMNS =
  "id, doc_no, order_id, receipt_date, received_by, note, created_at, purchase_orders(doc_no), profiles(full_name)";

type HeaderRow = {
  id: string;
  doc_no: string;
  order_id: string;
  receipt_date: string;
  received_by: string | null;
  note: string | null;
  created_at: string;
  purchase_orders: { doc_no: string } | null;
  profiles: { full_name: string } | null;
};

function mapHeader(row: HeaderRow): Omit<PurchaseOrderReceipt, "items"> {
  return {
    id: row.id,
    docNo: row.doc_no,
    orderId: row.order_id,
    orderDocNo: row.purchase_orders?.doc_no ?? "",
    receiptDate: row.receipt_date,
    receivedById: row.received_by,
    receivedByName: row.profiles?.full_name ?? "",
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function getPurchaseOrderReceipts(): Promise<Omit<PurchaseOrderReceipt, "items">[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_order_receipts")
    .select(HEADER_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // @ts-expect-error -- Supabase types the joined relation loosely here
  return (data ?? []).map(mapHeader);
}

export async function getPurchaseOrderReceiptById(id: string): Promise<PurchaseOrderReceipt | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: header, error: headerErr } = await supabase
    .from("purchase_order_receipts")
    .select(HEADER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (headerErr) throw headerErr;
  if (!header) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("purchase_order_receipt_items")
    .select("id, order_item_id, stock_product_id, product_name_snapshot, product_sku_snapshot, unit_snapshot, quantity, unit_cost")
    .eq("receipt_id", id);
  if (itemsErr) throw itemsErr;

  const mappedItems: PurchaseOrderReceiptItem[] = (items ?? []).map((row) => ({
    id: row.id,
    orderItemId: row.order_item_id,
    stockProductId: row.stock_product_id,
    productName: row.product_name_snapshot,
    productSku: row.product_sku_snapshot,
    unit: row.unit_snapshot,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
  }));

  return {
    // @ts-expect-error -- Supabase types the joined relation loosely here
    ...mapHeader(header),
    items: mappedItems,
  };
}
