import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { GoodsReceipt, GoodsReceiptItem, GoodsReceiptPaymentStatus } from "@/lib/types";

const HEADER_COLUMNS =
  "id, doc_no, supplier_id, received_by, reference_no, note, created_at, payment_status, paid_date, suppliers(name), profiles(full_name)";

type HeaderRow = {
  id: string;
  doc_no: string;
  supplier_id: string | null;
  received_by: string | null;
  reference_no: string | null;
  note: string | null;
  created_at: string;
  payment_status: GoodsReceiptPaymentStatus;
  paid_date: string | null;
  suppliers: { name: string } | null;
  profiles: { full_name: string } | null;
};

function mapHeader(row: HeaderRow): Omit<GoodsReceipt, "items"> {
  return {
    id: row.id,
    docNo: row.doc_no,
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name ?? null,
    receivedById: row.received_by,
    receivedByName: row.profiles?.full_name ?? "",
    referenceNo: row.reference_no,
    note: row.note,
    createdAt: row.created_at,
    paymentStatus: row.payment_status,
    paidDate: row.paid_date,
  };
}

export type GoodsReceiptListRow = Omit<GoodsReceipt, "items"> & { totalAmount: number };

export async function getGoodsReceipts(): Promise<GoodsReceiptListRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(`${HEADER_COLUMNS}, goods_receipt_items(quantity, unit_cost)`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    // @ts-expect-error -- Supabase types the joined relation loosely here
    ...mapHeader(row),
    totalAmount: ((row.goods_receipt_items ?? []) as { quantity: number; unit_cost: number }[]).reduce(
      (sum, it) => sum + Number(it.quantity) * Number(it.unit_cost),
      0,
    ),
  }));
}

// Minimal shape the เจ้าหนี้คงค้าง (payables) page needs — one row per
// receipt with its total value (sum of quantity × unit_cost across items),
// computed here rather than stored, so it can never drift from the items
// that actually make it up.
export interface GoodsReceiptForPayables {
  id: string;
  docNo: string;
  supplierId: string | null;
  supplierName: string | null;
  referenceNo: string | null;
  createdAt: string;
  paymentStatus: GoodsReceiptPaymentStatus;
  paidDate: string | null;
  totalAmount: number;
}

export async function getGoodsReceiptsForPayables(): Promise<GoodsReceiptForPayables[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(
      "id, doc_no, supplier_id, reference_no, created_at, payment_status, paid_date, suppliers(name), goods_receipt_items(quantity, unit_cost)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string;
    doc_no: string;
    supplier_id: string | null;
    reference_no: string | null;
    created_at: string;
    payment_status: GoodsReceiptPaymentStatus;
    paid_date: string | null;
    suppliers: { name: string } | null;
    goods_receipt_items: { quantity: number; unit_cost: number }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    docNo: row.doc_no,
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name ?? null,
    referenceNo: row.reference_no,
    createdAt: row.created_at,
    paymentStatus: row.payment_status,
    paidDate: row.paid_date,
    totalAmount: (row.goods_receipt_items ?? []).reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_cost), 0),
  }));
}

export async function getGoodsReceiptById(id: string): Promise<GoodsReceipt | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: header, error: headerErr } = await supabase
    .from("goods_receipts")
    .select(HEADER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (headerErr) throw headerErr;
  if (!header) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("goods_receipt_items")
    .select("id, stock_product_id, product_name_snapshot, product_sku_snapshot, unit_snapshot, quantity, unit_cost")
    .eq("receipt_id", id);
  if (itemsErr) throw itemsErr;

  const mappedItems: GoodsReceiptItem[] = (items ?? []).map((row) => ({
    id: row.id,
    stockProductId: row.stock_product_id,
    productName: row.product_name_snapshot,
    productSku: row.product_sku_snapshot,
    quantity: Number(row.quantity),
    unit: row.unit_snapshot,
    unitCost: Number(row.unit_cost),
  }));

  return {
    // @ts-expect-error -- Supabase types the joined relation loosely here
    ...mapHeader(header),
    items: mappedItems,
  };
}

// One row per product — its most recent receipt only, not a full
// transaction log. The user explicitly asked for "latest update per item,
// no need to keep a log": goods_receipts/goods_receipt_items themselves
// stay fully historical (weighted-average costing and deletion both
// depend on that), this just changes what the REPORT surfaces.
export interface ReceiptReportRow {
  id: string;
  docNo: string;
  supplierName: string | null;
  receivedByName: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  unit: string;
  unitCost: number;
  createdAt: string;
}

export async function getReceiptReportRows(): Promise<ReceiptReportRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipt_items")
    .select(
      "id, product_name_snapshot, product_sku_snapshot, quantity, unit_snapshot, unit_cost, goods_receipts(doc_no, created_at, suppliers(name), profiles(full_name))",
    );
  if (error) throw error;

  const rows: ReceiptReportRow[] = (data ?? []).map((row) => {
    const header = row.goods_receipts as unknown as {
      doc_no: string;
      created_at: string;
      suppliers: { name: string } | null;
      profiles: { full_name: string } | null;
    } | null;
    return {
      id: row.id,
      docNo: header?.doc_no ?? "",
      supplierName: header?.suppliers?.name ?? null,
      receivedByName: header?.profiles?.full_name ?? "",
      productName: row.product_name_snapshot,
      productSku: row.product_sku_snapshot,
      quantity: Number(row.quantity),
      unit: row.unit_snapshot,
      unitCost: Number(row.unit_cost),
      createdAt: header?.created_at ?? "",
    };
  });

  const sorted = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Keep only the first (= most recent, already sorted newest-first)
  // occurrence per product.
  const seen = new Set<string>();
  const latestPerProduct: ReceiptReportRow[] = [];
  for (const row of sorted) {
    const key = row.productSku ?? row.productName;
    if (seen.has(key)) continue;
    seen.add(key);
    latestPerProduct.push(row);
  }
  return latestPerProduct;
}
