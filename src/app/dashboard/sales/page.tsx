import { Briefcase, CalendarCheck2, CircleDollarSign, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  CustomerTypeChart,
  MonthlySalesChart,
  PipelineByStageChart,
  SalesRepPerformanceChart,
} from "@/components/dashboard/sales-charts";
import { getSalesDashboardData } from "@/lib/data/sales";
import { formatTHB } from "@/lib/format";

export default async function SalesDashboardPage() {
  const data = await getSalesDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sales Dashboard</h1>
        <p className="text-sm text-muted-foreground">ภาพรวมยอดขายและ pipeline</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="มูลค่ารวม (Pipeline)" value={formatTHB(data.totalPipelineValue)} icon={CircleDollarSign} />
        <KpiCard label="จำนวนงานที่เปิดอยู่" value={`${data.openProjectsCount} งาน`} icon={Briefcase} />
        <KpiCard label="เช็คอินวันนี้" value={`${data.todayVisitsCount} นัดหมาย`} icon={CalendarCheck2} />
        <KpiCard label="ยอดปิดการขายเดือนนี้" value={formatTHB(data.closedThisMonthValue)} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PipelineByStageChart data={data.pipelineByStage} />
        <CustomerTypeChart data={data.customerTypeBreakdown} />
      </div>

      <SalesRepPerformanceChart data={data.salesRepPerformance} />
      <MonthlySalesChart data={data.monthlySales} />
    </div>
  );
}
