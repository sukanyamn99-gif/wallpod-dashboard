import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { GoodsReceipt, GoodsReceiptItem } from "@/lib/types";

const HEADER_COLUMNS =
  "id, doc_no, supplier_id, received_by, reference_no, note, created_at, suppliers(name), profiles(full_name)";

type HeaderRow = {
  id: string;
  doc_no: string;
  supplier_id: string | null;
  received_by: string | null;
  reference_no: string | null;
  note: string | null;
  created_at: string;
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
  };
}

export async function getGoodsReceipts(): Promise<Omit<GoodsReceipt, "items">[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(HEADER_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // @ts-expect-error -- Supabase types the joined relation loosely here
  return (data ?? []).map(mapHeader);
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

// Flat, one-row-per-line-item view of every goods receipt ever recorded —
// the source for the monthly receipt report page, which filters/groups by
// month and product on the client rather than re-querying per filter change.
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

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
