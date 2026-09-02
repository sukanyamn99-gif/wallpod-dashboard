"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { formatQuotationItemDescription, formatTHB } from "@/lib/format";
import type { QuotationDetail } from "@/lib/types";

function shortDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function num(value: number): string {
  return value ? formatTHB(value) : "-";
}

// Every boxed section uses a plain 1px frame, with 1px lines dividing the
// cells inside it. Every inner cell only ever contributes border-r/border-b
// (never border-l/border-t), since the section's own border (or the
// previous row) already draws that edge — giving every cell its own full
// border would double the line weight at every shared boundary.
const td = "border-r border-b border-black p-1";
const th = td + " p-1.5 font-bold bg-[#c8d7d6] text-center";

// Standard fixed print terms — same on every quotation, not a per-quote
// field (confirmed: these are boilerplate, not something staff re-type).
const STANDARD_NOTES = [
  "*** ราคาอาจมีการปรับเปลี่ยนตามหน้างานจริง อาจมีการเพิ่มสินค้าให้ครบตามใบสั่งซื้อ **ไม่สามารถหัก ณ ที่จ่ายได้**",
  "*** สินค้าแผ่นเปล่าในเบอร์สีตรงตามผลผลิต อาจมีความคลาดเคลื่อนสีในแต่ละล็อตการผลิต กรุณายืนยันสีในสต็อกปัจจุบันก่อนสั่งซื้อ ***",
  "1-2 สัปดาห์ ทำการหลังจากได้รับการยืนยันการสั่งซื้อและชำระเงินค่ามัดจำ (กรณีมีสีในสต็อก)",
  "4-5 สัปดาห์ ทำการหลังจากได้รับการยืนยันการสั่งซื้อและชำระเงินค่ามัดจำ (กรณีไม่มีสีในสต็อก)",
];

