import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPettyCashTransactions } from "@/lib/data/petty-cash";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";
import { PrintPettyCashRequisitionView } from "./print-requisition-view";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ docs?: string }>;
}): Promise<Metadata> {
  const { docs } = await searchParams;
  return { title: docs ? "ใบเบิกสดย่อย" : "ใบเบิกสดย่อย (ฟอร์มเปล่า)" };
}

// ใบเบิกสดย่อย — the petty cash requisition form. With `docs` (the เลขที่เอกสาร
// ticked on the petty cash list) it comes filled in with those expenses;
// without, it is the blank form to fill in by hand.
export default async function PettyCashRequisitionPage({
  searchParams,
}: {
  searchParams: Promise<{ docs?: string; print?: string }>;
}) {
  const { docs, print } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/expenses/petty-cash")) redirect("/dashboard/sales");

  const wanted = docs ? new Set(docs.split(",").map((d) => d.trim()).filter(Boolean)) : null;
  const all = wanted ? await getPettyCashTransactions() : []; // newest first
  // Oldest first, so the lines read in the order they were spent.
  const rows = [...all]
    .reverse()
    .filter((t) => t.transactionType === "expense" && !t.isCancelled && wanted?.has(t.docNo));

  return (
    <PrintPettyCashRequisitionView
      autoPrint={print === "1"}
      lines={rows.map((t) => ({
        docNo: t.docNo,
        date: t.transactionDate,
        description: t.description,
        jobNo: t.jobNo,
        biller: t.billerName,
        amount: t.amount,
      }))}
    />
  );
}
