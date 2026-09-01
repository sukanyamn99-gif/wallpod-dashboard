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
    .select(
      "id, stock_product_id, product_name_snapshot, product_sku_snapshot, unit_snapshot, quantity, unit_cost, stock_products(unit_cost)",
    )
    .eq("requisition_id", id);
  if (itemsErr) throw itemsErr;

  // Requisitions submitted before unit_cost was snapshotted at withdrawal
  // time (migration_038) default to 0 — fall back to the product's CURRENT
  // weighted-average cost (an approximation, flagged via isEstimatedCost)
  // rather than showing no cost at all, same convention already used for
  // getJobLinkedCosts()/getMaterialCostByJobNo().
  const mappedItems: StockRequisitionItem[] = (items ?? []).map((row) => {
    const snapshotCost = Number(row.unit_cost);
    // @ts-expect-error -- Supabase types the joined relation loosely here
    const liveCost = row.stock_products?.unit_cost;
    const isEstimatedCost = snapshotCost <= 0 && liveCost != null;
    const unitCost = snapshotCost > 0 ? snapshotCost : (liveCost ?? 0);
    return {
      id: row.id,
      stockProductId: row.stock_product_id,
      productName: row.product_name_snapshot,
      productSku: row.product_sku_snapshot,
      quantity: Number(row.quantity),
      unit: row.unit_snapshot,
      unitCost: Number(unitCost),
      isEstimatedCost,
    };
  });

  return {
    // @ts-expect-error -- Supabase types the joined relation loosely here
    ...mapHeader(header),
    items: mappedItems,
  };
}

export interface RequisitionItemReportRow {
  requisitionId: string;
  productName: string;
  quantity: number;
  createdAt: string;
}

export async function getStockRequisitionItemsForReport(): Promise<RequisitionItemReportRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_requisition_items")
    .select("requisition_id, product_name_snapshot, quantity, stock_requisitions(created_at)");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    requisitionId: row.requisition_id,
    productName: row.product_name_snapshot,
    quantity: Number(row.quantity),
    // @ts-expect-error -- Supabase types the joined relation loosely here
    createdAt: row.stock_requisitions?.created_at ?? "",
  }));
}

// Flat, one-row-per-line-item view of every requisition ever submitted — the
// source for the monthly requisition report page, which filters/groups by
// month and product on the client rather than re-querying per filter change.
export interface RequisitionReportRow {
  id: string;
  docNo: string;
  departmentName: string | null;
  requestedByName: string;
  jobNo: string | null;
  productName: string;
  productSku: string | null;
  quantity: number;
  unit: string;
  createdAt: string;
}

export async function getRequisitionReportRows(): Promise<RequisitionReportRow[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_requisition_items")
    .select(
      "id, product_name_snapshot, product_sku_snapshot, quantity, unit_snapshot, stock_requisitions(doc_no, job_no, created_at, departments(name), profiles(full_name))",
    );
  if (error) throw error;

  const rows: RequisitionReportRow[] = (data ?? []).map((row) => {
    const header = row.stock_requisitions as unknown as {
      doc_no: string;
      job_no: string | null;
      created_at: string;
      departments: { name: string } | null;
      profiles: { full_name: string } | null;
    } | null;
    return {
      id: row.id,
      docNo: header?.doc_no ?? "",
      departmentName: header?.departments?.name ?? null,
      requestedByName: header?.profiles?.full_name ?? "",
      jobNo: header?.job_no ?? null,
      productName: row.product_name_snapshot,
      productSku: row.product_sku_snapshot,
      quantity: Number(row.quantity),
      unit: row.unit_snapshot,
      createdAt: header?.created_at ?? "",
    };
  });

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
