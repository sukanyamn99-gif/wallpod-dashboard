"use client";

import { Fragment } from "react";
import Image from "next/image";
import { formatTHB } from "@/lib/format";
import type { CommissionableProject } from "@/lib/types";

const THAI_MONTH_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function periodLabel(windowStart: string, windowEnd: string): string {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const startLabel = THAI_MONTH_ABBR[start.getMonth()];
  const endLabel = THAI_MONTH_ABBR[end.getMonth()];
  const beYear = end.getFullYear() + 543;
  return startLabel === endLabel ? `${startLabel} ${beYear}` : `${startLabel}-${endLabel} ${beYear}`;
}

function shortDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() + 543).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function num(value: number): string {
  return value ? formatTHB(value) : "-";
}

// The table has no outer bordered wrapper, so it draws its own complete
// frame: border-t/border-l on the <table> itself, and border-r/border-b on
// every single cell — including the last column/row, since there's no
// container border to double against here.
const th = "border-r border-b border-black p-1 font-medium break-words";
const td = "border-r border-b border-black p-1 whitespace-nowrap";
// ลูกค้า/ชื่องาน can run long (full company names, multi-lot project
// titles) — these wrap onto a second line instead of stretching the table
// past the page width, which is what colgroup + table-layout:fixed below
// actually enforces (a column only wraps its content if the table itself
// can't just grow the column to fit it).
const tdWrap = "border-r border-b border-black p-1 break-words";

export function PrintCommissionView({
  broker,
  windowStart,
  windowEnd,
  projects,
}: {
  broker: string;
  windowStart: string;
  windowEnd: string;
  projects: CommissionableProject[];
}) {
  const rows = projects.filter((p) => p.salesRepName === broker);
  const totalPreVat = rows.reduce((sum, r) => sum + r.preVat, 0);
  const totalIncVat = rows.reduce((sum, r) => sum + r.total, 0);
  const totalCommission = rows.reduce((sum, r) => sum + r.commissionAmount, 0);
  // e.g. ยอดขาย 1,000 ค่าคอม 100 → 10% — the overall commission payout as
  // a share of sales for this broker/period, not just the per-job rate.
  const commissionPercentOfSales = totalPreVat ? (totalCommission / totalPreVat) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl bg-white p-6 text-black print:p-0">
      <div className="text-[11px] leading-tight">
        <Image src="/koonwaylogo.png" alt="KOONWAY" width={152} height={24} className="h-6 w-auto" priority />
        <p className="mt-2 font-medium">บริษัท คูนเว จำกัด</p>
        <p className="font-medium">{broker}</p>
        <p className="font-medium">ประจำเดือน {periodLabel(windowStart, windowEnd)}</p>

        <table className="mt-3 w-full table-fixed border-collapse border-t border-l border-black text-center">
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[5%]" />
            <col className="w-[6%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[4%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[5%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>ลำดับ</th>
              <th className={th}>วันที่</th>
              <th className={th}>เลขที่ Job</th>
              <th className={th}>ลูกค้า</th>
              <th className={th}>ชื่องาน</th>
              <th className={th}>จำนวนเงิน</th>
              <th className={th}>จำนวนเงิน +VAT</th>
              <th className={th}>ส่วนลด</th>
              <th className={th}>อัตราค่าคอมมิชชั่น</th>
              <th className={th}>งวดที่</th>
              <th className={th}>จำนวนที่ชำระ</th>
              <th className={th}>เลขที่ใบกำกับ IV</th>
              <th className={th}>เลขที่ใบรับเงิน RE</th>
              <th className={th}>วันที่รับชำระ</th>
              <th className={th}>ค่าคอมมิชชั่น</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              // A job with no installment data on file (an honest gap, not
              // fabricated) still gets exactly one row using its own
              // collapsed invoiceNo/receiptNo/receivedDate — same fallback
              // the Incentive report's identical pattern uses.
              const installmentRows =
                r.installments.length > 0
                  ? r.installments
                  : [
                      {
                        label: "-",
                        amountWithVat: r.total,
                        invoiceNo: r.invoiceNo,
                        paidDate: r.receivedDate,
                        receiptNo: r.receiptNo,
                      },
                    ];
              return (
                <Fragment key={r.projectId}>
                  {installmentRows.map((it, j) => (
                    <tr key={j}>
                      {j === 0 && (
                        <>
                          <td className={td} rowSpan={installmentRows.length}>{i + 1}</td>
                          <td className={td} rowSpan={installmentRows.length}>{shortDate(r.projectDate)}</td>
                          <td className={td} rowSpan={installmentRows.length}>{r.jobNo ?? "—"}</td>
                          <td className={tdWrap + " text-left"} rowSpan={installmentRows.length}>{r.customerName}</td>
                          <td className={tdWrap + " text-left"} rowSpan={installmentRows.length}>{r.projectName}</td>
                          <td className={td} rowSpan={installmentRows.length}>{num(r.preVat)}</td>
                          <td className={td} rowSpan={installmentRows.length}>{num(r.total)}</td>
                          <td className={td} rowSpan={installmentRows.length}>{r.discountPercent}%</td>
                          <td className={td + " text-red-600"} rowSpan={installmentRows.length}>
                            {r.commissionRatePercent.toFixed(1)}%
                          </td>
                        </>
                      )}
                      <td className={td}>{it.label}</td>
                      <td className={td}>{num(it.amountWithVat)}</td>
                      <td className={tdWrap}>{it.invoiceNo ?? "—"}</td>
                      <td className={tdWrap}>{it.receiptNo ?? "—"}</td>
                      <td className={td}>{shortDate(it.paidDate)}</td>
                      {j === 0 && (
                        <td className={td} rowSpan={installmentRows.length}>{num(r.commissionAmount)}</td>
                      )}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            <tr>
              <td className={td} colSpan={5}></td>
              <td className={td + " font-medium"}>{num(totalPreVat)}</td>
              <td className={td + " font-medium"}>{num(totalIncVat)}</td>
              <td className={td} colSpan={7}></td>
              <td className={td + " font-medium"}>{num(totalCommission)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-right text-[15px] font-medium text-red-600">
          % ค่าคอมมิชชั่นต่อยอดขาย {commissionPercentOfSales.toFixed(2)}%
        </p>

        <div className="mt-16 flex items-baseline justify-end gap-2">
          <span className="w-56 border-b border-dotted border-black" />
          <span className="w-20 whitespace-nowrap">ผู้จัดทำ</span>
        </div>
        <div className="mt-10 flex items-baseline justify-end gap-2">
          <span className="w-56 border-b border-dotted border-black" />
          <span className="w-20 whitespace-nowrap">ผู้ตรวจสอบ</span>
        </div>
        <div className="mt-10 flex items-baseline justify-end gap-2">
          <span className="w-56 border-b border-dotted border-black" />
          <span className="w-20 whitespace-nowrap">ผู้อนุมัติ</span>
        </div>
      </div>
    </div>
  );
}
