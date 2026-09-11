"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import { thaiBahtText } from "@/lib/thai-baht-text";
import type { PaymentVoucher, WhtFormType, WhtIncomeType } from "@/lib/types";

const COMPANY_TAX_ID = "0105559182973";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function thaiLongDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// Splits a free-text tax id into up to 13 individual digit boxes, matching
// the official form's per-digit tax-id cells — any non-digit characters
// (dashes, spaces) the user typed are stripped, not boxed.
function TaxIdBoxes({ value }: { value: string | null }) {
  const digits = (value ?? "").replace(/\D/g, "").padEnd(13, " ").slice(0, 13).split("");
  return (
    <div className="flex">
      {digits.map((d, i) => (
        <span
          key={i}
          className={`flex h-6 w-6 items-center justify-center border border-black text-center ${i === 0 ? "" : "border-l-0"}`}
        >
          {d.trim()}
        </span>
      ))}
    </div>
  );
}

const FORM_TYPE_BOXES: { label: string; match: WhtFormType | null }[] = [
  { label: "1", match: "ภ.ง.ด.1" },
  { label: "1ก", match: null },
  { label: "2", match: "ภ.ง.ด.2" },
  { label: "3", match: "ภ.ง.ด.3" },
  { label: "2ก", match: null },
  { label: "3ก", match: null },
  { label: "53", match: "ภ.ง.ด.53" },
];

const INCOME_TYPE_ROWS: { key: WhtIncomeType; no: string; label: string }[] = [
  { key: "1", no: "1", label: "เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40(1)" },
  { key: "2", no: "2", label: "ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40(2)" },
  { key: "3", no: "3", label: "ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40(3)" },
  { key: "4a", no: "4(ก)", label: "ดอกเบี้ย ฯลฯ ตามมาตรา 40(4)(ก)" },
  { key: "4b", no: "4(ข)", label: "เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40(4)(ข)" },
  { key: "5", no: "5", label: "การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่ายตามคำสั่งกรมสรรพากร" },
  { key: "6", no: "6", label: "อื่นๆ" },
];

