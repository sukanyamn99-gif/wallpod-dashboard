import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getProductionOrderById } from "@/lib/data/quotations";
import { ProductionOrderForm } from "./production-order-form";

export default async function ProductionOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations/production-orders")) redirect("/dashboard/sales");

  const order = await getProductionOrderById(id);

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

      {order && <ProductionOrderForm order={order} />}
    </div>
  );
}
