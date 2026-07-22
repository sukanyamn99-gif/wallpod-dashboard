import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { RequisitionPurpose, StockRequisition, StockRequisitionItem } from "@/lib/types";

const HEADER_COLUMNS =
  "id, doc_no, department_id, requested_by, job_no, project_name, purpose, customer_id, note, status, created_at, departments(name), profiles(full_name), customers(name)";

type HeaderRow = {
  id: string;
  doc_no: string;
  requested_by: string | null;
  job_no: string | null;
  project_name: string | null;
  purpose: string;
  note: string | null;
  status: string;
  created_at: string;
  departments: { name: string } | null;
  profiles: { full_name: string } | null;
  customers: { name: string } | null;
};

function mapHeader(row: HeaderRow): Omit<StockRequisition, "items"> {
  return {
    id: row.id,
    docNo: row.doc_no,
    departmentName: row.departments?.name ?? null,
    requestedById: row.requested_by,
    requestedByName: row.profiles?.full_name ?? "",
    jobNo: row.job_no,
    projectName: row.project_name,
    purpose: row.purpose as RequisitionPurpose,
    customerName: row.customers?.name ?? null,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getStockRequisitions(): Promise<Omit<StockRequisition, "items">[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_requisitions")
    .select(HEADER_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // @ts-expect-error -- Supabase types the joined relation loosely here
  return (data ?? []).map(mapHeader);
}

export async function getStockRequisitionById(id: string): Promise<StockRequisition | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data: header, error: headerErr } = await supabase
    .from("stock_requisitions")
    .select(HEADER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (headerErr) throw headerErr;
  if (!header) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("stock_requisition_items")
    .select("id, stock_product_id, product_name_snapshot, product_sku_snapshot, unit_snapshot, quantity")
    .eq("requisition_id", id);
  if (itemsErr) throw itemsErr;

  const mappedItems: StockRequisitionItem[] = (items ?? []).map((row) => ({
    id: row.id,
    stockProductId: row.stock_product_id,
    productName: row.product_name_snapshot,
    productSku: row.product_sku_snapshot,
    quantity: Number(row.quantity),
    unit: row.unit_snapshot,
  }));

  return {
    // @ts-expect-error -- Supabase types the joined relation loosely here
    ...mapHeader(header),
    items: mappedItems,
  };
}