export function PrintWhtCertificateView({ voucher }: { voucher: PaymentVoucher }) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="border border-black text-[12px] leading-tight">
        <div className="border-b border-black p-2 text-center">
          <p className="text-lg font-semibold">หนังสือรับรองการหักภาษี ณ ที่จ่าย</p>
          <p>ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</p>
          <p className="mt-1">เลขที่ {voucher.whtCertNo ?? "—"}</p>
        </div>

        {/* Withholder / ผู้มีหน้าที่หักภาษี ณ ที่จ่าย — this company's own info,
            reused verbatim from the Payment Voucher print header. */}
        <div className="border-b border-black p-2">
          <p className="font-medium">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย</p>
          <div className="mt-1 flex flex-wrap items-center gap-4">
            <div>
              <p>บริษัท คูนเว จำกัด (สำนักงานใหญ่)</p>
              <p>เลขที่ 24/2-4 ถนนสุขาภิบาล 2 แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250</p>
            </div>
            <div className="flex items-center gap-2">
              <span>เลขประจำตัวผู้เสียภาษี</span>
              <TaxIdBoxes value={COMPANY_TAX_ID} />
            </div>
          </div>
        </div>

        {/* Payee / ผู้ถูกหักภาษี ณ ที่จ่าย */}
        <div className="border-b border-black p-2">
          <p className="font-medium">ผู้ถูกหักภาษี ณ ที่จ่าย</p>
          <div className="mt-1 flex flex-wrap items-center gap-4">
            <div>
              <p>{voucher.payeeName}</p>
              <p>{voucher.payeeAddress ?? "—"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span>เลขประจำตัวผู้เสียภาษี</span>
              <TaxIdBoxes value={voucher.payeeTaxId} />
            </div>
          </div>
        </div>

        {/* ภ.ง.ด. form-type checkboxes */}
        <div className="flex flex-wrap items-center gap-3 border-b border-black p-2">
          <span className="font-medium">ประเภทแบบ ภ.ง.ด.</span>
          {FORM_TYPE_BOXES.map((box) => (
            <label key={box.label} className="flex items-center gap-1 whitespace-nowrap">
              <span
                className={`inline-block h-3.5 w-3.5 border border-black text-center text-[10px] leading-[13px] ${
                  box.match && voucher.whtFormType === box.match ? "bg-black text-white" : ""
                }`}
              >
                {box.match && voucher.whtFormType === box.match ? "x" : ""}
              </span>
              {box.label}
            </label>
          ))}
        </div>

        {/* Income-type table — only the row matching this voucher's
            income_type is filled in; the rest print blank, matching the
            official form's own layout of listing all 6 categories. */}
        <table className="w-full table-fixed border-collapse border-b border-black text-center">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[42%]" />
            <col className="w-[16%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-r border-black p-1 font-medium">ลำดับที่</th>
              <th className="border-r border-black p-1 font-medium">ประเภทเงินได้พึงประเมิน</th>
              <th className="border-r border-black p-1 font-medium">วันเดือนปีที่จ่าย</th>
              <th className="border-r border-black p-1 font-medium">จำนวนเงินที่จ่าย</th>
              <th className="p-1 font-medium">ภาษีที่หักไว้</th>
            </tr>
          </thead>
          <tbody>
            {INCOME_TYPE_ROWS.map((row) => {
              const isMatch = voucher.incomeType === row.key;
              return (
                <tr key={row.key} className="h-7">
                  <td className="border-r border-t border-black p-1">{row.no}</td>
                  <td className="border-r border-t border-black p-1 text-left">
                    {row.label}
                    {isMatch && voucher.description && (
                      <span className="text-neutral-600"> ({voucher.description})</span>
                    )}
                  </td>
                  <td className="border-r border-t border-black p-1">{isMatch ? thaiLongDate(voucher.voucherDate) : ""}</td>
                  <td className="border-r border-t border-black p-1 text-right">
                    {isMatch ? formatTHB(voucher.amount) : ""}
                  </td>
                  <td className="border-t border-black p-1 text-right">{isMatch ? formatTHB(voucher.whtAmount) : ""}</td>
                </tr>
              );
            })}
            <tr className="h-7 font-medium">
              <td className="border-r border-t border-black p-1 text-right" colSpan={3}>
                รวมเงินที่จ่ายและภาษีที่หักไว้
              </td>
              <td className="border-r border-t border-black p-1 text-right">{formatTHB(voucher.amount)}</td>
              <td className="border-t border-black p-1 text-right">{formatTHB(voucher.whtAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="border-b border-black p-2">
          <span className="font-medium">จำนวนภาษีที่หักไว้ทั้งสิ้น (ตัวอักษร)</span> {thaiBahtText(voucher.whtAmount)}
        </div>

        {/* ผู้จ่ายเงิน — this app only ever supports withholding at the time
            of payment (no gross-up), so "หัก ณ ที่จ่าย" is always the checked
            option. */}
        <div className="flex flex-wrap items-center gap-4 border-b border-black p-2">
          <span className="font-medium">ผู้จ่ายเงินเป็นผู้</span>
          {["หัก ณ ที่จ่าย", "ออกให้ตลอดไป", "ออกให้ครั้งเดียว", "อื่นๆ"].map((opt) => (
            <label key={opt} className="flex items-center gap-1 whitespace-nowrap">
              <span
                className={`inline-block h-3.5 w-3.5 border border-black text-center text-[10px] leading-[13px] ${
                  opt === "หัก ณ ที่จ่าย" ? "bg-black text-white" : ""
                }`}
              >
                {opt === "หัก ณ ที่จ่าย" ? "x" : ""}
              </span>
              {opt}
            </label>
          ))}
        </div>

        <div className="border-b border-black p-2 text-[11px] text-neutral-700">
          ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ
        </div>

        <div className="flex items-start justify-between border-b border-black p-3">
          <div>
            <p>ลงชื่อ ....................................................... ผู้จ่ายเงิน</p>
            {voucher.recordedByName && <p className="ml-6 mt-1 text-neutral-600">({voucher.recordedByName})</p>}
          </div>
          <p>วันที่ {thaiLongDate(voucher.voucherDate)}</p>
        </div>

        <div className="p-2 text-[10px] text-neutral-500">
          <p>
            ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่ายต้องออกหนังสือรับรองให้แก่ผู้ถูกหักภาษี ณ ที่จ่ายทันทีทุกครั้งที่มีการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
          </p>
          <p className="mt-1">ใบแนบ 1 ต้นฉบับ สำหรับผู้ถูกหักภาษี ณ ที่จ่ายใช้แนบพร้อมกับการยื่นแบบแสดงรายการภาษี — ใบแนบ 2 สำเนา สำหรับผู้จ่ายเงินเก็บไว้เป็นหลักฐาน</p>
        </div>
      </div>
    </div>
  );
}
