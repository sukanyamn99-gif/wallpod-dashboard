import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSalesReps } from "@/lib/data/reference";
import { SaleReportForm } from "../sale-report-form";

export default async function NewSaleReportPage() {
  const salesReps = await getSalesReps();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">บันทึก Sale Report ใหม่</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกการเข้าพบลูกค้าและความคืบหน้าของดีล — ข้อมูลนี้ใช้คำนวณกราฟ Pipeline บน Sales Dashboard
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>บันทึกใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <SaleReportForm salesReps={salesReps} />
        </CardContent>
      </Card>
    </div>
  );
}
