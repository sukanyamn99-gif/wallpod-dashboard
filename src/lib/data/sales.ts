import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { mockProjects } from "@/lib/mock-data";
import { getAllSaleReports } from "@/lib/data/sale-reports";
import type { CustomerType, Project, SaleReport, StagePercent } from "@/lib/types";
import { computeSalesAggregates, computePipelineByStage, type FilteredSalesData } from "@/lib/dashboard/sales-aggregate";

async function fetchLiveProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, stage_percent, production_status, pre_vat, vat, total, customers(name), sales_reps(name), project_items(product_category, amount), payments(installment_no, outstanding_amount)",
    )
    .eq("is_cancelled", false);

  if (error) throw error;

  type EmbeddedItem = { product_category: string; amount: number };
  type EmbeddedPayment = { installment_no: number; outstanding_amount: number };

  return (data ?? []).map((row) => ({
    id: row.id,
    job_no: row.job_no,
    project_date: row.project_date,
    customer_id: row.customer_id,
    // @ts-expect-error -- Supabase types the joined relation loosely here
    customer_name: row.customers?.name ?? "",
    project_name: row.project_name,
    sales_rep_id: row.sales_rep_id,
    // @ts-expect-error -- Supabase types the joined relation loosely here
    sales_rep_name: row.sales_reps?.name ?? "",
    customer_type: row.customer_type as CustomerType,
    stage_percent: row.stage_percent as StagePercent,
    production_status: row.production_status,
    pre_vat: Number(row.pre_vat),
    vat: Number(row.vat),
    total: Number(row.total),
    outstanding: (() => {
      const payments = (row.payments as unknown as EmbeddedPayment[] | null) ?? [];
      const payment = payments.find((pay) => pay.installment_no === 1) ?? payments.find((pay) => pay.installment_no === 2);
      return payment ? Number(payment.outstanding_amount) : null;
    })(),
    items: ((row.project_items as unknown as EmbeddedItem[] | null) ?? []).map((i) => ({
      category: i.product_category,
      amount: Number(i.amount),
    })),
  }));
}

async function getProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) return mockProjects;
  return fetchLiveProjects();
}

export interface SalesDashboardRawData {
  projects: Project[];
  saleReports: SaleReport[];
}

// Raw, unaggregated data for the Sales Dashboard — fetched once server-side
// and handed to the client component, which recomputes the aggregates (via
// computeSalesAggregates/computePipelineByStage) whenever the month/sales-rep
// filter changes, instead of round-tripping to the server per filter click.
export async function getSalesDashboardRawData(): Promise<SalesDashboardRawData> {
  const [projects, saleReports] = await Promise.all([getProjects(), getAllSaleReports()]);
  return { projects, saleReports };
}

export type { FilteredSalesData };
export { computeSalesAggregates, computePipelineByStage };
export { getProjects };
