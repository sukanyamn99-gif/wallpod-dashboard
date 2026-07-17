import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSalesReps } from "@/lib/data/reference";
import { getTodaySaleReports } from "@/lib/data/sale-reports";
import { formatTHB } from "@/lib/format";
import { SaleReportForm } from "./sale-report-form";

export default async function SaleReportPage() {
  const [salesReps, todayReports] = await Promise.all([getSalesReps(), getTodaySaleReports()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sale Report</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกการเข้าพบลูกค้าและความคืบหน้าของดีล — ข้อมูลนี้ใช้คำนวณกราฟ Pipeline บน Sales Dashboard
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>บันทึกใหม่</CardTitle>
          </CardHeader>
          <CardContent>
            <SaleReportForm salesReps={salesReps} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>รายการวันนี้ ({todayReports.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayReports.length === 0 && (
              <p className="text-sm text-muted-foreground">ยังไม่มีบันทึกวันนี้</p>
            )}
            {todayReports.map((r) => (
              <div key={r.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{r.sales_rep_name}</p>
                  <Badge variant="secondary">{r.stage}</Badge>
                </div>
                <p className="text-muted-foreground">
                  {r.customer_name}
                  {r.project_name ? ` — ${r.project_name}` : ""}
                </p>
                <p className="text-muted-foreground">มูลค่าโดยประมาณ: {formatTHB(r.est_value)}</p>
                {r.location_text && (
                  <a
                    href={r.location_text}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    ดูตำแหน่ง
                  </a>
                )}
                {r.next_action && <p className="text-muted-foreground">Next: {r.next_action}</p>}
                {r.note && <p className="text-muted-foreground">{r.note}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
