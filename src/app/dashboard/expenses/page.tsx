import { redirect } from "next/navigation";
import { getPaymentVouchers } from "@/lib/data/payment-vouchers";
import { getPettyCashTransactions } from "@/lib/data/petty-cash";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { ExpensesDashboardView } from "./expenses-dashboard-view";

export default async function ExpensesDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses")) redirect("/dashboard/sales");

  const [vouchers, pettyCashTransactions] = await Promise.all([getPaymentVouchers(), getPettyCashTransactions()]);

  return <ExpensesDashboardView vouchers={vouchers} pettyCashTransactions={pettyCashTransactions} />;
}
