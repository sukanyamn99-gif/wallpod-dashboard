import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSalesReps } from "@/lib/data/reference";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import {
  getAllSaleReports,
  getSaleReportChangeLog,
  getSignedImageUrls,
} from "@/lib/data/sale-reports";
import { SaleReportTable } from "./sale-report-table";

export default async function SaleReportPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/sale-report")) redirect("/dashboard/sales");

  const [reports, salesReps, changeLog] = await Promise.all([
    getAllSaleReports(),
    getSalesReps(),
    getSaleReportChangeLog(),
  ]);
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

      <SaleReportTable
        reports={reports}
        salesReps={salesReps}
        imageUrls={imageUrls}
        changeLog={changeLog}
        currentProfile={profile}
      />
    </div>
  );
}
