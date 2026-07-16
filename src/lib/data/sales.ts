import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { mockCustomerTypes, mockProjects } from "@/lib/mock-data";
import { getTodayVisits } from "@/lib/data/visits";
import type { CustomerType, Project, SalesDashboardData, StagePercent } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";

async function fetchLiveProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, job_no, project_date, customer_id, project_name, sales_rep_id, customer_type, stage_percent, pre_vat, vat, total, customers(name), sales_reps(name)",
    );

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
    pre_vat: Number(row.pre_vat),
    vat: Number(row.vat),
    total: Number(row.total),
  }));
}

async function getProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) return mockProjects;
  return fetchLiveProjects();
}

export async function getSalesDashboardData(): Promise<SalesDashboardData> {
  const [projects, todayVisits] = await Promise.all([getProjects(), getTodayVisits()]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalPipelineValue = projects.reduce((sum, p) => sum + p.total, 0);
  const openProjectsCount = projects.filter((p) => p.stage_percent < 100).length;

  const closedThisMonthValue = projects
    .filter((p) => p.stage_percent === 100 && new Date(p.project_date) >= monthStart)
    .reduce((sum, p) => sum + p.total, 0);

  const stages: StagePercent[] = [10, 30, 50, 100];
  const pipelineByStage = stages.map((stage) => {
    const inStage = projects.filter((p) => p.stage_percent === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      value: inStage.reduce((sum, p) => sum + p.total, 0),
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

  return {
    totalPipelineValue,
    openProjectsCount,
    todayVisitsCount: todayVisits.length,
    closedThisMonthValue,
    pipelineByStage,
    customerTypeBreakdown,
    salesRepPerformance,
  };
}

export { getProjects };
