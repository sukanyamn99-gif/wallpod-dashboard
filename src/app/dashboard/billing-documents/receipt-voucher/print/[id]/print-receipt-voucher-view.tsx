"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import { thaiBahtText } from "@/lib/thai-baht-text";
import type { ReceiptVoucher } from "@/lib/types";

// Same layout as the ใบสำคัญจ่าย print (see expenses/payment-vouchers/print), turned
// around for money received.

// Splits the doc no. (RVyyyymmnnnn) into the monthly running number shown on the
// form, e.g. "RV2026110001" -> "11/0001". A voucher numbered in the earlier
// day-based style has no such split, so its full number is shown instead.
function runningNoOf(docNo: string): string {
  const match = /^RV(\d{4})(\d{2})(\d{4})$/.exec(docNo);
  return match ? `${match[2]}/${match[3]}` : docNo;
}

function dateParts(dateStr: string) {
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  return { dd: d, mm: m, yy: String(Number(y) + 543).slice(-2) };
}

const MIN_LEDGER_ROWS = 4;
const SIGNATURE_BLOCKS = ["ผู้จัดทำ", "ผู้ตรวจสอบการเงิน", "ผู้ตรวจสอบบัญชี", "ผู้อนุมัติ", "ผู้บันทึกบัญชี"];

export function PrintReceiptVoucherView({ voucher }: { voucher: ReceiptVoucher }) {
  const router = useRouter();
  const { dd, mm, yy } = dateParts(voucher.docDate);
  const ledgerRows: { id: string; accountCode: string | null; description: string | null; debit: number; credit: number }[] =
    voucher.ledgerLines.map((l, i) => ({ id: `line-${i}`, ...l }));
  while (ledgerRows.length < MIN_LEDGER_ROWS) {
    ledgerRows.push({ id: `blank-${ledgerRows.length}`, accountCode: null, description: null, debit: 0, credit: 0 });
  }
  const filledItems = voucher.items.filter((it) => it.description || it.amount);

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        {/* The print view opens in a new tab, where router.back() has no
            history to go back to — go to the list explicitly. */}
        <Button variant="outline" onClick={() => router.push("/dashboard/billing-documents/receipt-voucher")}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="border border-black text-[13px] leading-tight">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-black p-3">
          <div>
            <Image src="/koonwaylogo.png" alt="KOONWAY" width={152} height={24} className="h-6 w-auto" priority />
            <p className="mt-1">บริษัท คูนเว จำกัด</p>
            <p>เลขที่ 24/2-4 ถนนสุขาภิบาล 2</p>
            <p>แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-red-600">เลขที่ใบสำคัญรับเงิน</p>
            <p className="text-red-600">{voucher.docNo}</p>
          </div>
        </div>

        <div className="border-b border-black p-2 text-center text-lg font-semibold">
          ใบสำคัญรับเงิน / RECEIPT VOUCHER
        </div>

        {/* Date + running no. */}
        <div className="grid grid-cols-2 border-b border-black">
          <div className="border-r border-black p-2">
            <p className="mb-1 text-center font-medium">DD/MM/YY</p>
            <div className="grid grid-cols-3 text-center">
              <span className="border-r border-black">{dd}</span>
              <span className="border-r border-black">{mm}</span>
              <span>{yy}</span>
            </div>
          </div>
          <div className="p-2">
            <p className="mb-1 text-center font-medium">RUNNING No.</p>
            <p className="text-center">{runningNoOf(voucher.docNo)}</p>
          </div>
        </div>

        <Field label="ได้รับเงินจาก /Received from" value={voucher.contactName} />
        <Field label="จำนวนเงิน (ตัวเลข)" value={formatTHB(voucher.amount)} />
        <Field label="จำนวนเงิน (ตัวอักษร)" value={thaiBahtText(voucher.amount)} />
        {/* One line per รายการ, each with its own amount when there are several. */}
        <div className="flex border-b border-black">
          <span className="w-48 shrink-0 border-r border-black p-2 font-medium">รายการรับ</span>
          <div className="flex-1 p-2">
            {filledItems.length === 0 && <span>—</span>}
            {filledItems.map((it, i) => (
              <div key={i} className="flex justify-between gap-4">
                <span>{it.description}</span>
                {filledItems.length > 1 && <span className="whitespace-nowrap">{formatTHB(it.amount)}</span>}
              </div>
            ))}
          </div>
        </div>
        <Field label="หมายเหตุ" value={voucher.note} />
        <Field label="เลขที่เอกสารแนบ" value={voucher.receiptNo} />

        <div className="border-b border-black p-2">ลงชื่อผู้รับเงิน : ___________________________</div>

        {/* Bank row and Ledger below share this exact column grid (same
            <colgroup> widths on both table-fixed tables) so their vertical
            borders line up as one continuous grid down the form. */}
        <table className="w-full table-fixed border-collapse border-b border-black text-center">
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[25%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-r border-black p-1 font-medium">ธนาคาร/สาขา</th>
              <th className="border-r border-black p-1 font-medium">เลขที่บัญชี</th>
              <th className="border-r border-black p-1 font-medium">ลงวันที่</th>
              <th className="p-1 font-medium" colSpan={2}>
                จำนวนเงินรับ
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-r border-t border-black p-1 font-medium">{voucher.bankName ?? "—"}</td>
              <td className="border-r border-t border-black p-1">{voucher.bankAccountNo ?? "—"}</td>
              <td className="border-r border-t border-black p-1">
                {voucher.payDate ? new Date(voucher.payDate).toLocaleDateString("th-TH") : "—"}
              </td>
              <td className="border-t border-black p-1" colSpan={2}>
                {formatTHB(voucher.amount)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Ledger */}
        <table className="w-full table-fixed border-collapse border-b border-black text-center">
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[25%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-r border-black p-1 font-medium">รหัสบัญชี/CODE</th>
              <th className="border-r border-black p-1 font-medium" colSpan={2}>
                รายการ/DESCRIPTIONS
              </th>
              <th className="border-r border-black p-1 font-medium">DEBIT</th>
              <th className="p-1 font-medium">CREDIT</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map((line) => (
              <tr key={line.id} className="h-7">
                <td className="border-r border-t border-black p-1">{line.accountCode ?? ""}</td>
                <td className="border-r border-t border-black p-1 text-left" colSpan={2}>
                  {line.description ?? ""}
                </td>
                <td className="border-r border-t border-black p-1 text-right">
                  {line.debit ? formatTHB(line.debit) : ""}
                </td>
                <td className="border-t border-black p-1 text-right">{line.credit ? formatTHB(line.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures — same 5-column grid as the bank/ledger tables above,
            so the vertical borders run continuously all the way down. */}
        <table className="w-full table-fixed border-collapse text-center">
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[25%]" />
          </colgroup>
          <tbody>
            <tr>
              {SIGNATURE_BLOCKS.map((label) => (
                <td key={label} className="border-r border-black p-2 last:border-r-0" style={{ height: 70 }}>
                  <p className="mb-8 font-medium">{label}</p>
                  {label === "ผู้จัดทำ" && voucher.recordedByName && (
                    <p className="text-xs text-neutral-500">({voucher.recordedByName})</p>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex border-b border-black">
      <span className="w-48 shrink-0 border-r border-black p-2 font-medium">{label}</span>
      <span className="flex-1 p-2">{value ?? "—"}</span>
    </div>
  );
}
