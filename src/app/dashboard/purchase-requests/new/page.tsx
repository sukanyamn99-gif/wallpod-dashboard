import { redirect } from "next/navigation";
import Link from "next/link";
import { getDepartments } from "@/lib/data/reference";
import { getStockProducts } from "@/lib/data/stock";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PurchaseRequestForm } from "../purchase-request-form";

export default async function NewPurchaseRequestPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/purchase-requests")) redirect("/dashboard/sales");

  const [departments, stockProducts] = await Promise.all([getDepartments(), getStockProducts()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบขอซื้อใหม่</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/purchase-requests" className="underline underline-offset-2">
            ← กลับไปหน้าใบขอซื้อ
          </Link>
        </p>
      </div>

      <PurchaseRequestForm departments={departments} stockProducts={stockProducts} />
    </div>
  );
}
