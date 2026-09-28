"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import type { PaymentVoucher } from "@/lib/types";

type VoucherRow = Omit<PaymentVoucher, "ledgerLines">;

export function PrintPaymentVoucherSummaryView({
  rows,
  fromLabel,
  toLabel,
  preparerName,
}: {
  rows: VoucherRow[];
  fromLabel: string;
  toLabel: string;
  preparerName: string;
}) {
  const router = useRouter();
  const grandTotal = rows.reduce((sum, v) => sum + v.amount, 0);

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold">รายการจ่ายเงิน</p>
          <p className="text-sm">
            {fromLabel} — {toLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">ยอดรวมทั้งสิ้น</p>
          <p className="text-xl font-semibold">{formatTHB(grandTotal)}</p>
          <p className="text-sm text-muted-foreground">{rows.length} รายการ</p>
        </div>
      </div>

      <table className="w-full border-collapse border border-black text-center text-[12px]">
        <thead>
          <tr>
            <th className="border border-black p-1" style={{ width: "5%" }}>
              ลำดับ
            </th>
            <th className="border border-black p-1" style={{ width: "14%" }}>
              เลขที่เอกสาร
            </th>
            <th className="border border-black p-1" style={{ width: "10%" }}>
              วันที่
            </th>
            <th className="border border-black p-1" style={{ width: "25%" }}>
              ผู้รับเงิน
            </th>
            <th className="border border-black p-1" style={{ width: "14%" }}>
              หมวดหมู่
            </th>
            <th className="border border-black p-1" style={{ width: "12%" }}>
              เลขที่ Job
            </th>
            <th className="border border-black p-1" style={{ width: "20%" }}>
              จำนวนเงิน
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td className="border border-black p-2 text-muted-foreground" colSpan={7}>
                ไม่พบรายการในช่วงที่เลือก
              </td>
            </tr>
          )}
          {rows.map((v, i) => (
            <tr key={v.id} className="h-7">
              <td className="border border-black p-1">{i + 1}</td>
              <td className="border border-black p-1 text-left">{v.docNo}</td>
              <td className="border border-black p-1">{new Date(v.voucherDate).toLocaleDateString("th-TH")}</td>
              <td className="border border-black p-1 text-left">{v.payeeName}</td>
              <td className="border border-black p-1 text-left">{v.category ?? "—"}</td>
              <td className="border border-black p-1">{v.jobNo ?? "—"}</td>
              <td className="border border-black p-1 text-right">{formatTHB(v.amount)}</td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr>
              <td className="border border-black p-1" colSpan={6}>
                <span className="font-semibold text-red-600">รวมทั้งสิ้น</span>
              </td>
              <td className="border border-black p-1 text-right font-semibold text-red-600">
                {formatTHB(grandTotal)}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-10 flex justify-between px-8 text-center text-sm">
        <div>
          <p>___________________________</p>
          <p>{preparerName || " "}</p>
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
