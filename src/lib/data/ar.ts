import { differenceInDays } from "date-fns";
import { getFullProjectReport } from "@/lib/data/project-sales";
import type { FullProjectRow } from "@/lib/data/project-sales";

const AGING_BUCKETS = [
  { label: "0-30 วัน", min: 0, max: 30 },
  { label: "31-60 วัน", min: 31, max: 60 },
  { label: "61-90 วัน", min: 61, max: 90 },
  { label: "90+ วัน", min: 91, max: Infinity },
];

export interface ReceivableRow extends FullProjectRow {
  ageDays: number;
}

export interface ArDashboardData {
  kpis: {
    totalOutstanding: number;
    receivableCount: number;
    avgAgeDays: number;
    oldestAgeDays: number;
  };
  agingBuckets: { label: string; count: number; amount: number }[];
  byStatus: { status: string; amount: number; count: number }[];
  byCustomer: { customerName: string; amount: number; count: number }[];
  list: ReceivableRow[];
}

export async function getArDashboardData(): Promise<ArDashboardData> {
  const { rows } = await getFullProjectReport();
  const now = new Date();

  // Threshold at ฿1 rather than 0: some imported jobs have a few satang of
  // "outstanding_amount" left over from splitting an odd total across two
  // installments (e.g. ฿691,123.70 ÷ 2 → ฿0.03 unaccounted for), even though
  // both installments are marked paid — that's rounding noise, not a real debt.
  const receivables: ReceivableRow[] = rows
    .filter((r) => !r.isCancelled && (r.outstanding ?? 0) >= 1)
    .map((r) => ({ ...r, ageDays: differenceInDays(now, new Date(r.projectDate)) }))
    .sort((a, b) => b.ageDays - a.ageDays);

  const totalOutstanding = receivables.reduce((sum, r) => sum + (r.outstanding ?? 0), 0);
  const receivableCount = receivables.length;
  const avgAgeDays =
    receivableCount > 0 ? receivables.reduce((sum, r) => sum + r.ageDays, 0) / receivableCount : 0;
  const oldestAgeDays = receivableCount > 0 ? Math.max(...receivables.map((r) => r.ageDays)) : 0;

  const agingBuckets = AGING_BUCKETS.map(({ label, min, max }) => {
    const inBucket = receivables.filter((r) => r.ageDays >= min && r.ageDays <= max);
    return {
      label,
      count: inBucket.length,
      amount: inBucket.reduce((sum, r) => sum + (r.outstanding ?? 0), 0),
    };
  });

  const statuses = Array.from(new Set(receivables.map((r) => r.status).filter((s): s is string => !!s)));
  const byStatus = statuses.map((status) => {
    const inStatus = receivables.filter((r) => r.status === status);
    return {
      status,
      amount: inStatus.reduce((sum, r) => sum + (r.outstanding ?? 0), 0),
      count: inStatus.length,
    };
  });

  const customerNames = Array.from(new Set(receivables.map((r) => r.customerName)));
  const byCustomer = customerNames
    .map((customerName) => {
      const inCustomer = receivables.filter((r) => r.customerName === customerName);
      return {
        customerName,
        amount: inCustomer.reduce((sum, r) => sum + (r.outstanding ?? 0), 0),
        count: inCustomer.length,
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return {
    kpis: { totalOutstanding, receivableCount, avgAgeDays, oldestAgeDays },
    agingBuckets,
    byStatus,
    byCustomer,
    list: receivables,
  };
}
