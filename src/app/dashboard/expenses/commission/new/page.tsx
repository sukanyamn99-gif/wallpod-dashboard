import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getCommissionRateTiers } from "@/lib/data/commission";
import { CommissionEntryForm } from "../commission-entry-form";

export default async function NewCommissionEntryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/commission")) redirect("/dashboard/sales");

  const tiers = await getCommissionRateTiers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">เพิ่มรายการค่าคอมมิชชั่น</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/expenses/commission" className="underline underline-offset-2">
            ← กลับไปหน้าคำนวณค่าคอมมิชชั่น
          </Link>
        </p>
      </div>

      <CommissionEntryForm tiers={tiers} mode="create" />
    </div>
  );
}
