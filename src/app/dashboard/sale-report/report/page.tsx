import { getAllSaleReports, getSignedImageUrls } from "@/lib/data/sale-reports";
import { getSalesReps } from "@/lib/data/reference";
import { SaleReportTable } from "./sale-report-table";

export default async function SaleReportSummaryPage() {
  const [reports, salesReps] = await Promise.all([getAllSaleReports(), getSalesReps()]);
  const imageUrls = await getSignedImageUrls(reports.flatMap((r) => r.image_paths));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รายงานสรุป Sale Report</h1>
        <p className="text-sm text-muted-foreground">
          ภาพรวมการเข้าพบลูกค้าทั้งหมด — เลือกดูของแต่ละเซลล์ได้
        </p>
      </div>
      <SaleReportTable reports={reports} salesReps={salesReps} imageUrls={imageUrls} />
    </div>
  );
}
