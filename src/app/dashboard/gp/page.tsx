import { redirect } from "next/navigation";
import { BarChart3, CircleDollarSign, Percent, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { GpKpiCard } from "@/components/dashboard/gp-kpi-card";
import { GpPeriodSelect } from "@/components/dashboard/gp-period-select";
import {
  GpBySalesRepChart,
  GpByCustomerTypeChart,
  GpByProductChart,
  MonthlyGpTrendChart,
} from "@/components/dashboard/gp-charts";
import { GpPanel } from "@/components/dashboard/gp-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getGpDashboardData, type GpYearParam } from "@/lib/data/gp";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import type { FullProjectRow } from "@/lib/data/project-sales";

function MarginTable({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: FullProjectRow[];
}) {
  return (
    <GpPanel title={title} icon={icon}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">เลข JOB</TableHead>
                <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
                <TableHead className="whitespace-nowrap text-right">มูลค่า</TableHead>
                <TableHead className="whitespace-nowrap text-right">ต้นทุน</TableHead>
                <TableHead className="whitespace-nowrap text-right">กำไร</TableHead>
                <TableHead className="whitespace-nowrap text-right">%กำไร</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    ไม่มีข้อมูล
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.jobNo ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.customerName}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatTHB(r.preVat)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {formatTHB(r.costs?.totalCost ?? 0)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatTHB(r.profit ?? 0)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {r.preVat > 0 ? (((r.profit ?? 0) / r.preVat) * 100).toFixed(1) : "0.0"}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
    </GpPanel>
  );
}

// Buddhist-year timestamp in Thai time, e.g. 27 พ.ย. 2569 14:32 น.
function updatedAtLabel(): string {
  const text = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(new Date());
  return `${text} น.`;
}

function parseYearParam(value: string | undefined): GpYearParam {
  if (!value) return "auto";
  if (value === "all") return "all";
  const year = Number(value);
  return Number.isInteger(year) && year > 1900 && year < 2200 ? year : "auto";
}

export default async function GpDashboardPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/gp")) redirect("/dashboard/sales");

  const { year } = await searchParams;
  const data = await getGpDashboardData(parseYearParam(year));
  const { kpis, sparklines, period } = data;
  const comparedWith = period.previousLabel;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-10 w-10 text-sky-400" />
          <div>
            <h1 className="text-3xl font-semibold text-white">GP Dashboard</h1>
            <p className="text-sm text-slate-400">
              กำไรขั้นต้นและภาพรวมผลการดำเนินงาน | {period.label} — คำนวณจาก {kpis.costedJobCount} งานที่มีข้อมูลต้นทุนบันทึกไว้ | อัปเดตล่าสุด:{" "}
              {updatedAtLabel()}
            </p>
          </div>
        </div>
        <GpPeriodSelect years={data.availableYears} value={period.year} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GpKpiCard
          label="มูลค่าขาย (ก่อน VAT)"
          value={formatTHB(kpis.totalPreVat)}
          icon={CircleDollarSign}
          tone="blue"
          delta={kpis.deltas.preVat}
          comparedWith={comparedWith}
          spark={sparklines.preVat}
        />
        <GpKpiCard
          label="ต้นทุนขาย"
          value={formatTHB(kpis.totalCost)}
          icon={Receipt}
          tone="amber"
          delta={kpis.deltas.cost}
          comparedWith={comparedWith}
          upIsBad
          spark={sparklines.cost}
        />
        <GpKpiCard
          label="กำไรขั้นต้นรวม"
          value={formatTHB(kpis.totalProfit)}
          icon={TrendingUp}
          tone="green"
          delta={kpis.deltas.profit}
          comparedWith={comparedWith}
          spark={sparklines.profit}
        />
        <GpKpiCard
          label="อัตรากำไรขั้นต้นเฉลี่ย"
          value={`${kpis.avgMarginPercent.toFixed(1)}%`}
          icon={Percent}
          tone="violet"
          delta={kpis.deltas.marginPoints}
          deltaUnit="จุด"
          comparedWith={comparedWith}
          spark={sparklines.margin}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GpByProductChart data={data.byProductCategory} />
        <GpByCustomerTypeChart data={data.byCustomerType} />
      </div>

      <MonthlyGpTrendChart data={data.monthlyTrend} />

      <GpBySalesRepChart data={data.bySalesRep} list={data.list} />

      <div className="grid gap-4 xl:grid-cols-2">
        <MarginTable title="งานที่กำไรดีที่สุด (Top 10)" icon={TrendingUp} rows={data.marginExtremes.top} />
        <MarginTable title="งานที่กำไรน้อยที่สุด (Bottom 10)" icon={TrendingDown} rows={data.marginExtremes.bottom} />
      </div>
    </div>
  );
}
