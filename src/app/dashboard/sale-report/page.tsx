import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSalesReps } from "@/lib/data/reference";
import { getAllSaleReports, getSignedImageUrls } from "@/lib/data/sale-reports";
import { SaleReportTable } from "./sale-report-table";

export default async function SaleReportPage() {
  const [reports, salesReps] = await Promise.all([getAllSaleReports(), getSalesReps()]);
  const imageUrls = await getSignedImageUrls(reports.flatMap((r) => r.image_paths));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Sale Report</h1>
          <p className="text-sm text-muted-foreground">
            ภาพรวมการเข้าพบลูกค้าทั้งหมด — ข้อมูลนี้ใช้คำนวณกราฟ Pipeline บน Sales Dashboard
          </p>
        </div>
        <Button nativeButton={false} render={<a href="/dashboard/sale-report/new" />}>
          <Plus className="h-4 w-4" />
          เพิ่ม Sale Report
        </Button>
      </div>

      <SaleReportTable reports={reports} salesReps={salesReps} imageUrls={imageUrls} />
    </div>
  );
}
