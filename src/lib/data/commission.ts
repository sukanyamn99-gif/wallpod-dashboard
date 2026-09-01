import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getFullProjectReport } from "@/lib/data/project-sales";
import type { CommissionBrokerTotal, CommissionRateTier, CommissionableProject } from "@/lib/types";

export async function getCommissionRateTiers(): Promise<CommissionRateTier[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_rate_tiers")
    .select("id, discount_percent, commission_rate_percent")
    .order("discount_percent", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    discountPercent: Number(row.discount_percent),
    commissionRatePercent: Number(row.commission_rate_percent),
  }));
}

type CommissionEntryRow = {
  project_id: string;
  discount_percent: number;
  commission_rate_percent: number;
  commission_amount: number;
};

// Every fully-collected job ("เก็บเงินเรียบร้อยแล้ว") — job_no, customer,
// sales rep, amount, invoice/receipt no, and received date are all read
// live from getFullProjectReport() (which already embeds projects/payments
// in one round trip) rather than duplicated into commission_entries; only
// discount_percent (and what it computes) is a real, separately-saved
// value. A job counts once its LATEST installment's received date lands —
// that's the date the whole deal is actually considered "closed and paid".
export async function getCommissionableProjects(): Promise<CommissionableProject[]> {
  if (!isSupabaseConfigured()) return [];

  const [{ rows }, existingRes] = await Promise.all([
    getFullProjectReport(),
    (async () => {
      const supabase = await createClient();
      return supabase
        .from("commission_entries")
        .select("project_id, discount_percent, commission_rate_percent, commission_amount");
    })(),
  ]);
  if (existingRes.error) throw existingRes.error;
  const existingByProject = new Map<string, CommissionEntryRow>(
    (existingRes.data ?? []).map((row: CommissionEntryRow) => [row.project_id, row]),
  );

  const results: CommissionableProject[] = [];
  for (const row of rows) {
    if (row.isCancelled || row.status !== "เก็บเงินเรียบร้อย") continue;

    const receivedDates = [row.receivedDate1, row.receivedDate2, row.receivedDate3].filter(
      (d): d is string => !!d,
    );
    if (receivedDates.length === 0) continue; // "collected" status but no received date on file — honest gap, skip
    const latestReceivedDate = receivedDates.reduce((a, b) => (a > b ? a : b));

    const existing = existingByProject.get(row.id);
    results.push({
      projectId: row.id,
      jobNo: row.jobNo,
      projectName: row.projectName,
      customerName: row.customerName,
      salesRepName: row.salesRepName,
      projectDate: row.projectDate,
      preVat: row.preVat,
      total: row.total,
      invoiceNo: row.invoiceNo1 ?? row.invoiceNo2 ?? row.invoiceNo3,
      receiptNo: row.receiptNo1 ?? row.receiptNo2 ?? row.receiptNo3,
      receivedDate: latestReceivedDate,
      discountPercent: existing ? Number(existing.discount_percent) : 0,
      commissionRatePercent: existing ? Number(existing.commission_rate_percent) : 0,
      commissionAmount: existing ? Number(existing.commission_amount) : 0,
      hasCommissionEntry: !!existing,
    });
  }

  return results.sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
}

export async function getCommissionForReport(dateFrom: string, dateTo: string): Promise<CommissionableProject[]> {
  const all = await getCommissionableProjects();
  return all.filter((p) => p.hasCommissionEntry && p.receivedDate >= dateFrom && p.receivedDate <= dateTo);
}

export function summarizeByBroker(projects: CommissionableProject[]): CommissionBrokerTotal[] {
  const totals = new Map<string, { totalCommission: number; entryCount: number }>();
  for (const p of projects) {
    const existing = totals.get(p.salesRepName) ?? { totalCommission: 0, entryCount: 0 };
    existing.totalCommission += p.commissionAmount;
    existing.entryCount += 1;
    totals.set(p.salesRepName, existing);
  }
  return Array.from(totals.entries())
    .map(([brokerName, v]) => ({ brokerName, ...v }))
    .sort((a, b) => b.totalCommission - a.totalCommission);
}
