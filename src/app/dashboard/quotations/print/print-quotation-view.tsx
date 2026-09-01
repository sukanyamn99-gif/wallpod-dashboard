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

const th = "border-r border-b border-black p-1.5 font-medium whitespace-nowrap bg-gray-100";
const td = "border-r border-b border-black p-1.5";

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

      <div className="text-[11px] leading-tight">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <p className="text-3xl font-bold tracking-tight">
              KOO<span className="text-sky-600">N</span>WAY
            </p>
            <p className="mt-1 font-medium">Koonway Co.,Ltd. / บริษัท คูนเว จำกัด</p>
            <p className="text-muted-foreground">24/2-4 Sukhapiban 2 Prawet, Prawet, Bangkok 10250</p>
            <p className="text-muted-foreground">โทร (+66) 91-524-4441 — www.thewallpod.com</p>
            <p className="text-muted-foreground">เลขที่ผู้เสียภาษี: 0-1055-5981-97-3</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">QUOTATION / ใบเสนอราคา</p>
            <p>เลขที่ใบเสนอราคา: {quotation.docNo}</p>
            <p>วันที่: {shortDate(quotation.quoteDate)}</p>
            <p>JOB Number: {quotation.jobNumber ?? "—"}</p>
            <p>PO. Number: {quotation.poNumber ?? "—"}</p>
            <p>วันที่ส่งของ: {shortDate(quotation.deliveryDate)}</p>
          </div>
        </div>

        {/* Customer block */}
        <div className="mt-2 grid grid-cols-2 gap-x-6 border-b border-black pb-2">
          <p>ชื่อโครงการ / Project name: {quotation.projectName}</p>
          <p>Attn / ผู้ติดต่อ: {quotation.attn ?? "—"}</p>
          <p>บริษัทลูกค้า / Company Name: {quotation.customerName}</p>
          <p>เบอร์โทร / Tel: {quotation.customerTel ?? "—"}</p>
          <p className="col-span-2">ที่อยู่ / Address: {quotation.customerAddress ?? "—"}</p>
          <p>เลขที่ผู้เสียภาษี / Tax ID: {quotation.customerTaxId ?? "—"}</p>
        </div>

        {/* Items table */}
        <table className="mt-3 w-full border-collapse border-t border-l border-black text-center">
          <thead>
            <tr>
              <th className={th}>ลำดับ</th>
              <th className={th}>รูปภาพ</th>
              <th className={th}>รหัสสินค้า</th>
              <th className={th}>รายละเอียด</th>
              <th className={th}>ราคาต่อหน่วย</th>
              <th className={th}>ส่วนลด</th>
              <th className={th}>ราคาหลังส่วนลด</th>
              <th className={th}>จำนวน</th>
              <th className={th}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((it, i) => (
              <tr key={it.id}>
                <td className={td + " text-center"}>{i + 1}</td>
                <td className={td + " text-center"}>
                  {it.imagePath && imageUrlsByPath[it.imagePath] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private signed URL preview, not an optimizable remote asset
                    <img src={imageUrlsByPath[it.imagePath]} alt="" className="mx-auto h-16 w-16 object-cover" />
                  ) : (
                    "—"
                  )}
                </td>
                <td className={td + " text-center whitespace-nowrap"}>{it.productCode ?? "—"}</td>
                <td className={td + " whitespace-pre-line text-left"}>{it.description}</td>
                <td className={td + " text-right whitespace-nowrap"}>{num(it.unitPrice)}</td>
                <td className={td + " text-right whitespace-nowrap"}>{it.discountPercent}%</td>
                <td className={td + " text-right whitespace-nowrap"}>{num(it.netPrice)}</td>
                <td className={td + " text-right whitespace-nowrap"}>
                  {it.qty} {it.unit}
                </td>
                <td className={td + " text-right whitespace-nowrap font-medium"}>{num(it.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Remark + totals */}
        <div className="mt-2 grid grid-cols-2 gap-6">
          <div>
            {quotation.remark && (
              <p>
                <span className="font-medium">หมายเหตุ:</span> {quotation.remark}
              </p>
            )}
            {quotation.priceValidity && (
              <p>
                <span className="font-medium">กำหนดยืนราคา:</span> {quotation.priceValidity}
              </p>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span>รวมเป็นเงิน / Total</span>
              <span>{num(quotation.preVat)}</span>
            </div>
            <div className="flex justify-between">
              <span>ภาษีมูลค่าเพิ่ม 7% / Vat</span>
              <span>{num(quotation.vat)}</span>
            </div>
            <div className="flex justify-between border-t border-black pt-0.5 text-sm font-bold">
              <span>รวมทั้งสิ้น / Grand Total</span>
              <span>{num(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment terms */}
        {quotation.paymentTerms.length > 0 && (
          <div className="mt-3">
            <p className="font-medium">เงื่อนไขการชำระเงิน / Terms of payment</p>
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
          </div>
        )}

        <p className="mt-2 text-muted-foreground">ชื่อบัญชี: บริษัท คูนเว จำกัด ธนาคารกรุงศรี เลขที่บัญชี 403-0-00726-8</p>

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="space-y-8">
            <p>Checked by / ตรวจสอบโดย</p>
            <p className="border-t border-black pt-1">Date:</p>
          </div>
          <div className="space-y-8">
            <p>Pre-production rechecked and approved / ผู้อนุมัติผลิต</p>
            <p className="border-t border-black pt-1">Date:</p>
          </div>
          <div className="space-y-8">
            <p>Customer Approved / ยืนยันคำสั่งซื้อ</p>
            <p className="border-t border-black pt-1">Date:</p>
          </div>
        </div>

        <p className="mt-4 text-right text-muted-foreground">
          Prepared by / เสนอราคาโดย: {quotation.salesRepName ?? "—"}
        </p>
      </div>
    </div>
  );
}
