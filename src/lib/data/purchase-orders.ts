import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderReceivingStatus } from "@/lib/types";

const HEADER_COLUMNS =
  "id, doc_no, request_id, supplier_id, order_date, ordered_by, expected_date, note, created_at, " +
  "purchase_requests(doc_no), suppliers(name), profiles(full_name)";

type HeaderRow = {
  id: string;
  doc_no: string;
  request_id: string;
  supplier_id: string | null;
  order_date: string;
  ordered_by: string | null;
  expected_date: string | null;
  note: string | null;
  created_at: string;
  purchase_requests: { doc_no: string } | null;
  suppliers: { name: string } | null;
  profiles: { full_name: string } | null;
};

type ItemRow = {
  id: string;
  order_id: string;
  stock_product_id: string | null;
  product_name_snapshot: string;
  product_sku_snapshot: string | null;
  unit_snapshot: string;
  quantity: number | string;
  unit_price: number | string;
};

function receivingStatusOf(items: PurchaseOrderItem[]): PurchaseOrderReceivingStatus {
  const totalOrdered = items.reduce((sum, it) => sum + it.quantity, 0);
  const totalReceived = items.reduce((sum, it) => sum + Math.min(it.receivedQuantity, it.quantity), 0);
  if (totalReceived <= 0) return "รอรับสินค้า";
  if (totalReceived >= totalOrdered) return "รับครบแล้ว";
  return "รับบางส่วน";
}

async function getItemsByOrderIds(supabase: Awaited<ReturnType<typeof createClient>>, orderIds: string[]) {
  const itemsMap = new Map<string, PurchaseOrderItem[]>();
  if (orderIds.length === 0) return itemsMap;

  const { data: itemRows, error: itemsErr } = await supabase
    .from("purchase_order_items")
    .select("id, order_id, stock_product_id, product_name_snapshot, product_sku_snapshot, unit_snapshot, quantity, unit_price")
    .in("order_id", orderIds);
  if (itemsErr) throw itemsErr;

  const rows = (itemRows ?? []) as ItemRow[];
  const itemIds = rows.map((r) => r.id);

  // Sum received quantity per order line from every receipt ever recorded
  // against it — computed on read, never stored, same convention as this
  // app's other running totals (AR aging, GP margins).
  const receivedByItemId = new Map<string, number>();
  if (itemIds.length > 0) {
    const { data: receiptItems, error: receiptErr } = await supabase
      .from("purchase_order_receipt_items")
      .select("order_item_id, quantity")
      .in("order_item_id", itemIds);
    if (receiptErr) throw receiptErr;
    for (const row of receiptItems ?? []) {
      if (!row.order_item_id) continue;
      receivedByItemId.set(row.order_item_id, (receivedByItemId.get(row.order_item_id) ?? 0) + Number(row.quantity));
    }
  }

  for (const row of rows) {
    const item: PurchaseOrderItem = {
      id: row.id,
      stockProductId: row.stock_product_id,
      productName: row.product_name_snapshot,
      productSku: row.product_sku_snapshot,
      unit: row.unit_snapshot,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      receivedQuantity: receivedByItemId.get(row.id) ?? 0,
    };
    const list = itemsMap.get(row.order_id) ?? [];
    list.push(item);
    itemsMap.set(row.order_id, list);
  }
  return itemsMap;
}

function mapHeader(row: HeaderRow, items: PurchaseOrderItem[]): PurchaseOrder {
  return {
    id: row.id,
    docNo: row.doc_no,
    requestId: row.request_id,
    requestDocNo: row.purchase_requests?.doc_no ?? "",
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name ?? null,
    orderDate: row.order_date,
    orderedById: row.ordered_by,
    orderedByName: row.profiles?.full_name ?? "",
    expectedDate: row.expected_date,
    note: row.note,
    createdAt: row.created_at,
    items,
    totalAmount: items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
    receivingStatus: receivingStatusOf(items),
  };
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(HEADER_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const headers = (data ?? []) as unknown as HeaderRow[];
  const itemsByOrder = await getItemsByOrderIds(
    supabase,
    headers.map((h) => h.id),
  );
  return headers.map((h) => mapHeader(h, itemsByOrder.get(h.id) ?? []));
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: header, error: headerErr } = await supabase
    .from("purchase_orders")
    .select(HEADER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (headerErr) throw headerErr;
  if (!header) return null;

  const itemsByOrder = await getItemsByOrderIds(supabase, [id]);
  // @ts-expect-error -- Supabase types the joined relation loosely here
  return mapHeader(header, itemsByOrder.get(id) ?? []);
}

// Purchase orders that still have at least one line with remaining quantity
// to receive — the source list for the ใบรับสินค้า (receiving) form's PO
// picker.
export async function getOpenPurchaseOrders(): Promise<PurchaseOrder[]> {
  const orders = await getPurchaseOrders();
  return orders.filter((o) => o.receivingStatus !== "รับครบแล้ว");
}
