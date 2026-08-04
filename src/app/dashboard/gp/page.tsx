import { redirect } from "next/navigation";
import { CircleDollarSign, Percent, Receipt, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GpBySalesRepChart, GpByCustomerTypeChart, MonthlyGpTrendChart } from "@/components/dashboard/gp-charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGpDashboardData } from "@/lib/data/gp";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";
import type { FullProjectRow } from "@/lib/data/project-sales";

function MarginTable({ title, rows }: { title: string; rows: FullProjectRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

export default async function GpDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/gp")) redirect("/dashboard/sales");

  const data = await getGpDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">GP Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          กำไรขั้นต้นต่องาน แยกตามกลุ่มลูกค้า/เซลล์ — คำนวณจาก {data.kpis.costedJobCount} งานที่มีข้อมูลต้นทุนบันทึกไว้
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="มูลค่ารวม (Pre-VAT)" value={formatTHB(data.kpis.totalPreVat)} icon={CircleDollarSign} />
        <KpiCard label="ต้นทุนรวม" value={formatTHB(data.kpis.totalCost)} icon={Receipt} />
        <KpiCard label="กำไรขั้นต้นรวม" value={formatTHB(data.kpis.totalProfit)} icon={TrendingUp} />
        <KpiCard
          label="อัตรากำไรขั้นต้นเฉลี่ย"
          value={`${data.kpis.avgMarginPercent.toFixed(1)}%`}
          icon={Percent}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GpBySalesRepChart data={data.bySalesRep} />
        <GpByCustomerTypeChart data={data.byCustomerType} />
      </div>

      <MonthlyGpTrendChart data={data.monthlyTrend} />

      <div className="grid gap-4 lg:grid-cols-2">
        <MarginTable title="งานที่กำไรดีที่สุด (Top 5)" rows={data.marginExtremes.top} />
        <MarginTable title="งานที่กำไรน้อยที่สุด (Bottom 5)" rows={data.marginExtremes.bottom} />
      </div>
    </div>
  );
}
