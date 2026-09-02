"use client";

import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
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

// Every info-grid/table cell shares this border so the whole document reads
// as one continuous ruled form, matching the reference layout — only the
// outer-most table needs border-t/border-l since every inner cell already
// contributes its own border-r/border-b.
const cell = "border-r border-b border-black p-1";
const th = cell + " p-1.5 font-medium bg-gray-100 text-center";
const td = cell + " p-1.5";

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
          <div>
            <p className="text-3xl font-bold tracking-tight">
              KOO<span className="text-sky-600">N</span>WAY
            </p>
            <p className="mt-1 font-medium">Koonway Co.,Ltd. / บริษัท คูนเว จำกัด</p>
            <p>24/2-4 Sukhapiban 2 Prawet, Prawet, Bangkok 10250</p>
            <p>โทร (+66) 91-524-4441 — www.thewallpod.com</p>
            <p>เลขที่ผู้เสียภาษี: 0-1055-5981-97-3</p>
          </div>
          <div className="rounded border border-sky-600 px-3 py-1 text-center font-bold text-sky-600">WallPod</div>
        </div>

        {/* Project name / date bar */}
        <div className="mt-2 flex items-center justify-between border border-black bg-black px-2 py-1 font-bold text-white">
          <span>Project name / ชื่อโครงการ : {quotation.projectName}</span>
          <span>วันที่ : {shortDate(quotation.quoteDate)}</span>
        </div>

        {/* Customer/document info grid */}
        <table className="w-full border-collapse border-l border-black">
          <tbody>
            <tr>
              <td className={td + " w-1/2"}>Attn / ผู้ติดต่อ : {quotation.attn ?? "—"}</td>
              <td className={td}>Quotation No. : {quotation.docNo}</td>
            </tr>
            <tr>
              <td className={td}>Company Name / ชื่อบริษัทลูกค้า : {quotation.customerName}</td>
              <td className={td}>JOB Number : {quotation.jobNumber ?? "—"}</td>
            </tr>
            <tr>
              <td className={td}>Customer Address / ที่อยู่ผู้ซื้อ : {quotation.customerAddress ?? "—"}</td>
              <td className={td}>PO. Number : {quotation.poNumber ?? "—"}</td>
            </tr>
            <tr>
              <td className={td}>Tel. / เบอร์โทร : {quotation.customerTel ?? "—"}</td>
              <td className={td}>Delivery Date / วันที่ส่งของ : {shortDate(quotation.deliveryDate)}</td>
            </tr>
            <tr>
              <td className={td}>Tax ID/เลขที่ผู้เสียภาษี : {quotation.customerTaxId ?? "—"}</td>
              <td className={td}>Remark /หมายเหตุ : {quotation.remark ?? "—"}</td>
            </tr>
          </tbody>
        </table>

        {/* Banner */}
        <div className="border border-t-0 border-black bg-gray-200 py-1 text-center text-sm font-bold">
          QUOTATION / ใบแจ้งการผลิต / ใบแจ้งการจัดส่ง
        </div>

        {/* Items table */}
        <table className="w-full border-collapse border-l border-black text-center">
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
              <th className={th}>
                TOTAL PRICE
                <br />
                ราคารวม
              </th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((it, i) => (
              <tr key={it.id}>
                <td className={td + " text-center"}>{i + 1}</td>
                <td className={td + " text-center whitespace-nowrap"}>{it.productCode ?? "—"}</td>
                <td className={td + " text-center"}>
                  {it.imagePath && imageUrlsByPath[it.imagePath] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private signed URL preview, not an optimizable remote asset
                    <img src={imageUrlsByPath[it.imagePath]} alt="" className="mx-auto h-16 w-16 object-cover" />
                  ) : (
                    "—"
                  )}
                </td>
                <td className={td + " whitespace-pre-line text-left"}>{it.description}</td>
                <td className={td + " text-right whitespace-nowrap"}>{num(it.unitPrice)}</td>
                <td className={td + " text-right whitespace-nowrap"}>{it.discountPercent ? `${it.discountPercent}%` : "-"}</td>
                <td className={td + " text-right whitespace-nowrap"}>{num(it.netPrice)}</td>
                <td className={td + " text-right whitespace-nowrap"}>
                  {it.qty} {it.unit}
                </td>
                <td className={td + " text-right whitespace-nowrap font-medium"}>{num(it.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Remark/disclaimers + totals */}
        <div className="grid grid-cols-[1fr_auto] gap-4 border-r border-b border-l border-black p-2">
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
          <div className="w-56 space-y-0.5 self-start">
            <div className="flex justify-between">
              <span>Total/ยอดรวม</span>
              <span>{num(quotation.preVat)}</span>
            </div>
            <div className="flex justify-between">
              <span>Vate 7% /ภาษีมูลค่าเพิ่ม</span>
              <span>{num(quotation.vat)}</span>
            </div>
            <div className="flex justify-between bg-amber-300 px-1 py-0.5 font-bold">
              <span>Grand Total/ยอดรวมทั้งสิ้น</span>
              <span>{num(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment terms + prepared by */}
        <div className="grid grid-cols-[1fr_auto] gap-4 border-r border-b border-l border-black p-2">
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

        <p className="border-r border-b border-l border-black p-2">
          ชื่อบัญชี : บริษัท คูนเว จำกัด ธนาคารกรุงศรี : 403-0-00726-8
        </p>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="space-y-8">
            <p>Checked by /ตรวจสอบโดย</p>
            <p className="border-t border-black pt-1">Date :</p>
          </div>
          <div className="space-y-8">
            <p>Pre-production rechecked and approved/ผู้อนุมัติผลิต</p>
            <p className="border-t border-black pt-1">Date :</p>
          </div>
          <div className="space-y-8">
            <p>Customer Approved ยืนยันคำสั่งซื้อ</p>
            <p className="border-t border-black pt-1">Date :</p>
          </div>
        </div>
      </div>
    </div>
  );
}
