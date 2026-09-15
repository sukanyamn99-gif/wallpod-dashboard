"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import type { PurchaseOrderReceipt } from "@/lib/types";

const MIN_ITEM_ROWS = 4;

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("th-TH");
}

// Renders the full document body once, labeled either "ต้นฉบับ" (original)
// or "สำเนา" (copy) — printed as two consecutive pages, same convention
// already used by the other print views in this app (ใบสั่งซื้อ, billing
// documents).
function DocumentBody({ receipt, copyLabel }: { receipt: PurchaseOrderReceipt; copyLabel: string }) {
  const totalValue = receipt.items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);

  const rows = [...receipt.items];
  while (rows.length < MIN_ITEM_ROWS) {
    rows.push({
      id: `blank-${rows.length}`,
      orderItemId: null,
      stockProductId: null,
      productName: "",
      productSku: null,
      unit: "",
      quantity: 0,
      unitCost: 0,
    });
  }

  return (
    <div className="flex min-h-[250mm] flex-col text-[12px] leading-tight">
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
            ใบรับสินค้า
          </p>
          <p className="text-xs text-neutral-500">{copyLabel}</p>
        </div>
      </div>

      {/* Doc info grid */}
      <div className="grid grid-cols-[3fr_2fr] gap-x-8 border-b border-black py-2">
        <div>
          <p className="font-medium">ผู้จำหน่าย</p>
          <p>{receipt.supplierName ?? "—"}</p>
          {receipt.supplierAddress && <p className="whitespace-pre-line text-neutral-600">{receipt.supplierAddress}</p>}
          {(receipt.supplierTaxId || receipt.supplierBranch) && (
            <p className="text-neutral-600">
              {receipt.supplierTaxId && <>เลขประจำตัวผู้เสียภาษี: {receipt.supplierTaxId}</>}
              {receipt.supplierTaxId && receipt.supplierBranch && <>&nbsp;|&nbsp;</>}
              {receipt.supplierBranch && <>สาขา: {receipt.supplierBranch}</>}
            </p>
          )}
        </div>
        <table className="ml-auto text-right">
          <tbody>
            <tr>
              <td className="pr-2 text-left text-neutral-500">เลขที่</td>
              <td className="font-medium">{receipt.docNo}</td>
            </tr>
            <tr>
              <td className="pr-2 text-left text-neutral-500">อ้างอิงใบสั่งซื้อ</td>
              <td>{receipt.orderDocNo}</td>
            </tr>
            <tr>
              <td className="pr-2 text-left text-neutral-500">วันที่</td>
              <td>{fmtDate(receipt.receiptDate)}</td>
            </tr>
            <tr>
              <td className="pr-2 text-left text-neutral-500">ผู้รับสินค้า</td>
              <td>{receipt.receivedByName}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Items */}
      <table className="mt-2 w-full table-fixed border-collapse border border-black text-center">
        <colgroup>
          <col className="w-[6%]" />
          <col className="w-[14%]" />
          <col className="w-[36%]" />
          <col className="w-[14%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#c8d7d6]">
            <th className="border border-black p-1 font-medium">ลำดับ</th>
            <th className="border border-black p-1 font-medium">รหัสสินค้า</th>
            <th className="border border-black p-1 font-medium">ชื่อสินค้า</th>
            <th className="border border-black p-1 font-medium">จำนวนที่รับ</th>
            <th className="border border-black p-1 font-medium">ต้นทุน/หน่วย</th>
            <th className="border border-black p-1 font-medium">มูลค่า</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => (
            // Only vertical (column) borders inside the body — the header
            // row's own border and the table's outer frame are the only
            // horizontal lines, matching the style already established for
            // ใบสั่งซื้อ's own items table.
            <tr key={item.id} className="h-8">
              <td className="border-r border-l border-black p-1">{item.productName ? i + 1 : ""}</td>
              <td className="border-r border-black p-1">{item.productSku ?? ""}</td>
              <td className="border-r border-black p-1 text-left">{item.productName}</td>
              <td className="border-r border-black p-1">
                {item.productName ? `${item.quantity} ${item.unit}` : ""}
              </td>
              <td className="border-r border-black p-1 text-right">
                {item.productName ? formatTHB(item.unitCost) : ""}
              </td>
              <td className="border-r border-black p-1 text-right">
                {item.productName ? formatTHB(item.quantity * item.unitCost) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {receipt.note && (
        <p className="mt-2 border border-black p-1.5 text-left">
          <span className="font-medium">หมายเหตุ :</span> {receipt.note}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 border-b border-black bg-[#c8d7d6] px-1 py-1.5">
        <span />
        <div className="flex w-72 shrink-0 justify-between font-bold">
          <span>มูลค่ารวมที่รับเข้า</span>
          <span>{formatTHB(totalValue)}</span>
        </div>
      </div>

      {/* Signatures — mt-auto pushes this to the bottom of the page (the
          wrapper above is a min-h-[250mm] flex column) instead of sitting
          right under the summary when the content is short. */}
      <div className="mt-auto grid grid-cols-2 gap-8 pt-10 text-center">
        <div>
          <p>ลงชื่อ_______________________ผู้ส่งสินค้า</p>
          <p className="mt-1">({receipt.supplierName ?? "_______________________"})</p>
          <p className="mt-1">วันที่ ____/____/____</p>
        </div>
        <div>
          <p>ลงชื่อ_______________________ผู้ตรวจรับสินค้า</p>
          <p className="mt-1">({receipt.receivedByName})</p>
          <p className="mt-1">วันที่ ____/____/____</p>
        </div>
      </div>
    </div>
  );
}

export function PrintPurchaseOrderReceiptView({ receipt }: { receipt: PurchaseOrderReceipt }) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" onClick={() => router.push("/dashboard/purchase-order-receipts")}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
        <DownloadPdfButton />
      </div>

      <div className="break-after-page">
        <DocumentBody receipt={receipt} copyLabel="ต้นฉบับ" />
      </div>
      <DocumentBody receipt={receipt} copyLabel="สำเนา" />
    </div>
  );
}
