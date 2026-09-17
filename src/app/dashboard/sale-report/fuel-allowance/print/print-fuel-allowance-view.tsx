"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatNumber, formatTHB } from "@/lib/format";
import { thaiBahtText } from "@/lib/thai-baht-text";
import type { FuelAllowanceRow } from "@/lib/types";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function shortThaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

export function PrintFuelAllowanceView({
  rows,
  month,
  year,
  visitPeriod,
}: {
  rows: FuelAllowanceRow[];
  month: number;
  year: number;
  visitPeriod: { from: string; to: string };
}) {
  const router = useRouter();
  const total = rows.reduce((sum, r) => sum + r.fuelAmount, 0);

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="mx-auto max-w-[900px] bg-white p-8 text-black print:p-0">
        <Image src="/koonwaylogo.png" alt="KOONWAY" width={152} height={24} className="h-6 w-auto" priority />
        <p className="mt-3 font-medium">บริษัท คูนเว จำกัด</p>
        <p className="font-medium">สรุปค่าน้ำมันพนักงานขาย</p>
        <p className="mb-4 font-medium">
          ประจำเดือน {THAI_MONTHS[month - 1]} {year + 543}
        </p>
        <p className="mb-4 text-xs text-gray-600">
          ยอดขาย: เดือน {THAI_MONTHS[month - 1]} {year + 543} (ปฏิทิน) — จำนวนลูกค้าที่วิ่ง: {shortThaiDate(visitPeriod.from)} ถึง{" "}
          {shortThaiDate(visitPeriod.to)}
        </p>

        <table className="w-full border-collapse border border-black text-sm">
          <thead>
            <tr>
              <th className="border border-black p-2 font-medium">ลำดับ</th>
              <th className="border border-black p-2 font-medium">พนักงานขาย</th>
              <th className="border border-black p-2 text-right font-medium">ยอดขาย (บาท)</th>
              <th className="border border-black p-2 text-right font-medium">จำนวนลูกค้าที่วิ่ง</th>
              <th className="border border-black p-2 text-right font-medium">ค่าน้ำมันที่ได้รับ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-black p-4 text-center text-gray-500">
                  ยังไม่ได้เลือกพนักงานขาย
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.salesRepName}>
                  <td className="border border-black p-2 text-center">{i + 1}</td>
                  <td className="border border-black p-2">{r.salesRepName}</td>
                  <td className="border border-black p-2 text-right tabular-nums">{formatTHB(r.salesAmount)}</td>
                  <td className="border border-black p-2 text-right tabular-nums">{formatNumber(r.visitCount)} ราย</td>
                  <td className="border border-black p-2 text-right tabular-nums">{formatTHB(r.fuelAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: "#fff9c4" }}>
                <td className="border border-black p-2" colSpan={4}>
                  รวมทั้งสิ้น
                </td>
                <td className="border border-black p-2 text-right font-medium tabular-nums">{formatTHB(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {rows.length > 0 && <p className="mt-2 text-right text-sm">({thaiBahtText(total)})</p>}

        {rows.length > 0 && (
          <div className="mt-8 space-y-6">
            <p className="font-medium">รายละเอียดประกอบการคำนวณ</p>
            {rows.map((r) => (
              <div key={r.salesRepName} className="break-inside-avoid space-y-2">
                <p className="font-medium">{r.salesRepName}</p>

                <p className="text-xs text-gray-600">
                  รายการที่วิ่ง ({shortThaiDate(visitPeriod.from)} ถึง {shortThaiDate(visitPeriod.to)}) — {r.visits.length} ราย
                </p>
                {r.visits.length === 0 ? (
                  <p className="text-xs text-gray-500">ไม่มีรายการ</p>
                ) : (
                  <table className="w-full border-collapse border border-black text-sm">
                    <thead>
                      <tr>
                        <th className="border border-black p-1 font-medium">วันที่</th>
                        <th className="border border-black p-1 text-left font-medium">ลูกค้า</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.visits.map((v, i) => (
                        <tr key={i}>
                          <td className="border border-black p-1 text-center whitespace-nowrap">{shortThaiDate(v.date)}</td>
                          <td className="border border-black p-1">{v.customerName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <p className="text-xs text-gray-600">
                  รายการยอดขาย (เดือน {THAI_MONTHS[month - 1]} {year + 543}) — {formatTHB(r.salesAmount)} บาท
                </p>
                {r.sales.length === 0 ? (
                  <p className="text-xs text-gray-500">ไม่มีรายการ</p>
                ) : (
                  <table className="w-full border-collapse border border-black text-sm">
                    <thead>
                      <tr>
                        <th className="border border-black p-1 font-medium">วันที่</th>
                        <th className="border border-black p-1 font-medium">เลขที่ Job</th>
                        <th className="border border-black p-1 text-left font-medium">ชื่องาน</th>
                        <th className="border border-black p-1 text-right font-medium">ยอดขาย</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.sales.map((s, i) => (
                        <tr key={i}>
                          <td className="border border-black p-1 text-center whitespace-nowrap">{shortThaiDate(s.date)}</td>
                          <td className="border border-black p-1 text-center">{s.jobNo ?? "—"}</td>
                          <td className="border border-black p-1">{s.projectName}</td>
                          <td className="border border-black p-1 text-right tabular-nums">{formatTHB(s.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-20 flex justify-between px-8">
          <div className="flex flex-col items-center gap-2">
            <span className="w-48 border-b border-dotted border-black" />
            <span>ผู้จัดทำ</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="w-48 border-b border-dotted border-black" />
            <span>ผู้อนุมัติ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
