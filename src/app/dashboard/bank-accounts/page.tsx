import { redirect } from "next/navigation";
import { getBankAccounts, getBankTransactions } from "@/lib/data/bank-accounts";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { BankAccountCards } from "./bank-account-cards";
import { BankTransactionsTable } from "./bank-transactions-table";

export default async function BankAccountsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/bank-accounts")) redirect("/dashboard/sales");

  const [accounts, transactions] = await Promise.all([getBankAccounts(), getBankTransactions()]);
  const canManage = profile.role === "owner" || profile.role === "manager" || profile.role === "account";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">บัญชีธนาคาร</h1>
        <p className="text-sm text-muted-foreground">ยอดคงเหลือบัญชีธนาคารของบริษัท เทียบกับยอดที่คำนวณจากรายการในระบบ</p>
      </div>

      <BankAccountCards accounts={accounts} canManage={canManage} />

      <BankTransactionsTable accounts={accounts} transactions={transactions} />
    </div>
  );
}
