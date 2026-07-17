import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCustomers, getSalesReps } from "@/lib/data/reference";
import { ProjectSaleForm } from "./project-sale-form";
import { JobSearchBox } from "./job-search-box";

export default async function ProjectSalesPage() {
  const [salesReps, customers] = await Promise.all([getSalesReps(), getCustomers()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">WALLPOD Project Sales</h1>
          <p className="text-sm text-muted-foreground">
            บันทึกงานขายที่ปิดแล้ว/ออกใบแจ้งหนี้แล้ว — ข้อมูลนี้เชื่อมกับ Sales Dashboard โดยตรง
          </p>
        </div>
        <Button variant="outline" render={<a href="/api/export-projects" download />}>
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ค้นหางานเดิมเพื่อแก้ไข</CardTitle>
        </CardHeader>
        <CardContent>
          <JobSearchBox />
        </CardContent>
      </Card>

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
