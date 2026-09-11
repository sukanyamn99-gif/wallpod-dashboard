import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { PurchaseRequest, PurchaseRequestItem, PurchaseRequestStatus } from "@/lib/types";

// Two FKs to profiles (requested_by/approved_by) need explicit relationship
// hints — Postgres's default constraint name for an inline `references`
// column is <table>_<column>_fkey.
const HEADER_COLUMNS =
  "id, doc_no, request_date, requested_by, department_id, purpose, status, approved_by, approved_at, note, created_at, " +
  "departments(name), " +
  "requester:profiles!purchase_requests_requested_by_fkey(full_name), " +
  "approver:profiles!purchase_requests_approved_by_fkey(full_name)";

type HeaderRow = {
  id: string;
  doc_no: string;
  request_date: string;
  requested_by: string | null;
  department_id: string | null;
  purpose: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  note: string | null;
  created_at: string;
  departments: { name: string } | null;
  requester: { full_name: string } | null;
  approver: { full_name: string } | null;
};

function mapHeader(row: HeaderRow): Omit<PurchaseRequest, "items"> {
  return {
    id: row.id,
    docNo: row.doc_no,
    requestDate: row.request_date,
    requestedById: row.requested_by,
    requestedByName: row.requester?.full_name ?? "",
    departmentId: row.department_id,
    departmentName: row.departments?.name ?? null,
    purpose: row.purpose,
    status: row.status as PurchaseRequestStatus,
    approvedByName: row.approver?.full_name ?? null,
    approvedAt: row.approved_at,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function getPurchaseRequests(): Promise<Omit<PurchaseRequest, "items">[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_requests")
    .select(HEADER_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // @ts-expect-error -- Supabase types the joined relation loosely here
  return (data ?? []).map(mapHeader);
}

async function getItemsByRequestIds(supabase: Awaited<ReturnType<typeof createClient>>, requestIds: string[]) {
  if (requestIds.length === 0) return new Map<string, PurchaseRequestItem[]>();

  const { data, error } = await supabase
    .from("purchase_request_items")
    .select("id, request_id, stock_product_id, product_name_snapshot, product_sku_snapshot, unit_snapshot, quantity, note")
    .in("request_id", requestIds);
  if (error) throw error;

  const map = new Map<string, PurchaseRequestItem[]>();
  for (const row of data ?? []) {
    const item: PurchaseRequestItem = {
      id: row.id,
      stockProductId: row.stock_product_id,
      productName: row.product_name_snapshot,
      productSku: row.product_sku_snapshot,
      unit: row.unit_snapshot,
      quantity: Number(row.quantity),
      note: row.note,
    };
    const list = map.get(row.request_id) ?? [];
    list.push(item);
    map.set(row.request_id, list);
  }
  return map;
}

export async function getPurchaseRequestById(id: string): Promise<PurchaseRequest | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: header, error: headerErr } = await supabase
    .from("purchase_requests")
    .select(HEADER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (headerErr) throw headerErr;
  if (!header) return null;

  const itemsByRequest = await getItemsByRequestIds(supabase, [id]);

  return {
    // @ts-expect-error -- Supabase types the joined relation loosely here
    ...mapHeader(header),
    items: itemsByRequest.get(id) ?? [],
  };
}

// Approved requests with their items, for the ใบสั่งซื้อ (PO) creation form's
// picker — selecting one pre-fills the PO's item list from these snapshots.
export async function getApprovedPurchaseRequests(): Promise<PurchaseRequest[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_requests")
    .select(HEADER_COLUMNS)
    .eq("status", "อนุมัติ")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const headers = (data ?? []) as unknown as HeaderRow[];
  const itemsByRequest = await getItemsByRequestIds(
    supabase,
    headers.map((h) => h.id),
  );

  return headers.map((h) => ({ ...mapHeader(h), items: itemsByRequest.get(h.id) ?? [] }));
}
