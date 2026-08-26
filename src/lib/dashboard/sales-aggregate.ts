// Pure, Supabase-free aggregation logic shared by the server (initial render)
// and the client (recomputing after the user changes the month/sales-rep
// filter) — kept import-free of anything server-only so the same functions
// work in both a Server Component and a "use client" component.
import { endOfMonth, format, isWithinInterval, startOfMonth, subMonths } from "date-fns";
import { th } from "date-fns/locale";
import { mockCustomerTypes } from "@/lib/mock-data";
import type { CustomerType, Project, SaleReport, StagePercent } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/types";

const MONTHS_TO_SHOW = 8;

export function monthKeyOf(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthRange(projects: Project[]) {
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
    const inMonth = projects.filter((p) => isWithinInterval(new Date(p.project_date), { start, end }));
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

function getCategoryBreakdown(projects: Project[]) {
  const categorySet = new Set<string>();
  for (const p of projects) for (const item of p.items) categorySet.add(item.category);

  return Array.from(categorySet)
    .map((category) => {
      let value = 0;
      let count = 0;
      for (const p of projects) {
        for (const item of p.items) {
          if (item.category === category) {
            value += item.amount;
            count += 1;
          }
        }
      }
      return { category, value, count };
    })
    .filter((row) => row.count > 0);
}

export interface FilteredSalesData {
  totalPipelineValue: number;
  totalProjectsCount: number;
  closedProjectsCount: number;
  openProjectsCount: number;
  closedThisMonthValue: number;
  customerTypeBreakdown: { type: CustomerType; value: number; count: number }[];
  categoryBreakdown: { category: string; value: number; count: number }[];
  salesRepPerformance: { salesRepId: string; salesRepName: string; totalValue: number; closedValue: number; projectCount: number }[];
  monthlySales: { monthLabel: string; value: number; count: number }[];
  repMonthlyPerformance: {
    months: string[];
    rows: { salesRepId: string; salesRepName: string; values: number[]; total: number }[];
  };
}

export function computeSalesAggregates(projects: Project[]): FilteredSalesData {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalPipelineValue = projects.reduce((sum, p) => sum + p.pre_vat, 0);
  const totalProjectsCount = projects.length;
  // "ปิดงาน" = money for the last installment has actually been collected
  // (outstanding is 0, per the receipt-gated calc in project-sales' save
  // logic) — not a manually-picked production_status, which used to be the
  // only check here and could drift from what was actually paid.
  const closedProjectsCount = projects.filter((p) => p.outstanding !== null && p.outstanding <= 0).length;
  const openProjectsCount = totalProjectsCount - closedProjectsCount;

  const closedThisMonthValue = projects
    .filter((p) => p.stage_percent === 100 && new Date(p.project_date) >= monthStart)
    .reduce((sum, p) => sum + p.pre_vat, 0);

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
        closedValue: repProjects.filter((p) => p.stage_percent === 100).reduce((sum, p) => sum + p.total, 0),
        projectCount: repProjects.length,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);

  const months = getMonthRange(projects);

  return {
    totalPipelineValue,
    totalProjectsCount,
    closedProjectsCount,
    openProjectsCount,
    closedThisMonthValue,
    customerTypeBreakdown,
    categoryBreakdown: getCategoryBreakdown(projects),
    salesRepPerformance,
    monthlySales: getMonthlySales(projects, months),
    repMonthlyPerformance: getRepMonthlyPerformance(projects, months),
  };
}

export function computePipelineByStage(saleReports: SaleReport[]) {
  const stages: StagePercent[] = [10, 30, 50, 100, 0];
  return stages.map((stage) => {
    const inStage = saleReports.filter((r) => r.stage_percent === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      value: inStage.reduce((sum, r) => sum + r.est_value, 0),
      count: inStage.length,
    };
  });
}
