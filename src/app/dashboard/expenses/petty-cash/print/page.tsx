import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPettyCashTransactions } from "@/lib/data/petty-cash";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintPettyCashView } from "./print-petty-cash-view";

// See quotations/print/[id]/page.tsx's generateMetadata for why this is
// server-side, not a client-side document.title assignment.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; docs?: string }>;
}): Promise<Metadata> {
  const { from, to, docs } = await searchParams;
  if (docs) return { title: `เงินสดย่อย ${docs.split(",").filter(Boolean).length} รายการที่เลือก` };
  const fromLabel = from ? new Date(from).toLocaleDateString("th-TH") : "เริ่มต้น";
  const toLabel = to ? new Date(to).toLocaleDateString("th-TH") : "ปัจจุบัน";
  return { title: `เงินสดย่อย ${fromLabel}-${toLabel}` };
}

export default async function PrintPettyCashPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; docs?: string }>;
}) {
  const { from, to, docs } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/petty-cash")) redirect("/dashboard/sales");

  const all = await getPettyCashTransactions(); // newest first
  const chronological = [...all].reverse(); // oldest first, needed for "starting balance"

  // `docs` = specific เลขที่เอกสาร picked on the list (comma-separated): print
  // exactly those expense entries instead of a date range.
  const selectedDocNos = docs ? new Set(docs.split(",").map((d) => d.trim()).filter(Boolean)) : null;
  const rangeRows = chronological.filter((t) => {
    if (t.transactionType !== "expense") return false;
    if (selectedDocNos) return selectedDocNos.has(t.docNo);
    if (from && t.transactionDate < from) return false;
    if (to && t.transactionDate > to) return false;
    return true;
  });

  // The starting float shown top-left of the sheet is the running balance
  // as of right before the range began — the last transaction (any type)
  // dated earlier than `from`. No `from` given means "since the beginning",
  // so the float starts at 0.
  let startingBalance = 0;
  if (selectedDocNos) {
    // The running balance right before the earliest picked entry.
    const firstIndex = rangeRows.length > 0 ? chronological.findIndex((t) => t.id === rangeRows[0].id) : -1;
    startingBalance = firstIndex > 0 ? chronological[firstIndex - 1].balanceAfter : 0;
  } else if (from) {
    const before = chronological.filter((t) => t.transactionDate < from);
    startingBalance = before.length > 0 ? before[before.length - 1].balanceAfter : 0;
  }

  const fromLabel = selectedDocNos
    ? rangeRows.length > 0
      ? new Date(rangeRows[0].transactionDate).toLocaleDateString("th-TH")
      : "-"
    : from
      ? new Date(from).toLocaleDateString("th-TH")
      : "เริ่มต้น";
  const toLabel = selectedDocNos
    ? rangeRows.length > 0
      ? new Date(rangeRows[rangeRows.length - 1].transactionDate).toLocaleDateString("th-TH")
      : "-"
    : to
      ? new Date(to).toLocaleDateString("th-TH")
      : "ปัจจุบัน";

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
