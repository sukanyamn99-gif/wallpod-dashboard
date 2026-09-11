"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import { thaiBahtText } from "@/lib/thai-baht-text";
import type { PaymentVoucher, WhtFormType, WhtIncomeType } from "@/lib/types";

const COMPANY_TAX_ID = "0105559182973";
const COMPANY_NAME = "บริษัท คูนเว จำกัด (สำนักงานใหญ่)";
const COMPANY_ADDRESS = "24/2-4 สุขาภิบาล 2 แขวงประเวศ เขตประเวศ กรุงเทพ 10250";

// Numeric DD/M/YYYY, matching the real official form's own date fields
// exactly (confirmed against a filled reference — the form prints the
// Christian year here, not the Buddhist year used elsewhere in this app).
function numericDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// The official form's tax-id boxes are grouped 1-4-5-2-1 with a dash between
// groups (e.g. 0-1055-59182-97-3) — matches this company's own printed
// format too.
const TAX_ID_GROUPS = [1, 4, 5, 2, 1];

function TaxIdBoxes({ value }: { value: string | null }) {
  const digits = (value ?? "").replace(/\D/g, "").padEnd(13, " ").slice(0, 13).split("");
  const groupOffsets = TAX_ID_GROUPS.reduce<number[]>((offsets, size, i) => {
    offsets.push(i === 0 ? 0 : offsets[i - 1] + TAX_ID_GROUPS[i - 1]);
    return offsets;
  }, []);
  return (
    <div className="flex items-center">
      {TAX_ID_GROUPS.map((size, gi) => {
        const group = digits.slice(groupOffsets[gi], groupOffsets[gi] + size);
        return (
          <div key={gi} className="flex items-center">
            {gi > 0 && <span className="mx-0.5">-</span>}
            <div className="flex">
              {group.map((d, i) => (
                <span
                  key={i}
                  className={`flex h-4 w-4 items-center justify-center border border-black text-center text-[10px] ${i === 0 ? "" : "border-l-0"}`}
                >
                  {d.trim()}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The reference form prints a second, ungrouped 13-box tax-id row next to
// ชื่อ that stays blank on the real example too — reproduced empty here for
// visual fidelity, not a second live field this app tracks.
function BlankTaxIdBoxes() {
  return (
    <div className="flex">
      {Array.from({ length: 13 }).map((_, i) => (
        <span key={i} className={`flex h-4 w-4 items-center justify-center border border-black ${i === 0 ? "" : "border-l-0"}`} />
      ))}
    </div>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex h-3 w-3 shrink-0 items-center justify-center border border-black text-[8px] leading-none ${checked ? "bg-black text-white" : ""}`}
    >
      {checked ? "x" : ""}
    </span>
  );
}

// Official checklist is (1) ภ.ง.ด.1ก ... (7) ภ.ง.ด.53 — there is no plain
// "ภ.ง.ด.1" on the real form, so this app's WhtFormType "ภ.ง.ด.1" maps to
// the closest official item, (1) ภ.ง.ด.1ก. Items (2)/(5)/(6) have no
// equivalent in this app's data and never get checked.
const FORM_TYPE_ITEMS: { no: string; label: string; match: WhtFormType | null }[] = [
  { no: "(1)", label: "ภ.ง.ด.1ก", match: "ภ.ง.ด.1" },
  { no: "(2)", label: "ภ.ง.ด.1ก พิเศษ", match: null },
  { no: "(3)", label: "ภ.ง.ด.2", match: "ภ.ง.ด.2" },
  { no: "(4)", label: "ภ.ง.ด.3", match: "ภ.ง.ด.3" },
  { no: "(5)", label: "ภ.ง.ด.2ก", match: null },
  { no: "(6)", label: "ภ.ง.ด.3ก", match: null },
  { no: "(7)", label: "ภ.ง.ด.53", match: "ภ.ง.ด.53" },
];

type IncomeRow = { key?: WhtIncomeType; text: string; indent?: number };

// Verbatim from the official มาตรา 50 ทวิ form, including the full
// dividend-credit breakdown under 4(ข) — this app's income_type is coarser
// than these sub-items, so only the top-level 4(ข) row (never a sub-bullet)
// ever gets a date/amount/tax filled in when incomeType === "4b".
const INCOME_ROWS: IncomeRow[] = [
  { key: "1", text: "1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40(1)" },
  { key: "2", text: "2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40(2)" },
  { key: "3", text: "3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40(3)" },
  { key: "4a", text: "4. (ก) ดอกเบี้ย ฯลฯ ตามมาตรา 40(4)(ก)" },
  { key: "4b", text: "(ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40(4)(ข)" },
  {
    text: "(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจากกำไรสุทธิของกิจการที่ต้องเสียภาษีเงินได้นิติบุคคลในอัตรา ดังนี้",
    indent: 1,
  },
  { text: "(1.1) อัตราร้อยละ 30 ของกำไรสุทธิ", indent: 2 },
  { text: "(1.2) อัตราร้อยละ 25 ของกำไรสุทธิ", indent: 2 },
  { text: "(1.3) อัตราร้อยละ 20 ของกำไรสุทธิ", indent: 2 },
  { text: "(1.4) อัตราอื่นๆ (ระบุ)..................ของกำไรสุทธิ", indent: 2 },
  { text: "(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษีเนื่องจากจ่ายจาก", indent: 1 },
  { text: "(2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้นภาษีเงินได้นิติบุคคล", indent: 2 },
  {
    text: "(2.2) เงินปันผลหรือส่วนแบ่งของกำไรที่ได้รับยกเว้นไม่ต้องนำมารวมคำนวณเป็นรายได้เพื่อเสียภาษีเงินได้นิติบุคคล",
    indent: 2,
  },
  { text: "(2.3) กำไรสุทธิที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปีก่อนรอบระยะเวลาบัญชีปีปัจจุบัน", indent: 2 },
  { text: "(2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)", indent: 2 },
  { text: "(2.5) อื่นๆ (ระบุ)...................................", indent: 2 },
  {
    key: "5",
    text: "5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่ายตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส เช่น รางวัล ส่วนลดหรือประโยชน์ใดๆ เนื่องจากการส่งเสริมการขาย รางวัลในการประกวด การแข่งขัน การชิงโชค ค่าแสดงของนักแสดงสาธารณะ ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ",
  },
  { key: "6", text: "6. อื่นๆ (ระบุ)....................................." },
];

export function PrintWhtCertificateView({ voucher }: { voucher: PaymentVoucher }) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      {/* This form's official text is long enough that default browser print
          margins push the last line or two onto a second page — a smaller
          @page margin (scoped to this print route only, not app-wide) buys
          back enough room to keep it on one sheet, matching the real form. */}
      <style>{`@page { size: A4; margin: 10mm; }`}</style>

      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => router.back()}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="text-[9.5px] leading-snug">
        <div className="flex justify-between">
          <div>
            <p>ฉบับที่ 1 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแบบแสดงรายการภาษี)</p>
            <p>ฉบับที่ 2 (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)</p>
          </div>
          <div className="shrink-0 text-right">
            <p>เล่มที่ ..............................</p>
            <p>เลขที่ {voucher.whtCertNo ?? "................"}</p>
          </div>
        </div>

        <div className="my-1 text-center">
          <p className="text-[13px] font-semibold">หนังสือรับรองการหักภาษี ณ ที่จ่าย</p>
          <p>ตามมาตรา 50 ทวิแห่งประมวลรัษฎากร</p>
        </div>

        <div className="border border-black">
          {/* Withholder / ผู้มีหน้าที่หักภาษี ณ ที่จ่าย */}
          <div className="border-b border-black p-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <span>ผู้มีหน้าที่หักภาษี ณ ที่จ่าย : -</span>
              <span className="flex items-center gap-2">
                <span>เลขประจำตัวผู้เสียภาษีอากร (13หลัก)*</span>
                <TaxIdBoxes value={COMPANY_TAX_ID} />
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2">
              <span>ชื่อ {COMPANY_NAME}</span>
              <span className="flex items-center gap-2">
                <span>เลขประจำตัวผู้เสียภาษีอากร</span>
                <BlankTaxIdBoxes />
              </span>
            </div>
            <p className="text-neutral-600">(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</p>
            <p className="mt-0.5">ที่อยู่ {COMPANY_ADDRESS}</p>
            <p className="text-neutral-600">
              (ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)
            </p>
          </div>

          {/* Payee / ผู้ถูกหักภาษี ณ ที่จ่าย */}
          <div className="border-b border-black p-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <span>ผู้ถูกหักภาษี ณ ที่จ่าย : -</span>
              <span className="flex items-center gap-2">
                <span>เลขประจำตัวผู้เสียภาษีอากร (13หลัก)*</span>
                <TaxIdBoxes value={voucher.payeeTaxId} />
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2">
              <span>ชื่อ {voucher.payeeName}</span>
              <span className="flex items-center gap-2">
                <span>เลขประจำตัวผู้เสียภาษีอากร</span>
                <BlankTaxIdBoxes />
              </span>
            </div>
            <p className="text-neutral-600">(ให้ระบุว่าเป็น บุคคล นิติบุคคล บริษัท สมาคม หรือคณะบุคคล)</p>
            <p className="mt-0.5">ที่อยู่ {voucher.payeeAddress ?? "—"}</p>
            <p className="text-neutral-600">
              (ให้ระบุ ชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)
            </p>
          </div>

          {/* ภ.ง.ด. form-type checkboxes */}
          <div className="flex flex-wrap items-start gap-x-6 gap-y-0.5 border-b border-black p-1.5">
            <span className="whitespace-nowrap">
              ลำดับที่ <span className="inline-block h-4 w-14 border border-black align-bottom" /> ในแบบ
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-4">
                {FORM_TYPE_ITEMS.slice(0, 4).map((item) => (
                  <label key={item.no} className="flex items-center gap-1 whitespace-nowrap">
                    <Checkbox checked={!!item.match && voucher.whtFormType === item.match} />
                    {item.no} {item.label}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                {FORM_TYPE_ITEMS.slice(4).map((item) => (
                  <label key={item.no} className="flex items-center gap-1 whitespace-nowrap">
                    <Checkbox checked={!!item.match && voucher.whtFormType === item.match} />
                    {item.no} {item.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Income-type table — only the row matching this voucher's
              income_type gets a date/amount/tax filled in; every other row
              (including every 4(ข) sub-bullet) prints blank, matching the
              official form's own layout of listing every category. */}
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[52%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="border-b border-r border-black px-1 py-0.5 text-center font-medium">ประเภทเงินได้พึงประเมินจ่าย</th>
                <th className="border-b border-r border-black px-1 py-0.5 text-center font-medium">วัน เดือน หรือปีภาษี ที่จ่าย</th>
                <th className="border-b border-r border-black px-1 py-0.5 text-center font-medium">จำนวนเงินที่จ่าย</th>
                <th className="border-b border-black px-1 py-0.5 text-center font-medium">ภาษีที่หักและนำส่งไว้</th>
              </tr>
            </thead>
            <tbody>
              {INCOME_ROWS.map((row, i) => {
                const isMatch = !!row.key && voucher.incomeType === row.key;
                const isLast = i === INCOME_ROWS.length - 1;
                return (
                  <tr key={i}>
                    <td
                      className={`border-r border-black px-1 py-0.5 align-top ${isLast ? "" : "border-b"}`}
                      style={row.indent ? { paddingLeft: `${row.indent * 12 + 4}px` } : undefined}
                    >
                      {row.text}
                      {isMatch && voucher.description && ` (${voucher.description})`}
                    </td>
                    <td className={`border-r border-black px-1 py-0.5 text-center align-top ${isLast ? "" : "border-b"}`}>
                      {isMatch ? numericDate(voucher.voucherDate) : ""}
                    </td>
                    <td className={`border-r border-black px-1 py-0.5 text-right align-top ${isLast ? "" : "border-b"}`}>
                      {isMatch ? formatTHB(voucher.amount) : ""}
                    </td>
                    <td className={`px-1 py-0.5 text-right align-top ${isLast ? "" : "border-b"}`}>
                      {isMatch ? formatTHB(voucher.whtAmount) : ""}
                    </td>
                  </tr>
                );
              })}
              <tr className="font-medium">
                <td className="border-t border-r border-black px-1 py-0.5 text-center" colSpan={2}>
                  รวมเงินที่จ่ายและภาษีที่หักนำส่ง
                </td>
                <td className="border-t border-r border-black px-1 py-0.5 text-right">{formatTHB(voucher.amount)}</td>
                <td className="border-t border-black px-1 py-0.5 text-right">{formatTHB(voucher.whtAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="border-t border-black p-1.5">
            รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) ({thaiBahtText(voucher.whtAmount)})
          </div>

          {/* Not tracked by this app (no payroll-fund deduction data on a
              payment voucher) — printed blank for layout fidelity. */}
          <div className="border-t border-black p-1.5">
            เงินที่จ่ายเข้า กบข./กสจ./กองทุนสงเคราะห์ครูโรงเรียนเอกชน.......................บาท กองทุนประกันสังคม.......................บาท
            กองทุนสำรองเลี้ยงชีพ.......................บาท
          </div>

          {/* This app only ever supports withholding at the time of
              payment (no gross-up), so (1) หัก ณ ที่จ่าย is always checked. */}
          <div className="flex flex-wrap items-center gap-4 border-t border-black p-1.5">
            <span className="whitespace-nowrap font-medium">ผู้ที่จ่ายเงิน</span>
            <label className="flex items-center gap-1 whitespace-nowrap">
              <Checkbox checked />
              (1) หัก ณ ที่จ่าย
            </label>
            <label className="flex items-center gap-1 whitespace-nowrap">
              <Checkbox checked={false} />
              (2) ออกให้ตลอดไป
            </label>
            <label className="flex items-center gap-1 whitespace-nowrap">
              <Checkbox checked={false} />
              (3) ออกให้ครั้งเดียว
            </label>
            <label className="flex items-center gap-1 whitespace-nowrap">
              <Checkbox checked={false} />
              (4) อื่นๆ (ระบุ)..............................
            </label>
          </div>

          <div className="grid grid-cols-[1fr_2fr] border-t border-black">
            <div className="border-r border-black p-1.5">
              คำเตือน ผู้มีหน้าที่ออกหนังสือรับรองหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
              ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร
            </div>
            <div className="flex flex-col justify-between p-1.5">
              <div>
                <p>ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</p>
                <p className="mt-1.5">ลงชื่อ .......................................................ผู้จ่ายเงิน</p>
                {voucher.recordedByName && (
                  <p className="mt-0.5 ml-6 text-neutral-600">({voucher.recordedByName})</p>
                )}
                <p className="mt-0.5">
                  {numericDate(voucher.voucherDate)}
                  <span className="text-neutral-600"> (วัน เดือน ปี ที่ออกหนังสือรับรอง)</span>
                </p>
              </div>
              <div className="mt-1 flex justify-end">
                <Image src="/koonwaylogo.png" alt="KOONWAY" width={110} height={18} className="h-[18px] w-auto" />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-0.5 text-neutral-600">
          หมายเหตุ เลขประจำตัวผู้เสียภาษีอากร (13 หลัก)* หมายถึง 1. กรณีบุคคลธรรมดาไทย ให้ใช้เลขประจำตัวประชาชนของกรมการปกครอง
          2. กรณีนิติบุคคล ให้ใช้เลขทะเบียนนิติบุคคลของกรมพัฒนาธุรกิจการค้า 3. กรณีอื่นๆ นอกเหนือจาก 1. และ 2.
          ให้ใช้เลขประจำตัวผู้เสียภาษีอากร (13 หลัก) ของกรมสรรพากร
        </p>
      </div>
    </div>
  );
}
