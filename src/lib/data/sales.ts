import { endOfMonth, format, isWithinInterval, startOfMonth, subMonths } from "date-fns";
import { th } from "date-fns/locale";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { mockCategoryBreakdown, mockCustomerTypes, mockProjects } from "@/lib/mock-data";
import { getAllSaleReports } from "@/lib/data/sale-reports";
import { getProductCategories } from "@/lib/data/reference";
import type { CustomerType, Project, ProductCategory, SalesDashboardData, StagePercent } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";

const MONTHS_TO_SHOW = 8;

function getMonthRange(projects: Project[]) {
  const now = new Date();
  const months = Array.from({ length: MONTHS_TO_SHOW }, (_, i) => {
    const monthAnchor = subMonths(now, MONTHS_TO_SHOW - 1 - i);
    const start = startOfMonth(monthAnchor);
    const end = endOfMonth(monthAnchor);
    return { start, end, label: format(start, "MMM yy", { locale: th }) };
  });

  // Drop leading months with no sales at all — those precede the earliest
  // recorded data and would otherwise show as a misleading empty bar/column.
  const firstWithData = months.findIndex(
    ({ start, end }) => projects.some((p) => isWithinInterval(new Date(p.project_date), { start, end })),
  );
  return firstWithData === -1 ? months : months.slice(firstWithData);
}

function getMonthlySales(projects: Project[], months: ReturnType<typeof getMonthRange>) {
  return months.map(({ start, end, label }) => {
    const inMonth = projects.filter((p) =>
      isWithinInterval(new Date(p.project_date), { start, end }),
    );
    return {
      monthLabel: label,
      value: inMonth.reduce((sum, p) => sum + p.pre_vat, 0),
      count: inMonth.length,
    };
  });
}

function getRepMonthlyPerformance(projects: Project[], months: ReturnType<typeof getMonthRange>) {
  const repIds = Array.from(new Set(projects.map((p) => p.sales_rep_id)));
  const rows = repIds
    .map((id) => {
      const repProjects = projects.filter((p) => p.sales_rep_id === id);
      const values = months.map(({ start, end }) =>
        repProjects
          .filter((p) => isWithinInterval(new Date(p.project_date), { start, end }))
          .reduce((sum, p) => sum + p.total, 0),
      );
      return {
        salesRepId: id,
        salesRepName: repProjects[0]?.sales_rep_name ?? "",
        values,
        total: values.reduce((sum, v) => sum + v, 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  return { months: months.map((m) => m.label), rows };
}

async function fetchLiveProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, stage_percent, production_status, pre_vat, vat, total, customers(name), sales_reps(name)",
    )
    .eq("is_cancelled", false);

  if (error) throw error;

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
  }));
}

async function getProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) return mockProjects;
  return fetchLiveProjects();
}

async function getCategoryBreakdown(
  projects: Project[],
): Promise<{ category: ProductCategory; value: number; count: number }[]> {
  if (!isSupabaseConfigured()) return mockCategoryBreakdown;

  const supabase = await createClient();
  const projectIds = projects.map((p) => p.id);
  const [{ data, error }, liveCategories] = await Promise.all([
    supabase.from("project_items").select("product_category, amount").in("project_id", projectIds),
    getProductCategories(),
  ]);
  if (error) throw error;

  // Union the managed list with whatever categories actually appear in the
  // data, so a renamed/deleted category doesn't silently drop its historical
  // slice out of this chart.
  const categorySet = new Set(liveCategories.map((c) => c.name));
  for (const r of data ?? []) categorySet.add(r.product_category);

  return Array.from(categorySet)
    .map((cat) => {
      const rows = (data ?? []).filter((r) => r.product_category === cat);
      return {
        category: cat,
        value: rows.reduce((sum, r) => sum + Number(r.amount), 0),
        count: rows.length,
      };
    })
    .filter((row) => row.count > 0);
}

export async function getSalesDashboardData(): Promise<SalesDashboardData> {
  const projects = await getProjects();
  const [categoryBreakdown, allSaleReports] = await Promise.all([
    getCategoryBreakdown(projects),
    getAllSaleReports(),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalPipelineValue = projects.reduce((sum, p) => sum + p.pre_vat, 0);
  // "Open" now tracks production status, not the sales stage (every job in this
  // table is already closed/invoiced) — anything short of the final payment
  // step counts as open, including jobs that haven't been given a status yet.
  const openProjectsCount = projects.filter((p) => p.production_status !== "เก็บเงินงวดสุดท้าย").length;

  const closedThisMonthValue = projects
    .filter((p) => p.stage_percent === 100 && new Date(p.project_date) >= monthStart)
    .reduce((sum, p) => sum + p.pre_vat, 0);

  // Pipeline funnel reflects live Sale Reports (self-reported by sales reps),
  // not the historical `projects` import — the Excel data had no pre-close stages.
  const stages: StagePercent[] = [10, 30, 50, 100, 0];
  const pipelineByStage = stages.map((stage) => {
    const inStage = allSaleReports.filter((r) => r.stage_percent === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      value: inStage.reduce((sum, r) => sum + r.est_value, 0),
      count: inStage.length,
    };
  });

  const customerTypeBreakdown = mockCustomerTypes
    .map((type) => {
      const inType = projects.filter((p) => p.customer_type === type);
      return {
        type,
        value: inType.reduce((sum, p) => sum + p.total, 0),
        count: inType.length,
      };
    })
    .filter((row) => row.count > 0);

  const repIds = Array.from(new Set(projects.map((p) => p.sales_rep_id)));
  const salesRepPerformance = repIds
    .map((id) => {
      const repProjects = projects.filter((p) => p.sales_rep_id === id);
      return {
        salesRepId: id,
        salesRepName: repProjects[0]?.sales_rep_name ?? "",
        totalValue: repProjects.reduce((sum, p) => sum + p.total, 0),
        closedValue: repProjects
          .filter((p) => p.stage_percent === 100)
          .reduce((sum, p) => sum + p.total, 0),
        projectCount: repProjects.length,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);

  const months = getMonthRange(projects);

  return {
    totalPipelineValue,
    openProjectsCount,
    closedThisMonthValue,
    pipelineByStage,
    customerTypeBreakdown,
    categoryBreakdown,
    salesRepPerformance,
    monthlySales: getMonthlySales(projects, months),
    repMonthlyPerformance: getRepMonthlyPerformance(projects, months),
  };
}

export { getProjects };
