"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Receipt, Wallet } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MultiSelectFilter } from "@/components/dashboard/multi-select-filter";
import { MonthlyExpenseTrendChart, ExpenseCategoryChart } from "@/components/dashboard/expenses-charts";
import { formatTHB } from "@/lib/format";
import type { PaymentVoucher, PettyCashTransaction } from "@/lib/types";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const MONTHS_TO_SHOW = 8;

function monthKeyOf(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(key: string) {
  const [, month] = key.split("-").map(Number);
  return THAI_MONTHS[month - 1];
}

export function ExpensesDashboardView({
  vouchers,
  pettyCashTransactions,
}: {
  vouchers: Omit<PaymentVoucher, "ledgerLines">[];
  pettyCashTransactions: PettyCashTransaction[];
}) {
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());

  const pettyCashExpenses = useMemo(
    () => pettyCashTransactions.filter((t) => t.transactionType === "expense"),
    [pettyCashTransactions],
  );

  const monthOptions = useMemo(() => {
    const keys = new Set([
      ...vouchers.map((v) => monthKeyOf(v.voucherDate)),
      ...pettyCashExpenses.map((t) => monthKeyOf(t.transactionDate)),
    ]);
    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ value: key, label: monthLabelOf(key) }));
  }, [vouchers, pettyCashExpenses]);

  const filteredVouchers = useMemo(() => {
    if (selectedMonths.size === 0) return vouchers;
    return vouchers.filter((v) => selectedMonths.has(monthKeyOf(v.voucherDate)));
  }, [vouchers, selectedMonths]);

  const filteredPettyCash = useMemo(() => {
    if (selectedMonths.size === 0) return pettyCashExpenses;
    return pettyCashExpenses.filter((t) => selectedMonths.has(monthKeyOf(t.transactionDate)));
  }, [pettyCashExpenses, selectedMonths]);

  const voucherTotal = filteredVouchers.reduce((sum, v) => sum + v.amount, 0);
  const pettyCashTotal = filteredPettyCash.reduce((sum, t) => sum + t.amount, 0);
  const grandTotal = voucherTotal + pettyCashTotal;
  const totalCount = filteredVouchers.length + filteredPettyCash.length;

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonthTotal =
    vouchers.filter((v) => monthKeyOf(v.voucherDate) === thisMonthKey).reduce((sum, v) => sum + v.amount, 0) +
    pettyCashExpenses.filter((t) => monthKeyOf(t.transactionDate) === thisMonthKey).reduce((sum, t) => sum + t.amount, 0);

  const monthlyTrend = useMemo(() => {
    const months = Array.from({ length: MONTHS_TO_SHOW }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_TO_SHOW - 1 - i), 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, month: d.getMonth() };
    });
    return months.map(({ key, month }) => {
      const voucherSum = vouchers
        .filter((v) => monthKeyOf(v.voucherDate) === key)
        .reduce((sum, v) => sum + v.amount, 0);
      const pettyCashSum = pettyCashExpenses
        .filter((t) => monthKeyOf(t.transactionDate) === key)
        .reduce((sum, t) => sum + t.amount, 0);
      return { monthLabel: THAI_MONTHS_SHORT[month], value: voucherSum + pettyCashSum };
    });
  }, [vouchers, pettyCashExpenses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Combines both sources into one breakdown — a category like "ค่าโทรศัพท์"
  // might get paid sometimes via Payment Voucher and sometimes out of petty
  // cash, so splitting them into two separate charts would understate each.
  const categoryBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const v of filteredVouchers) {
      const key = v.category ?? "ไม่ระบุหมวดหมู่";
      byCategory.set(key, (byCategory.get(key) ?? 0) + v.amount);
    }
    for (const t of filteredPettyCash) {
      const key = t.category ?? "ไม่ระบุหมวดหมู่";
      byCategory.set(key, (byCategory.get(key) ?? 0) + t.amount);
    }
    return Array.from(byCategory.entries()).map(([category, value]) => ({ category, value }));
  }, [filteredVouchers, filteredPettyCash]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard ค่าใช้จ่าย</h1>
          <p className="text-sm text-muted-foreground">สรุปค่าใช้จ่ายจาก Payment Voucher และเงินสดย่อย</p>
        </div>
        <MultiSelectFilter
          allLabel="ทุกเดือน"
          countLabel="เดือน"
          options={monthOptions}
          selected={selectedMonths}
          onChange={setSelectedMonths}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="ยอดรวมเดือนนี้" value={formatTHB(thisMonthTotal)} icon={CircleDollarSign} tone="blue" />
        <KpiCard label="ยอดรวม (ตามที่เลือก)" value={formatTHB(grandTotal)} icon={Receipt} tone="rose" />
        <KpiCard label="Payment Voucher (ตามที่เลือก)" value={formatTHB(voucherTotal)} icon={Receipt} tone="amber" />
        <KpiCard label="เงินสดย่อยที่ใช้ (ตามที่เลือก)" value={formatTHB(pettyCashTotal)} icon={Wallet} tone="green" />
      </div>
      <p className="text-sm text-muted-foreground">{totalCount} รายการ (ตามที่เลือก)</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyExpenseTrendChart data={monthlyTrend} />
        <ExpenseCategoryChart data={categoryBreakdown} />
      </div>
    </div>
  );
}
