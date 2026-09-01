import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { CommissionBrokerTotal, CommissionEntry, CommissionRateTier } from "@/lib/types";

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

const ENTRY_COLUMNS =
  "id, entry_date, job_no, project_title, project_name, broker_name, amount, amount_incl_vat, " +
  "discount_percent, commission_rate_percent, commission_amount, installment_label, paid_amount, " +
  "invoice_no, receipt_no, received_date, note, created_at";

type EntryRow = {
  id: string;
  entry_date: string;
  job_no: string | null;
  project_title: string;
  project_name: string | null;
  broker_name: string;
  amount: number;
  amount_incl_vat: number;
  discount_percent: number;
  commission_rate_percent: number;
  commission_amount: number;
  installment_label: string | null;
  paid_amount: number | null;
  invoice_no: string | null;
  receipt_no: string | null;
  received_date: string | null;
  note: string | null;
  created_at: string;
};

function mapEntry(row: EntryRow): CommissionEntry {
  return {
    id: row.id,
    entryDate: row.entry_date,
    jobNo: row.job_no,
    projectTitle: row.project_title,
    projectName: row.project_name,
    brokerName: row.broker_name,
    amount: Number(row.amount),
    amountInclVat: Number(row.amount_incl_vat),
    discountPercent: Number(row.discount_percent),
    commissionRatePercent: Number(row.commission_rate_percent),
    commissionAmount: Number(row.commission_amount),
    installmentLabel: row.installment_label,
    paidAmount: row.paid_amount != null ? Number(row.paid_amount) : null,
    invoiceNo: row.invoice_no,
    receiptNo: row.receipt_no,
    receivedDate: row.received_date,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function getCommissionEntries(): Promise<CommissionEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_entries")
    .select(ENTRY_COLUMNS)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  // @ts-expect-error -- Supabase types the plain concatenated select string loosely here
  return (data ?? []).map(mapEntry);
}

export async function getCommissionEntryById(id: string): Promise<CommissionEntry | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("commission_entries").select(ENTRY_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  // @ts-expect-error -- Supabase types the plain concatenated select string loosely here
  return data ? mapEntry(data) : null;
}

export async function getDistinctBrokerNames(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("commission_entries").select("broker_name");
  if (error) throw error;
  const names = new Set((data ?? []).map((row) => row.broker_name).filter((n) => n.trim().length > 0));
  return Array.from(names).sort();
}

// Commission is only paid once the customer's payment has actually cleared
// — payouts run on the 15th of every month, covering every entry whose
// วันที่รับชำระ (received_date) falls in the window (15th of the PREVIOUS
// month, 15th of this month]. An entry with no received_date yet (customer
// hasn't paid) is never eligible for any payout window until it gets one.
export function getCommissionPayoutWindow(payDate: string): { windowStart: string; windowEnd: string } {
  const [y, m, d] = payDate.split("-").map(Number);
  const prevMonth = new Date(Date.UTC(y, m - 2, d));
  const windowStart = prevMonth.toISOString().slice(0, 10);
  return { windowStart, windowEnd: payDate };
}

// Entries whose received_date falls within [dateFrom, dateTo] (inclusive),
// for the print report — the itemized table shows only `brokerName`'s rows,
// but the summary section at the bottom shows every broker's total for the
// same window (matching the reference doc, which lists one broker's line
// items alongside a payout summary for all brokers active that period).
export async function getCommissionEntriesForReport(
  dateFrom: string,
  dateTo: string,
): Promise<CommissionEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_entries")
    .select(ENTRY_COLUMNS)
    .not("received_date", "is", null)
    .gte("received_date", dateFrom)
    .lte("received_date", dateTo)
    .order("received_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  // @ts-expect-error -- Supabase types the plain concatenated select string loosely here
  return (data ?? []).map(mapEntry);
}

export function summarizeByBroker(entries: CommissionEntry[]): CommissionBrokerTotal[] {
  const totals = new Map<string, { totalCommission: number; entryCount: number }>();
  for (const entry of entries) {
    const existing = totals.get(entry.brokerName) ?? { totalCommission: 0, entryCount: 0 };
    existing.totalCommission += entry.commissionAmount;
    existing.entryCount += 1;
    totals.set(entry.brokerName, existing);
  }
  return Array.from(totals.entries())
    .map(([brokerName, v]) => ({ brokerName, ...v }))
    .sort((a, b) => b.totalCommission - a.totalCommission);
}
