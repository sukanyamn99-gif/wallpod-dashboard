import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getProductionOrderById } from "@/lib/data/quotations";
import { getProjectByJobNo } from "@/lib/data/project-sales";
import { ProductionOrderForm } from "./production-order-form";

export default async function ProductionOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations/production-orders")) redirect("/dashboard/sales");

  const order = await getProductionOrderById(id);
  // A quotation gets its job_number the instant it's accepted — long before
  // anyone necessarily records the real WALLPOD Project Sales entry for it
  // (the exact gap that let JB2609208/209's tax invoice and receipt get
  // issued with no project to sync their doc numbers into). Block entry to
  // ใบลงผลิต until that real Project row exists, per explicit feedback.
  const project = order?.jobNumber ? await getProjectByJobNo(order.jobNumber) : null;
  const needsProjectFirst = !!order && !!order.jobNumber && !project;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/quotations/production-orders" className="underline underline-offset-2">
            ← กลับไปหน้าใบลงผลิต
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">{order ? `ใบลงผลิต — ${order.docNo}` : "ไม่พบใบลงผลิตนี้"}</h1>
      </div>

      {needsProjectFirst && order && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="font-medium">ยังไม่ได้บันทึกงานนี้ใน Koonway Project Sales</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ต้องบันทึกข้อมูลงานขาย (JOB {order.jobNumber}) เข้า Koonway Project Sales ก่อน ถึงจะลงผลิตได้ —
            ป้องกันปัญหาเลขที่ใบกำกับภาษี/ใบเสร็จที่ออกไปแล้วไม่เชื่อมเข้ากับข้อมูลการชำระเงินของ Project
          </p>
          <Link
            href={`/dashboard/project-sales/new?fromQuotation=${id}`}
            className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            ไปบันทึก Project
          </Link>
        </div>
      )}

      {order && !needsProjectFirst && <ProductionOrderForm order={order} />}
    </div>
  );
}
