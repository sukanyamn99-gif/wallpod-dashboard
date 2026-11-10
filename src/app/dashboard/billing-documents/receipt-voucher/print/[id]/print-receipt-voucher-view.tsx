"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import type { ReceiptVoucher } from "@/lib/types";

// Company details printed in the header — same as on the company's other documents.
const COMPANY_NAME = "บริษัท คูนเว จำกัด";
const COMPANY_ADDRESS = "24/2-4 ถนนสุขาภิบาล 2 แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250";
const COMPANY_TAX_ID = "0105559182973";

const BLUE = "#2a9bd4";

// dd/mm/yyyy, Gregorian — the journal form's own date style.
function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const SIGNATURES = [
  { th: "ผู้จัดทำ", en: "Prepared by" },
  { th: "ผู้สอบทาน", en: "Reviewed by" },
  { th: "ผู้อนุมัติ", en: "Approved by" },
];

export function PrintReceiptVoucherView({ voucher }: { voucher: ReceiptVoucher }) {
  const router = useRouter();
  const totalDebit = voucher.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = voucher.lines.reduce((sum, l) => sum + l.credit, 0);

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

      {voucher.description && (
        <p className="mt-6">
          <span>ค่าอธิบาย/Description: </span>
          {voucher.description}
        </p>
      )}

      <table className="mt-3 w-full table-fixed border-collapse border border-black">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[44%]" />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead>
          <tr className="text-white" style={{ backgroundColor: BLUE }}>
            <th className="p-1.5 text-left font-normal">
              รหัสบัญชี
              <br />
              Code
            </th>
            <th className="p-1.5 text-left font-normal">
              ชื่อบัญชี
              <br />
              Account name
            </th>
            <th className="p-1.5 text-right font-normal">
              เดบิต
              <br />
              Debit
            </th>
            <th className="p-1.5 text-right font-normal">
              เครดิต
              <br />
              Credit
            </th>
          </tr>
        </thead>
        <tbody>
          {voucher.lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="border-r border-black p-1.5 pb-0.5">{l.accountCode ?? ""}</td>
              <td className="border-r border-black p-1.5 pb-0.5">{l.accountName ?? ""}</td>
              <td className="border-r border-black p-1.5 pb-0.5 text-right">{l.debit ? formatTHB(l.debit) : ""}</td>
              <td className="p-1.5 pb-0.5 text-right">{l.credit ? formatTHB(l.credit) : ""}</td>
            </tr>
          ))}
          {/* Filler so the column rules run down the page like the paper form. */}
          <tr style={{ height: "125mm" }}>
            <td className="border-r border-black" />
            <td className="border-r border-black" />
            <td className="border-r border-black" />
            <td />
          </tr>
          <tr className="border-t border-black">
            <td className="border-r border-black p-1.5" />
            <td className="border-r border-black p-1.5 text-right">รวมทั้งสิ้น/Grand total</td>
            <td className="border-r border-black p-1.5 text-right">{formatTHB(totalDebit)}</td>
            <td className="p-1.5 text-right">{formatTHB(totalCredit)}</td>
          </tr>
          <tr className="border-t border-black">
            <td className="p-1.5" colSpan={4}>
              หมายเหตุ/Remark: {voucher.note ?? ""}
            </td>
          </tr>
          <tr className="border-t border-black">
            <td className="p-0" colSpan={4}>
              <div className="grid grid-cols-3 text-center">
                {SIGNATURES.map((s, i) => (
                  <div key={s.en} className={`p-1.5 ${i < SIGNATURES.length - 1 ? "border-r border-black" : ""}`} style={{ height: 70 }}>
                    {s.th}/{s.en}
                  </div>
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
