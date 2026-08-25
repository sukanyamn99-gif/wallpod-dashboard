"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
import { thaiBahtText } from "@/lib/thai-baht-text";
import type { PaymentVoucher } from "@/lib/types";

// Splits the doc no. (PVyymmnnn) back into the running number shown on the
// physical form, which resets each month — e.g. "PV2508001" -> "08/001",
// matching how the company's own paper form numbers vouchers, while the
// underlying doc_no stays globally unique for the database.
function runningNoOf(docNo: string): string {
  const body = docNo.slice(2); // strip "PV"
  const mm = body.slice(2, 4);
  const seq = body.slice(4);
  return `${mm}/${seq}`;
}

function dateParts(dateStr: string) {
  const d = new Date(dateStr);
  return {
    dd: String(d.getDate()).padStart(2, "0"),
    mm: String(d.getMonth() + 1).padStart(2, "0"),
    yy: String(d.getFullYear() + 543).slice(-2),
  };
}

const MIN_LEDGER_ROWS = 4;
const WHT_OPTIONS = ["ภ.ง.ด.1", "ภ.ง.ด.2", "ภ.ง.ด.3", "ภ.ง.ด.53"] as const;
const SIGNATURE_BLOCKS = ["ผู้จัดทำ", "ผู้ตรวจสอบการเงิน", "ผู้ตรวจสอบบัญชี", "ผู้อนุมัติจ่าย", "ผู้บันทึกบัญชี"];

export function PrintVoucherView({ voucher }: { voucher: PaymentVoucher }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  const { dd, mm, yy } = dateParts(voucher.voucherDate);
  const netPaid = voucher.amount - voucher.whtAmount;
  const ledgerRows = [...voucher.ledgerLines];
  while (ledgerRows.length < MIN_LEDGER_ROWS) {
    ledgerRows.push({ id: `blank-${ledgerRows.length}`, accountCode: null, description: null, debit: 0, credit: 0 });
  }

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button onClick={() => window.print()}>พิมพ์</Button>
      </div>

      <div className="border border-black text-[13px] leading-tight">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-black p-3">
          <div>
            <p className="text-3xl font-bold tracking-tight">
              KOO<span className="text-sky-600">N</span>WAY
            </p>
            <p className="mt-1">บริษัท คูนเว จำกัด</p>
            <p>เลขที่ 24/2-4 ถนนสุขาภิบาล 2</p>
            <p>แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250</p>
          </div>
          <div className="text-right">
            <p className="font-medium text-red-600">เลขที่ใบหัก ณ ที่จ่าย</p>
            <p className="text-red-600">{voucher.whtCertNo ?? "—"}</p>
          </div>
        </div>

        <div className="border-b border-black p-2 text-center text-lg font-semibold">
          ใบสำคัญจ่าย / PAYMENT VOUCHER
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

        <Field label="จ่ายให้ /Payment to" value={voucher.payeeName} />
        <Field label="จำนวนเงิน (ตัวเลข)" value={formatTHB(voucher.amount)} />
        <Field label="จำนวนเงิน (ตัวอักษร)" value={thaiBahtText(voucher.amount)} />
        <Field label="รายการจ่าย" value={voucher.description} />
        <Field label="ทำจ่าย" value={voucher.note} />
        <Field label="เลขที่เอกสารแนบ" value={voucher.referenceNo} />

        <div className="flex items-center gap-3 border-b border-black p-2">
          <span className="whitespace-nowrap">
            W/H TAX...{voucher.whtRate ?? ""}%......
          </span>
          {WHT_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-1 whitespace-nowrap">
              <span
                className={`inline-block h-3.5 w-3.5 border border-black text-center text-[10px] leading-[13px] ${
                  voucher.whtFormType === opt ? "bg-black text-white" : ""
                }`}
              >
                {voucher.whtFormType === opt ? "x" : ""}
              </span>
              {opt}
            </label>
          ))}
        </div>

        <div className="border-b border-black p-2">ลงชื่อผู้รับเงิน : ___________________________</div>

        {/* Bank row */}
        <table className="w-full border-collapse border-b border-black text-center">
          <thead>
            <tr>
              <th className="border-r border-black p-1 font-medium">ธนาคาร/สาขา</th>
              <th className="border-r border-black p-1 font-medium">เลขที่บัญชี</th>
              <th className="border-r border-black p-1 font-medium">ลงวันที่</th>
              <th className="border-r border-black p-1 font-medium">ภาษีหัก ณ ที่จ่าย</th>
              <th className="p-1 font-medium">จำนวนเงินจ่าย</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-r border-t border-black p-1 font-medium">{voucher.bankName ?? "—"}</td>
              <td className="border-r border-t border-black p-1">{voucher.bankAccountNo ?? "—"}</td>
              <td className="border-r border-t border-black p-1">
                {voucher.bankTransferDate ? new Date(voucher.bankTransferDate).toLocaleDateString("th-TH") : "—"}
              </td>
              <td className="border-r border-t border-black p-1">
                {voucher.whtAmount > 0 ? formatTHB(voucher.whtAmount) : "-"}
              </td>
              <td className="border-t border-black p-1">{formatTHB(netPaid)}</td>
            </tr>
          </tbody>
        </table>

        {/* Ledger */}
        <table className="w-full border-collapse border-b border-black text-center">
          <thead>
            <tr>
              <th className="w-1/6 border-r border-black p-1 font-medium">รหัสบัญชี/CODE</th>
              <th className="w-1/2 border-r border-black p-1 font-medium">รายการ/DESCRIPTIONS</th>
              <th className="w-1/6 border-r border-black p-1 font-medium">DEBIT</th>
              <th className="w-1/6 p-1 font-medium">CREDIT</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map((line) => (
              <tr key={line.id} className="h-7">
                <td className="border-r border-t border-black p-1">{line.accountCode ?? ""}</td>
                <td className="border-r border-t border-black p-1 text-left">{line.description ?? ""}</td>
                <td className="border-r border-t border-black p-1 text-right">
                  {line.debit ? formatTHB(line.debit) : ""}
                </td>
                <td className="border-t border-black p-1 text-right">{line.credit ? formatTHB(line.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures */}
        <table className="w-full border-collapse text-center">
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
