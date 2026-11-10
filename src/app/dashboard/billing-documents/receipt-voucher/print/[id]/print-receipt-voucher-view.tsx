"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { thaiBahtText } from "@/lib/thai-baht-text";
import type { ReceiptVoucher } from "@/lib/types";

// Company details printed in the header — same as on the company's other documents.
const COMPANY_NAME = "บริษัท คูนเว จำกัด";
const COMPANY_ADDRESS = "24/2-4 ถนนสุขาภิบาล 2 แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250";
const COMPANY_TAX_ID = "0105559182973";

const BLUE = "#2a9bd4";
const MIN_ROWS = 10;

// dd/mm/yyyy, Gregorian — the form's own date style.
function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// The amount column is split into บาท | ส.ต. cells.
function splitBaht(amount: number) {
  const cents = Math.round(amount * 100);
  return {
    baht: Math.floor(cents / 100).toLocaleString("en-US"),
    satang: String(cents % 100).padStart(2, "0"),
  };
}

export function PrintReceiptVoucherView({ voucher }: { voucher: ReceiptVoucher }) {
  const router = useRouter();
  const rows = [...voucher.items];
  while (rows.length < MIN_ROWS) rows.push({ description: "", amount: 0 });
  const total = splitBaht(voucher.amount);

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-[13px] leading-snug text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        {/* The print view opens in a new tab, where router.back() has no
            history to go back to — go to the list explicitly. */}
        <Button variant="outline" onClick={() => router.push("/dashboard/billing-documents/receipt-voucher")}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: BLUE }}>
            ใบสำคัญรับเงิน
          </h1>
          <p className="text-sm" style={{ color: BLUE }}>
            Receipt voucher
          </p>
        </div>
        <Image src="/koonwaylogo.png" alt="KOONWAY" width={152} height={24} className="h-6 w-auto" priority />
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto] gap-x-8">
        <div>
          <p>{COMPANY_NAME}</p>
          <p>{COMPANY_ADDRESS}</p>
          <p>เลขประจำตัวผู้เสียภาษี/Tax ID: {COMPANY_TAX_ID}</p>
        </div>
        <table className="self-start text-left">
          <tbody>
            <tr>
              <td className="pr-3" style={{ color: BLUE }}>
                เลขที่/Voucher:
              </td>
              <td className="pl-4">{voucher.docNo}</td>
            </tr>
            <tr>
              <td className="pr-3" style={{ color: BLUE }}>
                วันที่/Date:
              </td>
              <td className="pl-4">{fmtDate(voucher.docDate)}</td>
            </tr>
            <tr>
              <td className="pr-3" style={{ color: BLUE }}>
                อ้างอิง/Reference:
              </td>
              <td className="pl-4">{voucher.receiptNo ?? ""}</td>
            </tr>
            <tr>
              <td className="pr-3" style={{ color: BLUE }}>
                ผู้จัดทำ/Preparer:
              </td>
              <td className="pl-4">{voucher.recordedByName}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <p style={{ color: BLUE }}>ผู้ติดต่อ/Contact:</p>
        <p>{voucher.contactName}</p>
        {voucher.contactAddress && <p>{voucher.contactAddress}</p>}
        {voucher.contactTaxId && <p>เลขประจำตัวผู้เสียภาษี/Tax ID: {voucher.contactTaxId}</p>}
      </div>

      {/* รายการ | จำนวนเงิน (บาท / ส.ต.) — heavy outer frame, thin row lines, and the
          total boxed under the amount columns only, as on the paper form. */}
      <table className="mt-6 w-full table-fixed border-collapse text-center">
        <colgroup>
          <col />
          <col className="w-[18%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead>
          <tr className="font-semibold">
            <th className="border-2 border-black p-1.5 align-middle" rowSpan={2}>
              รายการ
            </th>
            <th className="border-2 border-black p-1.5" colSpan={2}>
              จำนวนเงิน
            </th>
          </tr>
          <tr className="font-semibold">
            <th className="border-2 border-black p-1.5">บาท</th>
            <th className="border-2 border-black p-1.5">ส.ต.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const filled = !!(row.description || row.amount);
            const parts = splitBaht(row.amount);
            const last = i === rows.length - 1;
            const edge = `border-t border-black ${last ? "border-b-2" : ""}`;
            return (
              <tr key={i} className="h-9 align-top">
                <td className={`border-x-2 border-black p-1.5 text-left ${edge}`}>{row.description}</td>
                <td className={`border-r border-black p-1.5 text-right ${edge}`}>{filled ? parts.baht : ""}</td>
                <td className={`border-r-2 border-black p-1.5 text-center ${edge}`}>{filled ? parts.satang : ""}</td>
              </tr>
            );
          })}
          <tr className="h-9 font-semibold">
            <td className="p-1.5 text-right">รวมเป็นเงิน</td>
            <td className="border-x border-b-2 border-l-2 border-black p-1.5 text-right">{total.baht}</td>
            <td className="border-b-2 border-r-2 border-black p-1.5 text-center">{total.satang}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-8 flex items-baseline gap-3">
        <span className="whitespace-nowrap">จำนวนเงิน (อักษร)</span>
        <span className="min-h-[1.5em] flex-1 border-b border-black px-2">({thaiBahtText(voucher.amount)})</span>
      </div>

      {voucher.note && <p className="mt-4">หมายเหตุ/Remark: {voucher.note}</p>}

      <div className="mt-10 flex flex-col items-end gap-4">
        <div className="flex w-80 items-baseline gap-3">
          <span>ลงชื่อ</span>
          <span className="flex-1 border-b border-black">&nbsp;</span>
          <span>ผู้รับเงิน</span>
        </div>
        <div className="flex w-80 items-baseline gap-3">
          <span>ลงชื่อ</span>
          <span className="flex-1 border-b border-black">&nbsp;</span>
          <span>ผู้จ่ายเงิน</span>
        </div>
      </div>
    </div>
  );
}
