import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getQuotations } from "@/lib/data/quotations";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { QuotationsTable } from "./quotations-table";

export default async function QuotationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/quotations")) redirect("/dashboard/sales");

  const quotations = await getQuotations();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ใบเสนอราคา</h1>
          <p className="text-sm text-muted-foreground">รายการใบเสนอราคาทั้งหมด — เมื่อลูกค้าตอบตกลง สามารถแปลงเป็น Project Sales ได้</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/quotations/new" />}>
          + สร้างใบเสนอราคา
        </Button>
      </div>

      <QuotationsTable quotations={quotations} />
    </div>
  );
}
