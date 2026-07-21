import { getProductCategories } from "@/lib/data/reference";
import { getCurrentProfile } from "@/lib/data/profile";
import { CategoriesTable } from "./categories-table";

export default async function ProductCategoriesPage() {
  const [categories, profile] = await Promise.all([getProductCategories(), getCurrentProfile()]);
  const currentProfile = profile ?? { id: "", full_name: "", role: "sales" as const, sales_rep_id: null };
  const canManage = currentProfile.role === "owner" || currentProfile.role === "manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">หมวดหมู่สินค้า</h1>
        <p className="text-sm text-muted-foreground">
          จัดการรายการหมวดหมู่สินค้าที่ใช้ในสต็อกและงานขาย
        </p>
      </div>

      <CategoriesTable categories={categories} canManage={canManage} />
    </div>
  );
}
