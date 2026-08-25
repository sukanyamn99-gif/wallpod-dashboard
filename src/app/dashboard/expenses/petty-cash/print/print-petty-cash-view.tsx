"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
import type { PettyCashTransaction } from "@/lib/types";

const FIXED_COLUMN_ORDER = ["ค่าจ้าง-ค่าบริการ", "อุปกรณ์สำนักงาน", "ค่าโทรศัพท์", "ค่าขนส่งสินค้า", "ค่าไปรษณีย์"];
const OTHER_CATEGORY = "อื่นๆ";
const MIN_ROWS = 10;

export function PrintPettyCashView({
  rows,
  startingBalance,
  fromLabel,
  toLabel,
  preparerName,
}: {
  rows: PettyCashTransaction[];
  startingBalance: number;
  fromLabel: string;
  toLabel: string;
  preparerName: string;
}) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  // Known category columns first (matches the paper form's fixed layout),
  // then any category the business has started using that isn't in that
  // fixed set yet, so a new category never silently disappears from the total.
  const extraCategories = Array.from(
    new Set(rows.map((r) => r.category).filter((c): c is string => !!c && !FIXED_COLUMN_ORDER.includes(c))),
  ).sort();
  const categoryColumns = [...FIXED_COLUMN_ORDER, ...extraCategories];

  const columnTotals = categoryColumns.map((cat) => rows.filter((r) => r.category === cat).reduce((s, r) => s + r.amount, 0));
  const uncategorizedTotal = rows.filter((r) => !r.category).reduce((s, r) => s + r.amount, 0);
  const vatTotal = rows.reduce((s, r) => s + r.vatAmount, 0);
  const whtTotal = rows.reduce((s, r) => s + r.whtAmount, 0);
  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);

  const displayRows = [...rows];
  while (displayRows.length < MIN_ROWS) displayRows.push(null as unknown as PettyCashTransaction);

  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button onClick={() => window.print()}>พิมพ์</Button>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-lg font-semibold">รายงานสรุปเงินสดย่อย</p>
        <p className="text-sm">
          {fromLabel} — {toLabel}
        </p>
      </div>

      <table className="w-full border-collapse border border-black text-center text-[11px]">
        <thead>
          <tr>
            <th className="border border-black p-1 whitespace-nowrap" rowSpan={2}>
              {formatTHB(startingBalance)}
            </th>
            <th className="border border-black p-1" rowSpan={2}>
              ลำดับ
            </th>
            <th className="border border-black p-1" rowSpan={2}>
              วันที่บิล
            </th>
            <th className="border border-black p-1" rowSpan={2}>
              ผู้บิล
            </th>
            <th className="border border-black p-1" rowSpan={2}>
              รายการ
            </th>
            {categoryColumns.map((cat) => (
              <th key={cat} className="border border-black p-1">
                {cat}
              </th>
            ))}
            {extraCategories.length === 0 && uncategorizedTotal > 0 && (
              <th className="border border-black p-1">{OTHER_CATEGORY}</th>
            )}
            <th className="border border-black p-1" rowSpan={2}>
              ภาษีซื้อ
            </th>
            <th className="border border-black p-1" rowSpan={2}>
              ภาษีหัก
              <br />
              ณ ที่จ่าย
            </th>
            <th className="border border-black p-1" rowSpan={2}>
              งาน/Job
            </th>
            <th className="border border-black p-1" rowSpan={2}>
              รวมสุทธิ
            </th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r, i) => {
            return (
              <tr key={r?.id ?? `blank-${i}`} className="h-6">
                <td className="border border-black p-1">{r ? formatTHB(r.balanceAfter) : ""}</td>
                <td className="border border-black p-1">{i + 1}</td>
                <td className="border border-black p-1">
                  {r ? new Date(r.transactionDate).toLocaleDateString("th-TH") : ""}
                </td>
                <td className="border border-black p-1">{r?.billerName ?? ""}</td>
                <td className="border border-black p-1 text-left">{r?.description ?? ""}</td>
                {categoryColumns.map((cat) => (
                  <td key={cat} className="border border-black p-1 text-right">
                    {r && r.category === cat ? formatTHB(r.amount) : ""}
                  </td>
                ))}
                {extraCategories.length === 0 && uncategorizedTotal > 0 && (
                  <td className="border border-black p-1 text-right">
                    {r && !r.category ? formatTHB(r.amount) : ""}
                  </td>
                )}
                <td className="border border-black p-1 text-right">{r && r.vatAmount ? formatTHB(r.vatAmount) : ""}</td>
                <td className="border border-black p-1 text-right">{r && r.whtAmount ? formatTHB(r.whtAmount) : ""}</td>
                <td className="border border-black p-1">{r?.jobNo ?? ""}</td>
                <td className="border border-black p-1 text-right">{r ? formatTHB(r.amount) : ""}</td>
              </tr>
            );
          })}
          <tr>
            <td className="border border-black p-1" colSpan={5}>
              <span className="font-semibold text-red-600">รวมทั้งสิ้น</span>
            </td>
            {columnTotals.map((total, i) => (
              <td key={categoryColumns[i]} className="border border-black p-1 text-right font-semibold text-red-600">
                {total > 0 ? formatTHB(total) : "-"}
              </td>
            ))}
            {extraCategories.length === 0 && uncategorizedTotal > 0 && (
              <td className="border border-black p-1 text-right font-semibold text-red-600">
                {formatTHB(uncategorizedTotal)}
              </td>
            )}
            <td className="border border-black p-1 text-right font-semibold text-red-600">
              {vatTotal > 0 ? formatTHB(vatTotal) : "-"}
            </td>
            <td className="border border-black p-1 text-right font-semibold text-red-600">
              {whtTotal > 0 ? formatTHB(whtTotal) : "-"}
            </td>
            <td className="border border-black p-1"></td>
            <td className="border border-black p-1 text-right font-semibold text-red-600">{formatTHB(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-10 flex justify-between px-8 text-center text-sm">
        <div>
          <p>___________________________</p>
          <p>{preparerName || " "}</p>
          <p>ผู้จัดทำ</p>
        </div>
        <div>
          <p>___________________________</p>
          <p>&nbsp;</p>
          <p>ผู้อนุมัติ</p>
        </div>
      </div>
    </div>
  );
}
