import { redirect } from "next/navigation";
import { getFinishedGoods } from "@/lib/data/finished-goods";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getDistinctProjectJobNos } from "@/lib/data/reference";
import { FinishedGoodsTable } from "./finished-goods-table";

export default async function FinishedGoodsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/finished-goods")) redirect("/dashboard/sales");

  const [products, jobNoSuggestions] = await Promise.all([getFinishedGoods(), getDistinctProjectJobNos()]);
  const canManage = profile.role === "owner" || profile.role === "manager" || profile.role === "support_sale" || profile.role === "account";
  const canReceive = canManage || profile.role === "production";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">สินค้าสำเร็จรูป</h1>
        <p className="text-sm text-muted-foreground">
          แยกต่างหากจากสต๊อกวัตถุดิบ — รับเข้าจากงานที่ผลิตเสร็จ ตัดออกอัตโนมัติเมื่อออกใบกำกับภาษี
        </p>
      </div>
      <FinishedGoodsTable products={products} canManage={canManage} canReceive={canReceive} jobNoSuggestions={jobNoSuggestions} />
    </div>
  );
}
