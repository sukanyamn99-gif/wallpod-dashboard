"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import { thaiBahtText } from "@/lib/thai-baht-text";
import type { PurchaseOrder } from "@/lib/types";

const MIN_ITEM_ROWS = 4;

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("th-TH");
}

export function PrintPurchaseOrderView({ order }: { order: PurchaseOrder }) {
  const router = useRouter();

  const subtotal = order.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const afterDiscount = Math.max(0, Math.round((subtotal - order.discountAmount) * 100) / 100);
  const vat = Math.round(afterDiscount * 0.07 * 100) / 100;
  const totalAfterVat = Math.round((afterDiscount + vat) * 100) / 100;
  const whtAmount = Math.round((afterDiscount * (order.whtPercent / 100)) * 100) / 100;
  const netPayable = Math.round((totalAfterVat - whtAmount) * 100) / 100;

  const rows = [...order.items];
  while (rows.length < MIN_ITEM_ROWS) {
    rows.push({
      id: `blank-${rows.length}`,
      stockProductId: null,
      productName: "",
      productSku: null,
      unit: "",
      quantity: 0,
      unitPrice: 0,
      receivedQuantity: 0,
    });
  }

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => router.push("/dashboard/purchase-orders")}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="flex min-h-[277mm] flex-col text-[12px] leading-tight">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <Image src="/koonwaylogo.png" alt="KOONWAY" width={152} height={24} className="h-6 w-auto" priority />
            <p className="mt-1 font-semibold">บริษัท คูนเว จำกัด (สำนักงานใหญ่)</p>
            <p>24/2-4 สุขาภิบาล 2 แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250</p>
            <p>เลขประจำตัวผู้เสียภาษี 0-1055-59182-97-3</p>
            <p>โทร. 091-524-4441</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: "#2793a2" }}>
              ใบสั่งซื้อ
            </p>
          </div>
        </div>

        {/* Doc info grid */}
        <div className="grid grid-cols-[3fr_2fr] gap-x-8 border-b border-black py-2">
          <div>
            <p className="font-medium">ผู้จำหน่าย</p>
            <p>{order.supplierName ?? "—"}</p>
            {order.supplierAddress && <p className="whitespace-pre-line text-neutral-600">{order.supplierAddress}</p>}
            {(order.supplierTaxId || order.supplierBranch) && (
              <p className="text-neutral-600">
                {order.supplierTaxId && <>เลขประจำตัวผู้เสียภาษี: {order.supplierTaxId}</>}
                {order.supplierTaxId && order.supplierBranch && <>&nbsp;|&nbsp;</>}
                {order.supplierBranch && <>สาขา: {order.supplierBranch}</>}
              </p>
            )}
          </div>
          <table className="ml-auto text-right">
            <tbody>
              <tr>
                <td className="pr-2 text-left text-neutral-500">เลขที่</td>
                <td className="font-medium">{order.docNo}</td>
              </tr>
              <tr>
                <td className="pr-2 text-left text-neutral-500">อ้างอิงใบขอซื้อ</td>
                <td>{order.requestDocNo}</td>
              </tr>
              <tr>
                <td className="pr-2 text-left text-neutral-500">วันที่</td>
                <td>{fmtDate(order.orderDate)}</td>
              </tr>
              <tr>
                <td className="pr-2 text-left text-neutral-500">เครดิต</td>
                <td>{order.creditDays} วัน</td>
              </tr>
              <tr>
                <td className="pr-2 text-left text-neutral-500">ครบกำหนด</td>
                <td>{fmtDate(order.dueDate)}</td>
              </tr>
              <tr>
                <td className="pr-2 text-left text-neutral-500">ผู้สั่งซื้อ</td>
                <td>{order.orderedByName}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Items */}
        <table className="mt-2 w-full table-fixed border-collapse border border-black text-center">
          <colgroup>
            <col className="w-[6%]" />
            <col className="w-[38%]" />
            <col className="w-[12%]" />
            <col className="w-[15%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#c8d7d6]">
              <th className="border border-black p-1 font-medium">ลำดับ</th>
              <th className="border border-black p-1 font-medium">รายละเอียด</th>
              <th className="border border-black p-1 font-medium">จำนวน</th>
              <th className="border border-black p-1 font-medium">ราคาต่อหน่วย</th>
              <th className="border border-black p-1 font-medium">ภาษี</th>
              <th className="border border-black p-1 font-medium">หัก ณ ที่จ่าย</th>
              <th className="border border-black p-1 font-medium">มูลค่า</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => (
              <tr key={item.id} className="h-8">
                <td className="border border-black p-1">{item.productName ? i + 1 : ""}</td>
                <td className="border border-black p-1 text-left">
                  {item.productName}
                  {item.productSku && <span className="text-neutral-500"> ({item.productSku})</span>}
                </td>
                <td className="border border-black p-1">
                  {item.productName ? `${item.quantity} ${item.unit}` : ""}
                </td>
                <td className="border border-black p-1 text-right">
                  {item.productName ? formatTHB(item.unitPrice) : ""}
                </td>
                <td className="border border-black p-1">{item.productName ? "7%" : ""}</td>
                <td className="border border-black p-1">
                  {item.productName ? (order.whtPercent > 0 ? `${order.whtPercent}%` : "ไม่มี") : ""}
                </td>
                <td className="border border-black p-1 text-right">
                  {item.productName ? formatTHB(item.quantity * item.unitPrice) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {order.note && (
          <p className="mt-2 border border-black p-1.5 text-left">
            <span className="font-medium">หมายเหตุ :</span> {order.note}
          </p>
        )}

        {/* Summary */}
        <div className="flex justify-end pt-2">
          <table className="w-72">
            <tbody>
              <tr style={{ backgroundColor: "#cfd0d0" }}>
                <td className="py-0.5 text-neutral-600">รวมเป็นเงิน</td>
                <td className="py-0.5 text-right">{formatTHB(subtotal)}</td>
              </tr>
              {order.discountAmount > 0 && (
                <>
                  <tr>
                    <td className="py-0.5 text-red-600">หักส่วนลด</td>
                    <td className="py-0.5 text-right text-red-600">{formatTHB(order.discountAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 text-neutral-600">จำนวนเงินรวมหลังหักส่วนลด</td>
                    <td className="py-0.5 text-right">{formatTHB(afterDiscount)}</td>
                  </tr>
                </>
              )}
              <tr>
                <td className="py-0.5 text-neutral-600">มูลค่าที่ไม่มี/ยกเว้นภาษี</td>
                <td className="py-0.5 text-right">{formatTHB(0)}</td>
              </tr>
              <tr style={{ backgroundColor: "#cfd0d0" }}>
                <td className="py-0.5 text-neutral-600">มูลค่าที่คำนวณภาษี</td>
                <td className="py-0.5 text-right">{formatTHB(afterDiscount)}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-neutral-600">ภาษีมูลค่าเพิ่ม 7%</td>
                <td className="py-0.5 text-right">{formatTHB(vat)}</td>
              </tr>
              <tr style={{ backgroundColor: "#d8eceb" }}>
                <td className="py-0.5 font-medium">จำนวนเงินรวมทั้งสิ้น</td>
                <td className="py-0.5 text-right font-medium">{formatTHB(totalAfterVat)}</td>
              </tr>
              {order.whtPercent > 0 && (
                <tr>
                  <td className="py-0.5 text-red-600">หักภาษี ณ ที่จ่ายทั้งสิ้น ({order.whtPercent}%)</td>
                  <td className="py-0.5 text-right text-red-600">{formatTHB(whtAmount)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-black bg-[#c8d7d6] px-1 py-1.5">
          <p className="text-sm">({thaiBahtText(netPayable)})</p>
          <div className="flex w-72 shrink-0 justify-between font-bold">
            <span>ยอดชำระ</span>
            <span>{formatTHB(netPayable)}</span>
          </div>
        </div>

        {/* Signatures — mt-auto pushes this to the bottom of the page
            (the wrapper above is a min-h-[277mm] flex column) instead of
            sitting right under the summary when the content is short. */}
        <div className="mt-auto grid grid-cols-2 gap-8 pt-10 text-center">
          <div>
            <p>ลงชื่อ_______________________ผู้ขาย</p>
            <p className="mt-1">({order.supplierName ?? "_______________________"})</p>
            <p className="mt-1">วันที่ ____/____/____</p>
          </div>
          <div>
            <p>ลงชื่อ_______________________ผู้สั่งซื้อ/ผู้อนุมัติ</p>
            <p className="mt-1">บริษัท คูนเว จำกัด</p>
            <p className="mt-1">วันที่ ____/____/____</p>
          </div>
        </div>
      </div>
    </div>
  );
}
