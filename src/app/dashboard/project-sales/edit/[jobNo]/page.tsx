import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomers, getProductCategories, getSalesReps } from "@/lib/data/reference";
import { getProjectByJobNo } from "@/lib/data/project-sales";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeCosts } from "@/lib/permissions";
import { ProjectSaleForm } from "../../project-sale-form";
import { DangerZone } from "../../danger-zone";

export default async function EditProjectSalePage({
  params,
}: {
  params: Promise<{ jobNo: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/project-sales")) redirect("/dashboard/sales");

  const { jobNo } = await params;
  const decodedJobNo = decodeURIComponent(jobNo);

  const [salesReps, customers, categories, detail] = await Promise.all([
    getSalesReps(),
    getCustomers(),
    getProductCategories(),
    getProjectByJobNo(decodedJobNo),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขงานขาย: {decodedJobNo}</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/project-sales" className="underline underline-offset-2">
            ← กลับไปหน้า WALLPOD Project Sales
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{detail ? "แก้ไขข้อมูลงานขาย" : "ไม่พบข้อมูล"}</CardTitle>
        </CardHeader>
        <CardContent>
          {detail ? (
            <ProjectSaleForm
              salesReps={salesReps}
              customers={customers}
              categories={categories.map((c) => c.name)}
              mode="edit"
              projectId={detail.id}
              initialData={detail.initialData}
              canSeeCosts={canSeeCosts(profile.role)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              ไม่พบ JOB NO. &quot;{decodedJobNo}&quot; ในระบบ กรุณาตรวจสอบเลข JOB NO. อีกครั้ง
            </p>
          )}
        </CardContent>
      </Card>

      {detail && (
        <DangerZone projectId={detail.id} jobNo={decodedJobNo} isCancelled={detail.isCancelled} />
      )}
    </div>
  );
}
