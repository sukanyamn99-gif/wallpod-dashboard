import { redirect } from "next/navigation";
import { getPettyCashTransactions } from "@/lib/data/petty-cash";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintPettyCashView } from "./print-petty-cash-view";

export default async function PrintPettyCashPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/petty-cash")) redirect("/dashboard/sales");

  const all = await getPettyCashTransactions(); // newest first
  const chronological = [...all].reverse(); // oldest first, needed for "starting balance"

  const rangeRows = chronological.filter((t) => {
    if (t.transactionType !== "expense") return false;
    if (from && t.transactionDate < from) return false;
    if (to && t.transactionDate > to) return false;
    return true;
  });

  // The starting float shown top-left of the sheet is the running balance
  // as of right before the range began — the last transaction (any type)
  // dated earlier than `from`. No `from` given means "since the beginning",
  // so the float starts at 0.
  let startingBalance = 0;
  if (from) {
    const before = chronological.filter((t) => t.transactionDate < from);
    startingBalance = before.length > 0 ? before[before.length - 1].balanceAfter : 0;
  }

  const fromLabel = from ? new Date(from).toLocaleDateString("th-TH") : "เริ่มต้น";
  const toLabel = to ? new Date(to).toLocaleDateString("th-TH") : "ปัจจุบัน";

  return (
    <PrintPettyCashView
      rows={rangeRows}
      startingBalance={startingBalance}
      fromLabel={fromLabel}
      toLabel={toLabel}
      preparerName={profile.full_name}
    />
  );
}
