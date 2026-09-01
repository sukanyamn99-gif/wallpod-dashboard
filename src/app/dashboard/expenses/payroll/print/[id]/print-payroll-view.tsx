"use client";

import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
import type { PayrollEntry, PayrollYtdSummary } from "@/lib/types";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function payPeriodParts(payPeriod: string): { monthName: string; beYear: number } {
  const [y, m] = payPeriod.split("-");
  return { monthName: THAI_MONTHS[Number(m) - 1] ?? m, beYear: Number(y) + 543 };
}

function thaiDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() + 543).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function thaiShortDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH");
}

function money(value: number): string {
  return value > 0 ? formatTHB(value) : "-";
}

export function PrintPayrollView({ entry, ytd }: { entry: PayrollEntry; ytd: PayrollYtdSummary }) {
  const { monthName, beYear } = payPeriodParts(entry.payPeriod);

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button onClick={() => window.print()}>พิมพ์</Button>
      </div>

      <div className="border border-black text-[13px] leading-tight">
        {/* Header */}
        <div className="border-b border-black p-3">
          <p className="font-semibold">บริษัท คูนเว จำกัด</p>
          <p className="mt-1">
            ใบจ่ายเงินเดือน/ค่าแรง เดือน {monthName} {beYear}
          </p>
        </div>

        {/* Employee info */}
        <div className="grid grid-cols-2 border-b border-black">
          <Field label="ชื่อ" value={entry.employeeName} />
          <Field label="เลขที่บัตรประชาชน" value={entry.employeeIdCardNo} />
        </div>
        <div className="grid grid-cols-2 border-b border-black">
          <Field label="วันที่เริ่มงาน" value={thaiShortDate(entry.employeeStartDate)} />
          <Field label="รหัสพนักงาน" value={entry.employeeCode} />
        </div>
        <div className="grid grid-cols-2 border-b border-black">
          <Field label="ตำแหน่ง" value={entry.employeePosition} />
          <div />
        </div>

        {/* Income / deductions table */}
        <table className="w-full border-collapse text-center">
          <thead>
            <tr>
              <th className="border border-black p-1 font-medium" rowSpan={2}>
                เดือน
              </th>
              <th className="border border-black p-1 font-medium" colSpan={4}>
                รายได้
              </th>
              <th className="border border-black p-1 font-medium" colSpan={3}>
                รายจ่าย
              </th>
              <th className="border border-black p-1 font-medium" rowSpan={2}>
                วัน/เดือน/ปี
              </th>
            </tr>
            <tr>
              <th className="border border-black p-1 font-medium">เงินเดือน</th>
              <th className="border border-black p-1 font-medium">ค่าน้ำมัน</th>
              <th className="border border-black p-1 font-medium">ค่าคอมฯ</th>
              <th className="border border-black p-1 font-medium">ค่า Incentive</th>
              <th className="border border-black p-1 font-medium">หักประกันสังคม</th>
              <th className="border border-black p-1 font-medium">ภ.ง.ด.1</th>
              <th className="border border-black p-1 font-medium">หักอื่นๆ</th>
            </tr>
          </thead>
          <tbody>
            <tr className="h-10">
              <td className="border border-black p-1">{monthName}</td>
              <td className="border border-black p-1">{money(entry.baseSalary)}</td>
              <td className="border border-black p-1">{money(entry.fuelAllowance)}</td>
              <td className="border border-black p-1">{money(entry.commission)}</td>
              <td className="border border-black p-1">{money(entry.incentive)}</td>
              <td className="border border-black p-1">{money(entry.socialSecurity)}</td>
              <td className="border border-black p-1">{money(entry.withholdingTax)}</td>
              <td className="border border-black p-1">{money(entry.otherDeductions)}</td>
              <td className="border border-black p-1">
                <p>{thaiDate(entry.payDate)}</p>
                <p className="mt-1 font-medium text-red-600">เงินเดือนสุทธิ</p>
              </td>
            </tr>
            <tr>
              <td className="border border-black p-1 font-medium" colSpan={4}>
                รวมรายได้ {formatTHB(entry.totalIncome)}
              </td>
              <td className="border border-black p-1 font-medium" colSpan={3}>
                รวมรายการหัก {formatTHB(entry.totalDeductions)}
              </td>
              <td className="border border-black p-1 text-lg font-semibold">{formatTHB(entry.netSalary)}</td>
            </tr>
          </tbody>
        </table>

        {/* YTD summary */}
        <table className="w-full border-collapse text-center">
          <thead>
            <tr>
              <th className="border border-black p-1 font-medium">รายได้สะสมต่อปี</th>
              <th className="border border-black p-1 font-medium">ภาษีสะสมต่อปี</th>
              <th className="border border-black p-1 font-medium">เงินประกันสังคมต่อปี</th>
              <th className="border border-black p-1 font-medium">ค่าลดหย่อนอื่นๆ ต่อปี</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-1">{money(ytd.cumulativeIncome)}</td>
              <td className="border border-black p-1">{money(ytd.cumulativeTax)}</td>
              <td className="border border-black p-1">{money(ytd.cumulativeSocialSecurity)}</td>
              <td className="border border-black p-1">{money(ytd.cumulativeOtherDeductions)}</td>
            </tr>
          </tbody>
        </table>

        {/* Signature */}
        <div className="flex justify-end p-4">
          <div className="text-center">
            <p className="mb-8">&nbsp;</p>
            <p>________________________</p>
            <p className="mt-1 font-medium">ลงชื่อผู้จัดทำ</p>
            {entry.preparedByName && <p className="text-xs text-neutral-500">({entry.preparedByName})</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex border-r border-black last:border-r-0">
      <span className="w-40 shrink-0 border-r border-black p-2 font-medium">{label}</span>
      <span className="flex-1 p-2">{value ?? "—"}</span>
    </div>
  );
}
