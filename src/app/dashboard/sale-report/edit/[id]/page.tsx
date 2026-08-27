import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSalesReps } from "@/lib/data/reference";
import { getSaleReportById, getSignedImageUrls } from "@/lib/data/sale-reports";
import { SaleReportForm } from "../../sale-report-form";

export default async function EditSaleReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [loginSalesReps, report] = await Promise.all([
    getSalesReps({ requireLogin: true }),
    getSaleReportById(id),
  ]);
  const imageUrls = report ? await getSignedImageUrls(report.image_paths) : {};
  // The report's own rep might not have a login (e.g. an owner logged this
  // visit on their behalf) — keep them selectable here so editing never
  // silently loses/changes who the report is attributed to.
  const salesReps =
    report && !loginSalesReps.some((r) => r.id === report.sales_rep_id)
      ? [...loginSalesReps, { id: report.sales_rep_id, name: report.sales_rep_name, active: true }]
      : loginSalesReps;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไข Sale Report</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/sale-report" className="underline underline-offset-2">
            ← กลับไปหน้า Sale Report
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{report ? "แก้ไขข้อมูล" : "ไม่พบข้อมูล"}</CardTitle>
        </CardHeader>
        <CardContent>
          {report ? (
            <SaleReportForm
              salesReps={salesReps}
              mode="edit"
              leadId={report.id}
              initialData={{
                salesRepId: report.sales_rep_id,
                customerName: report.customer_name,
                contactName: report.contact_name ?? "",
                phone: report.phone ?? "",
                projectName: report.project_name ?? "",
                customerType: report.customer_type,
                projectType: report.project_type,
                stage: report.stage,
                estValue: String(report.est_value),
                locationText: report.location_text ?? "",
                nextAction: report.next_action ?? "",
                note: report.note ?? "",
                images: report.image_paths
                  .map((path) => ({ path, url: imageUrls[path] ?? "" }))
                  .filter((img) => img.url),
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">ไม่พบรายการนี้ในระบบ</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