export function PrintQuotationView({
  quotation,
  imageUrlsByPath,
}: {
  quotation: QuotationDetail;
  imageUrlsByPath: Record<string, string>;
}) {
  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => window.close()}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
      </div>

      <div className="text-[10.5px] leading-tight">
        {/* Logo + company info */}
        <div className="flex items-start justify-between">
          <div className="text-black">
            <p className="text-3xl font-bold tracking-tight">
              KOO<span style={{ color: "#2793a2" }}>N</span>WAY
            </p>
            <p className="mt-1 w-[230px] text-left text-[13px] font-semibold" style={{ color: "#2793a2" }}>
              Koonway Co.,Ltd. / บริษัท คูนเว จำกัด
            </p>
            <p>24/2-4 Sukhapiban 2 Prawet, Prawet, Bangkok 10250</p>
            <p>เลขที่ผู้เสียภาษี: 0-1055-5981-97-3</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Image src="/wallpod-logo.png" alt="WallPOD" width={70} height={32} className="h-8 w-auto" />
            <p className="underline">www.thewallpod.com</p>
            <p>(+66)91-524-4441</p>
            <Image src="/QR_code.png" alt="QR code" width={56} height={55} className="h-14 w-auto" />
          </div>
        </div>

        {/* Project name / date bar */}
        <div className="mt-2 flex items-center justify-between border border-black bg-[#373737] px-2 py-2 font-bold text-white">
          <span>Project name / ชื่อโครงการ : {quotation.projectName}</span>
          <span>วันที่ : {shortDate(quotation.quoteDate)}</span>
        </div>

        {/* Customer/document info grid — outer frame only, no internal
            row/column rules (kept plain deliberately, per feedback). */}
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr>
              <td className="w-[70%] p-1">Attn / ผู้ติดต่อ : {quotation.attn ?? "—"}</td>
              <td className="p-1">Quotation No. : {quotation.docNo}</td>
            </tr>
            <tr>
              <td className="p-1">Company Name / ชื่อบริษัทลูกค้า : {quotation.customerName}</td>
              <td className="p-1">JOB Number : {quotation.jobNumber ?? "—"}</td>
            </tr>
            <tr>
              <td className="p-1">Customer Address / ที่อยู่ผู้ซื้อ : {quotation.customerAddress ?? "—"}</td>
              <td className="p-1">PO. Number : {quotation.poNumber ?? "—"}</td>
            </tr>
            <tr>
              <td className="p-1">Tel. / เบอร์โทร : {quotation.customerTel ?? "—"}</td>
              <td className="p-1">Delivery Date / วันที่ส่งของ : {shortDate(quotation.deliveryDate)}</td>
            </tr>
            <tr>
              <td className="p-1">Tax ID/เลขที่ผู้เสียภาษี : {quotation.customerTaxId ?? "—"}</td>
              <td className="p-1">Remark /หมายเหตุ : {quotation.remark ?? "—"}</td>
            </tr>
          </tbody>
        </table>

        {/* Banner */}
        <div className="mt-2 border border-black bg-gray-400 py-1 text-center text-sm font-bold">
          QUOTATION / ใบแจ้งการผลิต / ใบแจ้งการจัดส่ง
        </div>

        {/* Items table */}
        <table className="w-full border-collapse border-r border-b border-l border-black text-center">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[30%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>
                ITEM
                <br />
                ลำดับ
              </th>
              <th className={th}>
                CODE
                <br />
                รหัสสินค้า
              </th>
              <th className={th}>
                PICTURE
                <br />
                รูปภาพ
              </th>
              <th className={th}>
                DESCRIPTION
                <br />
                รายละเอียด
              </th>
              <th className={th}>
                UNIT PRICE
                <br />
                ราคาต่อหน่วย
              </th>
              <th className={th}>
                DISCOUNT
                <br />
                ส่วนลด
              </th>
              <th className={th}>
                NET PRICE
                <br />
                ราคาหลังส่วนลด
              </th>
              <th className={th}>
                QTY.
                <br />
                จำนวน
              </th>
              <th className={th + " border-r-0"}>
                TOTAL PRICE
                <br />
                ราคารวม
              </th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((it, i, arr) => {
              const last = i === arr.length - 1;
              const rowTd = last ? td + " border-b-0" : td;
              return (
                <tr key={it.id}>
                  <td className={rowTd + " text-center"}>{i + 1}</td>
                  <td className={rowTd + " text-center whitespace-nowrap"}>{it.productCode ?? "—"}</td>
                  <td className={rowTd + " text-center"}>
                    {it.imagePath && imageUrlsByPath[it.imagePath] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private signed URL preview, not an optimizable remote asset
                      <img src={imageUrlsByPath[it.imagePath]} alt="" className="mx-auto h-16 w-16 object-cover" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={rowTd + " whitespace-pre-line text-left"}>{formatQuotationItemDescription(it)}</td>
                  <td className={rowTd + " text-right whitespace-nowrap"}>{num(it.unitPrice)}</td>
                  <td className={rowTd + " text-right whitespace-nowrap"}>
                    {it.discountPercent ? `${it.discountPercent}%` : "-"}
                  </td>
                  <td className={rowTd + " text-right whitespace-nowrap"}>{num(it.netPrice)}</td>
                  <td className={rowTd + " text-right whitespace-nowrap"}>
                    {it.qty} {it.unit}
                  </td>
                  <td className={(last ? td + " border-b-0" : td) + " border-r-0 text-right whitespace-nowrap font-medium"}>
                    {num(it.totalPrice)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Remark/disclaimers + totals */}
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-4 border border-black p-2">
          <div className="space-y-0.5">
            <p className="font-medium">Remake : หมายเหตุ :</p>
            {STANDARD_NOTES.map((line, i) => (
              <p key={i} className="font-bold text-red-600">
                {line}
              </p>
            ))}
            {quotation.priceValidity && (
              <p className="mt-1">Price Validity Period (กำหนดยืนราคา) : {quotation.priceValidity}</p>
            )}
          </div>
          <table className="w-56 self-start border-collapse border border-black">
            <tbody>
              <tr>
                <td className="border-b border-black px-1 py-0.5">Total/ยอดรวม</td>
                <td className="border-b border-black px-1 py-0.5 text-right">{num(quotation.preVat)}</td>
              </tr>
              <tr>
                <td className="border-b border-black px-1 py-0.5">Vate 7% /ภาษีมูลค่าเพิ่ม</td>
                <td className="border-b border-black px-1 py-0.5 text-right">{num(quotation.vat)}</td>
              </tr>
              <tr className="bg-[#043630] text-[11.5px] font-bold text-[#ffab27]">
                <td className="px-1 py-2 whitespace-nowrap">Grand Total/ยอดรวมทั้งสิ้น</td>
                <td className="px-1 py-2 text-right whitespace-nowrap">{num(quotation.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment terms + prepared by */}
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-4 border border-black p-2">
          <div>
            {quotation.paymentTerms.length > 0 && (
              <>
                <p className="font-medium">Terms of payment /เงื่อนไขการชำระเงิน:</p>
                <table className="mt-1 w-full max-w-md border-collapse">
                  <tbody>
                    {quotation.paymentTerms.map((term, i) => (
                      <tr key={i}>
                        <td className="py-0.5">
                          {i + 1}. {term.label}
                        </td>
                        <td className="py-0.5 text-right">{term.percent}%</td>
                        <td className="py-0.5 text-right">{num(term.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
          <div className="w-48 self-start text-right">
            <p className="font-medium">Prepared by/เสนอราคาโดย</p>
            <p>{quotation.salesRepName ?? "—"}</p>
          </div>
        </div>

        <p className="mt-2 border border-black bg-[#e3ebeb] p-2 text-[15px] font-bold">
          ชื่อบัญชี : บริษัท คูนเว จำกัด ธนาคารกรุงศรี : 403-0-00726-8
        </p>

        {/* Signatures — labels and date-lines are separate grid rows (not
            per-column stacks) so CSS Grid sizes each row to its tallest
            cell, keeping all 3 signature lines aligned even when a label
            wraps to 2 lines. */}
        <div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-8 text-center">
          <p className="self-end">Checked by /ตรวจสอบโดย</p>
          <p className="self-end">Pre-production rechecked and approved/ผู้อนุมัติผลิต</p>
          <p className="self-end">Customer Approved ยืนยันคำสั่งซื้อ</p>
          <p className="border-t border-black pt-1">Date :</p>
          <p className="border-t border-black pt-1">Date :</p>
          <p className="border-t border-black pt-1">Date :</p>
        </div>
      </div>
    </div>
  );
}
