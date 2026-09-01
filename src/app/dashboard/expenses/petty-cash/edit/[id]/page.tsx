import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/profile";
import { getPettyCashTransactionById, getRecentPettyCashDescriptions, getRecentPettyCashBillers } from "@/lib/data/petty-cash";
import { getDistinctProjectJobNos } from "@/lib/data/reference";
import { canAccessPage } from "@/lib/permissions";
import { PettyCashForm } from "../../petty-cash-form";

export default async function EditPettyCashPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/petty-cash")) redirect("/dashboard/sales");
  if (!["owner", "manager", "account"].includes(profile.role)) redirect("/dashboard/expenses/petty-cash");

  const [transaction, recentDescriptions, recentBillers, jobNoSuggestions] = await Promise.all([
    getPettyCashTransactionById(id),
    getRecentPettyCashDescriptions(),
    getRecentPettyCashBillers(),
    getDistinctProjectJobNos(),
  ]);

  if (!transaction) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">แก้ไขรายการเงินสดย่อย</h1>
        <p className="text-muted-foreground">ไม่พบรายการนี้ในระบบ</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">แก้ไขรายการเงินสดย่อย: {transaction.docNo}</h1>
        <p className="text-sm text-muted-foreground">
          การแก้ไขจะคำนวณยอดคงเหลือของทุกรายการหลังจากนี้ใหม่ทั้งหมดโดยอัตโนมัติ
        </p>
      </div>

      <PettyCashForm
        mode="edit"
        transactionId={transaction.id}
        initialData={transaction}
        recentDescriptions={recentDescriptions}
        recentBillers={recentBillers}
        jobNoSuggestions={jobNoSuggestions}
      />
    </div>
  );
}
