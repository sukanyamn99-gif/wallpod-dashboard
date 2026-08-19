import { redirect } from "next/navigation";
import { AlertTriangle, Briefcase, CircleDollarSign, Clock } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AgingBucketChart, ByStatusChart, TopDebtorsChart } from "@/components/dashboard/ar-charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getArDashboardData } from "@/lib/data/ar";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { formatTHB } from "@/lib/format";

export default async function ArDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/ar")) redirect("/dashboard/sales");

  const data = await getArDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AR Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          ลูกหนี้ค้างชำระ แยกตามอายุหนี้และสถานะการชำระ — นับอายุหนี้จากวันที่ของงาน (ไม่มีวันครบกำหนดชำระในระบบ)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="ลูกหนี้คงค้างรวม" value={formatTHB(data.kpis.totalOutstanding)} icon={CircleDollarSign} tone="blue" />
        <KpiCard label="จำนวนงานค้างชำระ" value={`${data.kpis.receivableCount} งาน`} icon={Briefcase} tone="violet" />
        <KpiCard label="อายุหนี้เฉลี่ย" value={`${Math.round(data.kpis.avgAgeDays)} วัน`} icon={Clock} tone="amber" />
        <KpiCard label="ลูกหนี้ค้างนานที่สุด" value={`${data.kpis.oldestAgeDays} วัน`} icon={AlertTriangle} tone="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AgingBucketChart data={data.agingBuckets} />
        <ByStatusChart data={data.byStatus} />
      </div>

      <TopDebtorsChart data={data.byCustomer} />

      <Card>
        <CardHeader>
          <CardTitle>รายการลูกหนี้ค้างชำระ (เรียงจากค้างนานสุด)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">เลข JOB</TableHead>
                  <TableHead className="whitespace-nowrap">ลูกค้า</TableHead>
                  <TableHead className="whitespace-nowrap">เซลล์</TableHead>
                  <TableHead className="whitespace-nowrap text-right">มูลค่ารวม</TableHead>
                  <TableHead className="whitespace-nowrap text-right">ค้างชำระ</TableHead>
                  <TableHead className="whitespace-nowrap text-right">อายุหนี้ (วัน)</TableHead>
                  <TableHead className="whitespace-nowrap">สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.list.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      ไม่มีลูกหนี้ค้างชำระ
                    </TableCell>
                  </TableRow>
                )}
                {data.list.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.jobNo ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.customerName}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.salesRepName}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatTHB(r.total)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatTHB(r.outstanding ?? 0)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{r.ageDays}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="secondary">{r.status ?? "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
