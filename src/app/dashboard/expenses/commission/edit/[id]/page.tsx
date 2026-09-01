import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { getCommissionEntryById, getCommissionRateTiers } from "@/lib/data/commission";
import { CommissionEntryForm } from "../../commission-entry-form";

export default async function EditCommissionEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/commission")) redirect("/dashboard/sales");

  const [entry, tiers] = await Promise.all([getCommissionEntryById(id), getCommissionRateTiers()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขรายการค่าคอมมิชชั่น</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/expenses/commission" className="underline underline-offset-2">
            ← กลับไปหน้าคำนวณค่าคอมมิชชั่น
          </Link>
        </p>
      </div>

      {entry ? (
        <CommissionEntryForm tiers={tiers} mode="edit" entryId={entry.id} initialData={entry} />
      ) : (
        <p className="text-sm text-muted-foreground">ไม่พบรายการนี้ในระบบ</p>
      )}
    </div>
  );
}
