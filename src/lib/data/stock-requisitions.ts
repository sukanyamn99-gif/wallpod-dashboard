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

export interface MaterialCostSuggestion {
  total: number;
  requisitionCount: number;
  itemCount: number;
  // stock_requisition_items never stored a cost at withdrawal time, so this
  // is quantity × the product's CURRENT unit_cost (weighted-average),
  // applied retroactively — an approximation, not the historical cost.
  // Items whose product was later deleted (stock_product_id set null by the
  // FK) have no cost basis at all and are counted here rather than silently
  // dropped, so the UI can flag the total as incomplete.
  missingCostItemCount: number;
}

// Sums material cost across every stock requisition tagged with this JOB
// NO. — feeds the "ดึงยอดจากใบเบิก" suggestion button on the Project Sale
// cost form. Requires an exact job_no match (requisitions use the same
// free-text-with-autocomplete field as Project Sales' own JOB NO., so a
// typo'd requisition simply won't be found here rather than erroring).
export async function getMaterialCostByJobNo(jobNo: string): Promise<MaterialCostSuggestion> {
  const empty: MaterialCostSuggestion = { total: 0, requisitionCount: 0, itemCount: 0, missingCostItemCount: 0 };
  const trimmed = jobNo.trim();
  if (!trimmed || !isSupabaseConfigured()) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_requisitions")
    .select("id, stock_requisition_items(quantity, stock_product_id, stock_products(unit_cost))")
    .eq("job_no", trimmed);
  if (error) throw error;

  let total = 0;
  let itemCount = 0;
  let missingCostItemCount = 0;
  for (const req of data ?? []) {
    for (const item of req.stock_requisition_items ?? []) {
      itemCount++;
      // @ts-expect-error -- Supabase types the joined relation loosely here
      const unitCost = item.stock_products?.unit_cost;
      if (unitCost == null) {
        missingCostItemCount++;
        continue;
      }
      total += Number(item.quantity) * Number(unitCost);
    }
  }

  return { total, requisitionCount: (data ?? []).length, itemCount, missingCostItemCount };
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
