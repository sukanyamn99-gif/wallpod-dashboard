"use client";

import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
import type { CommissionBrokerTotal, CommissionEntry } from "@/lib/types";

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

// The table has no outer bordered wrapper (unlike the payroll slip), so it
// draws its own complete frame: border-t/border-l on the <table> itself
// (see below), and border-r/border-b on every single cell — including the
// last column/row, which is what actually closes off the right/bottom
// edges here (there's no container border to double against).
const th = "border-r border-b border-black p-1 font-medium whitespace-nowrap";
const td = "border-r border-b border-black p-1 whitespace-nowrap";

export function PrintCommissionView({
  broker,
  windowStart,
  windowEnd,
  entries,
  brokerTotals,
}: {
  broker: string;
  windowStart: string;
  windowEnd: string;
  entries: CommissionEntry[];
  brokerTotals: CommissionBrokerTotal[];
}) {
  const rows = entries.filter((e) => e.brokerName === broker);
  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
  const totalInclVat = rows.reduce((sum, r) => sum + r.amountInclVat, 0);
  const totalPaid = rows.reduce((sum, r) => sum + (r.paidAmount ?? r.amountInclVat), 0);
  const totalCommission = rows.reduce((sum, r) => sum + r.commissionAmount, 0);

  return (
    <div className="mx-auto max-w-6xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button onClick={() => window.print()}>พิมพ์</Button>
      </div>

      <div className="text-[11px] leading-tight">
        <p className="text-3xl font-bold tracking-tight">
          KOO<span className="text-sky-600">N</span>WAY
        </p>
        <p className="mt-2 font-medium">บริษัท คูนเว จำกัด</p>
        <p className="font-medium">{broker}</p>
        <p className="font-medium">ประจำเดือน {periodLabel(windowStart, windowEnd)}</p>

        <table className="mt-3 w-full border-collapse border-t border-l border-black text-center">
          <thead>
            <tr>
              <th className={th}>ลำดับ</th>
              <th className={th}>วันที่</th>
              <th className={th}>เลขที่ Job</th>
              <th className={th}>ชื่องาน/บริษัท</th>
              <th className={th}>ชื่อโปรเจค</th>
              <th className={th}>พนักงานขาย</th>
              <th className={th}>จำนวนเงิน</th>
              <th className={th}>จำนวนเงิน +VAT</th>
              <th className={th}>อัตราส่วนลด</th>
              <th className={th}>อัตราค่าคอมมิชชั่น</th>
              <th className={th}>รายการ</th>
              <th className={th}>จำนวนเงิน +VAT</th>
              <th className={th}>เลขที่ใบกำกับ IV</th>
              <th className={th}>เลขที่ใบรับเงิน RE</th>
              <th className={th}>วันที่รับชำระ</th>
              <th className={th}>ค่าคอมมิชชั่น</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className={td}>{i + 1}</td>
                <td className={td}>{shortDate(r.entryDate)}</td>
                <td className={td}>{r.jobNo ?? "—"}</td>
                <td className={td + " text-left"}>{r.projectTitle}</td>
                <td className={td + " text-left"}>{r.projectName ?? "—"}</td>
                <td className={td}>{r.brokerName}</td>
                <td className={td}>{num(r.amount)}</td>
                <td className={td}>{num(r.amountInclVat)}</td>
                <td className={td}>{r.discountPercent}%</td>
                <td className={td + " text-red-600"}>{r.commissionRatePercent.toFixed(1)}%</td>
                <td className={td}>{r.installmentLabel ?? "—"}</td>
                <td className={td}>{num(r.paidAmount ?? r.amountInclVat)}</td>
                <td className={td}>{r.invoiceNo ?? "—"}</td>
                <td className={td}>{r.receiptNo ?? "—"}</td>
                <td className={td}>{shortDate(r.receivedDate)}</td>
                <td className={td}>{num(r.commissionAmount)}</td>
              </tr>
            ))}
            <tr>
              <td className={td} colSpan={6}></td>
              <td className={td + " font-medium"}>{num(totalAmount)}</td>
              <td className={td + " font-medium"}>{num(totalInclVat)}</td>
              <td className={td} colSpan={3}></td>
              <td className={td + " font-medium"}>{num(totalPaid)}</td>
              <td className={td} colSpan={3}></td>
              <td className={td + " font-medium"}>{num(totalCommission)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-8 space-y-2">
          {brokerTotals.map((b) => (
            <p key={b.brokerName} className="flex items-baseline gap-4">
              <span>สรุปยอดจ่ายค่านายหน้า {b.brokerName}</span>
              <span className="flex-1 border-b border-dotted border-black" />
              <span className="font-semibold">{formatTHB(b.totalCommission)}</span>
            </p>
          ))}
        </div>

        <div className="mt-16 flex justify-end gap-16">
          <p>....................................ผู้ตรวจสอบ</p>
        </div>
        <div className="mt-10 flex justify-end gap-16">
          <p>....................................ผู้อนุมัติ</p>
        </div>
      </div>
    </div>
  );
}
