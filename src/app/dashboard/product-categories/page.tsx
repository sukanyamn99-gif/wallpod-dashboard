import { getProductCategories } from "@/lib/data/reference";
import { getCurrentProfile } from "@/lib/data/profile";
import { getStockProducts } from "@/lib/data/stock";
import { CategoriesTable } from "./categories-table";

export default async function ProductCategoriesPage() {
  const [categories, profile, products] = await Promise.all([
    getProductCategories(),
    getCurrentProfile(),
    getStockProducts(),
  ]);
  const currentProfile = profile ?? { id: "", full_name: "", role: "sales" as const, sales_rep_id: null, department: null, active: true };
  const canManage = currentProfile.role === "owner" || currentProfile.role === "manager";

  const summary: Record<string, { count: number; quantity: number }> = {};
  for (const p of products) {
    if (!p.category) continue;
    const entry = summary[p.category] ?? { count: 0, quantity: 0 };
    entry.count += 1;
    entry.quantity += p.quantityOnHand;
    summary[p.category] = entry;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">หมวดหมู่สินค้า</h1>
        <p className="text-sm text-muted-foreground">
          จัดการรายการหมวดหมู่สินค้าที่ใช้ในสต็อกและงานขาย
        </p>
      </div>

      <CategoriesTable categories={categories} canManage={canManage} summary={summary} />
    </div>
  );
}
