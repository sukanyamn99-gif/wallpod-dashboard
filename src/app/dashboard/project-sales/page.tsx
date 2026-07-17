import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomers, getSalesReps } from "@/lib/data/reference";
import { ProjectSaleForm } from "./project-sale-form";

export default async function ProjectSalesPage() {
  const [salesReps, customers] = await Promise.all([getSalesReps(), getCustomers()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">WALLPOD Project Sales</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกงานขายที่ปิดแล้ว/ออกใบแจ้งหนี้แล้ว — ข้อมูลนี้เชื่อมกับ Sales Dashboard โดยตรง
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>บันทึกงานขายใหม่</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectSaleForm salesReps={salesReps} customers={customers} />
        </CardContent>
      </Card>
    </div>
  );
}
