"use client";

import { useMemo, useState } from "react";
import { isWithinInterval } from "date-fns";
import { Briefcase, CheckCircle2, CircleDollarSign, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MultiSelectFilter } from "@/components/dashboard/multi-select-filter";
import {
  CustomerTypeChart,
  MonthlySalesChart,
  PipelineByStageChart,
  ProductCategoryChart,
  RepMonthlyPerformanceChart,
  SalesRepPerformanceChart,
} from "@/components/dashboard/sales-charts";
import { DrillDownDialog, type DrillDown } from "./drill-down-dialog";
import { computeSalesAggregates, computePipelineByStage, monthKeyOf, getMonthRange } from "@/lib/dashboard/sales-aggregate";
import type { CancelledProjectSummary } from "@/lib/data/sales";
import { formatTHB } from "@/lib/format";
import { STAGE_LABELS, type Project, type SaleReport } from "@/lib/types";

function monthLabelOf(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  return label;
}

export function SalesDashboardView({
  projects,
  saleReports,
  cancelledProjects,
  canDrillDown,
}: {
  projects: Project[];
  saleReports: SaleReport[];
  cancelledProjects: CancelledProjectSummary[];
  canDrillDown: boolean;
}) {
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [selectedSalesReps, setSelectedSalesReps] = useState<Set<string>>(new Set());
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);

  const monthOptions = useMemo(() => {
    // Anchor the options list to the same trailing window the trend charts
    // use, so a month with zero jobs is still selectable (and correctly
    // shows an empty dashboard) rather than silently absent from the list.
    const keys = new Set(getMonthRange(projects).map((m) => monthKeyOf(m.start.toISOString())));
    for (const p of projects) keys.add(monthKeyOf(p.project_date));
    return Array.from(keys)
      .sort()
      .map((key) => ({ value: key, label: monthLabelOf(key) }));
  }, [projects]);

  const salesRepOptions = useMemo(() => {
    const names = new Set([
      ...projects.map((p) => p.sales_rep_name).filter(Boolean),
      ...saleReports.map((r) => r.sales_rep_name).filter(Boolean),
    ]);
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, "th"))
      .map((name) => ({ value: name, label: name }));
  }, [projects, saleReports]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedMonths.size > 0 && !selectedMonths.has(monthKeyOf(p.project_date))) return false;
      if (selectedSalesReps.size > 0 && !selectedSalesReps.has(p.sales_rep_name)) return false;
      return true;
    });
  }, [projects, selectedMonths, selectedSalesReps]);

  const cancelledCount = useMemo(() => {
    return cancelledProjects.filter((p) => {
      if (selectedMonths.size > 0 && !selectedMonths.has(monthKeyOf(p.project_date))) return false;
      if (selectedSalesReps.size > 0 && !selectedSalesReps.has(p.sales_rep_name)) return false;
      return true;
    }).length;
  }, [cancelledProjects, selectedMonths, selectedSalesReps]);

  const filteredSaleReports = useMemo(() => {
    return saleReports.filter((r) => {
      if (selectedMonths.size > 0 && !selectedMonths.has(monthKeyOf(r.created_at))) return false;
      if (selectedSalesReps.size > 0 && !selectedSalesReps.has(r.sales_rep_name)) return false;
      return true;
    });
  }, [saleReports, selectedMonths, selectedSalesReps]);

  const agg = useMemo(() => computeSalesAggregates(filteredProjects), [filteredProjects]);
  const pipelineByStage = useMemo(() => computePipelineByStage(filteredSaleReports), [filteredSaleReports]);
  const trendMonths = useMemo(() => getMonthRange(filteredProjects), [filteredProjects]);

  function showCustomerType(type: Project["customer_type"]) {
    setDrillDown({
      kind: "projects",
      title: `ลูกค้ากลุ่ม ${type}`,
      rows: filteredProjects.filter((p) => p.customer_type === type),
    });
  }

  function showCategory(category: string) {
    setDrillDown({
      kind: "projects",
      title: `งานประเภท ${category}`,
      rows: filteredProjects.filter((p) => p.items.some((i) => i.category === category)),
    });
  }

  function showSalesRep(salesRepId: string) {
    const rep = agg.salesRepPerformance.find((r) => r.salesRepId === salesRepId);
    setDrillDown({
      kind: "projects",
      title: `งานของ ${rep?.salesRepName ?? ""}`,
      rows: filteredProjects.filter((p) => p.sales_rep_id === salesRepId),
    });
  }

  function showRepMonth(salesRepId: string, monthIndex: number) {
    const rep = agg.salesRepPerformance.find((r) => r.salesRepId === salesRepId);
    const month = trendMonths[monthIndex];
    if (!month) return;
    setDrillDown({
      kind: "projects",
      title: `${rep?.salesRepName ?? ""} · ${month.label}`,
      rows: filteredProjects.filter(
        (p) => p.sales_rep_id === salesRepId && isWithinInterval(new Date(p.project_date), { start: month.start, end: month.end }),
      ),
    });
  }

  function showMonth(monthIndex: number) {
    const month = trendMonths[monthIndex];
    if (!month) return;
    setDrillDown({
      kind: "projects",
      title: `งานเดือน ${month.label}`,
      rows: filteredProjects.filter((p) => isWithinInterval(new Date(p.project_date), { start: month.start, end: month.end })),
    });
  }

  function showStage(stage: 0 | 10 | 30 | 50 | 100) {
    setDrillDown({
      kind: "saleReports",
      title: `Pipeline: ${STAGE_LABELS[stage]}`,
      rows: filteredSaleReports.filter((r) => r.stage_percent === stage),
    });
  }

  function showAllFiltered() {
    setDrillDown({
      kind: "projects",
      title: "งานทั้งหมด",
      rows: filteredProjects,
    });
  }

  function showClosedThisMonth() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    setDrillDown({
      kind: "projects",
      title: "ปิดการขายเดือนนี้",
      rows: filteredProjects.filter((p) => p.stage_percent === 100 && new Date(p.project_date) >= monthStart),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground">ภาพรวมยอดขายและ pipeline</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelectFilter
            allLabel="ทุกเดือน"
            countLabel="เดือน"
            options={monthOptions}
            selected={selectedMonths}
            onChange={setSelectedMonths}
          />
          <MultiSelectFilter
            allLabel="ทุกพนักงาน"
            countLabel="พนักงาน"
            options={salesRepOptions}
            selected={selectedSalesReps}
            onChange={setSelectedSalesReps}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="มูลค่ารวม (Pipeline)"
          value={formatTHB(agg.totalPipelineValue)}
          icon={CircleDollarSign}
          tone="blue"
          onClick={canDrillDown ? showAllFiltered : undefined}
        />
        <KpiCard
          label="จำนวนงานทั้งหมด"
          value={`รวม ${agg.totalProjectsCount + cancelledCount} · active ${agg.totalProjectsCount} · ยกเลิก ${cancelledCount}`}
          icon={Briefcase}
          tone="green"
          onClick={canDrillDown ? showAllFiltered : undefined}
        />
        <KpiCard
          label="สถานะงาน"
          value={`ปิดแล้ว ${agg.closedProjectsCount} · ยังไม่ปิด ${agg.openProjectsCount}`}
          icon={CheckCircle2}
          tone="amber"
          onClick={canDrillDown ? showAllFiltered : undefined}
        />
        <KpiCard
          label="ยอดปิดการขายเดือนนี้"
          value={formatTHB(agg.closedThisMonthValue)}
          icon={TrendingUp}
          tone="violet"
          onClick={canDrillDown ? showClosedThisMonth : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PipelineByStageChart data={pipelineByStage} onBarClick={canDrillDown ? showStage : undefined} />
        <CustomerTypeChart data={agg.customerTypeBreakdown} onSliceClick={canDrillDown ? showCustomerType : undefined} />
        <ProductCategoryChart data={agg.categoryBreakdown} onSliceClick={canDrillDown ? showCategory : undefined} />
      </div>

      <SalesRepPerformanceChart data={agg.salesRepPerformance} onBarClick={canDrillDown ? showSalesRep : undefined} />
      <RepMonthlyPerformanceChart data={agg.repMonthlyPerformance} onBarClick={canDrillDown ? showRepMonth : undefined} />
      <MonthlySalesChart data={agg.monthlySales} onBarClick={canDrillDown ? showMonth : undefined} />

      {canDrillDown && <DrillDownDialog drillDown={drillDown} onClose={() => setDrillDown(null)} />}
    </div>
  );
}
