import { redirect } from "next/navigation";
import { getWhtCertificates } from "@/lib/data/wht-certificates";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { WhtCertificatesTable } from "./wht-certificates-table";

export default async function WhtCertificatesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/wht-certificates")) redirect("/dashboard/sales");

  // A ใบหัก ณ ที่จ่าย only exists where a transaction actually withheld tax
  // — this menu is a filtered, merged view over Payment Voucher and Petty
  // Cash, not a separate record; edit the underlying transaction to fix
  // any field shown here.
  const rows = await getWhtCertificates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ใบหัก ณ ที่จ่าย</h1>
        <p className="text-sm text-muted-foreground">
          รายการที่มีการหักภาษี ณ ที่จ่าย จาก Payment Voucher และเงินสดย่อย — แก้ไขข้อมูลได้ที่หน้าต้นทาง
        </p>
      </div>

      <WhtCertificatesTable rows={rows} />
    </div>
  );
}
