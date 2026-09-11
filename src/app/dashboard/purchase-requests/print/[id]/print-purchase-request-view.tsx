"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import type { PurchaseRequest } from "@/lib/types";

const MIN_ITEM_ROWS = 4;

function thaiDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear() + 543).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function PrintPurchaseRequestView({
  request,
  showCosts: canSeeCosts,
}: {
  request: PurchaseRequest;
  showCosts: boolean;
}) {
  const [displayCosts, setDisplayCosts] = useState(canSeeCosts);
  const showCosts = canSeeCosts && displayCosts;
  const grandTotal = request.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const project = [request.jobNo, request.projectName].filter(Boolean).join("_");

  const rows = [...request.items];
  while (rows.length < MIN_ITEM_ROWS) {
    rows.push({
      id: `blank-${rows.length}`,
      stockProductId: null,
      productName: "",
      productSku: null,
      unit: "",
      quantity: 0,
      note: null,
      supplierId: null,
      supplierName: null,
      unitPrice: 0,
    });
  }

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex items-center justify-end gap-4 print:hidden">
        {canSeeCosts && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={displayCosts}
              onChange={(e) => setDisplayCosts(e.target.checked)}
              className="h-4 w-4"
            />
            แสดงราคา
          </label>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.close()}>
            ปิด
          </Button>
          <Button onClick={() => window.print()}>พิมพ์</Button>
          <DownloadPdfButton />
        </div>
      </div>

      <div className="text-[12px] leading-tight">
        {/* Header */}
        <div className="flex items-start justify-between">
          <Image src="/koonwaylogo.png" alt="KOONWAY" width={152} height={24} className="h-7 w-auto" priority />
          <p className="text-xl font-semibold">ใบขอซื้อ</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
          <p>
            <span className="font-medium">ผู้ขอซื้อ :</span> {request.requestedByName}
          </p>
          <p className="text-right">
            <span className="font-medium">เลขที่ :</span> {request.docNo}
          </p>
          <p>
            <span className="font-medium">ฝ่าย/แผนก :</span> {request.departmentName ?? "—"}
          </p>
          <p className="text-right">
            <span className="font-medium">วันที่ขอ :</span> {thaiDate(request.requestDate)}
          </p>
        </div>

        <p className="mt-2">
          <span className="font-medium">PROJECT :</span> {project || "—"}
        </p>
        <p>
          <span className="font-medium">No. Koonway</span> {request.koonwayRefNo ?? ""}
        </p>
        <p>
          <span className="font-medium">No. Flexiplan</span> {request.flexiplanRefNo ?? ""}
        </p>

        <div className="mt-2 space-y-0.5 text-[10px] text-neutral-600">
          <p>* กรณีต้องการสินค้าเร่งด่วนหรือเฉพาะที่ผู้ขายกำหนด โปรดแจ้งแผนกจัดซื้อ เพื่อความรวดเร็วในการจัดหา</p>
          <p>ก่อนทุกครั้งที่จะรวบรวมข้อกำหนดความต้องการ กรุณากรอกรายการและระบุของท่านให้ครบ</p>
          <p>**โปรดระบุรุ่น, ยี่ห้อและราคา หากทราบระบุให้ครบ</p>
        </div>

        {/* Items */}
        <table className="mt-2 w-full table-fixed border-collapse border border-black text-center">
          <colgroup>
            <col className="w-[6%]" />
            <col className="w-[34%]" />
            <col className="w-[22%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border border-black p-1 font-medium">ลำดับที่</th>
              <th className="border border-black p-1 font-medium">คำอธิบายสินค้าที่ต้องการซื้อ</th>
              <th className="border border-black p-1 font-medium">ผู้ขาย (Supplier)</th>
              <th className="border border-black p-1 font-medium">จำนวน</th>
              {showCosts && <th className="border border-black p-1 font-medium">ราคา:หน่วย</th>}
              {showCosts && <th className="border border-black p-1 font-medium">ราคารวม</th>}
              {!showCosts && <th className="border border-black p-1 font-medium" colSpan={2} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => (
              <tr key={item.id} className="h-8">
                <td className="border border-black p-1">{item.productName ? i + 1 : ""}</td>
                <td className="border border-black p-1 text-left">{item.productName}</td>
                <td className="border border-black p-1">{item.supplierName ?? ""}</td>
                <td className="border border-black p-1">
                  {item.productName ? `${item.quantity} ${item.unit}` : ""}
                </td>
                {showCosts && (
                  <td className="border border-black p-1 text-right">
                    {item.productName && item.unitPrice > 0 ? formatTHB(item.unitPrice) : ""}
                  </td>
                )}
                {showCosts && (
                  <td className="border border-black p-1 text-right">
                    {item.productName && item.unitPrice > 0 ? formatTHB(item.quantity * item.unitPrice) : ""}
                  </td>
                )}
                {!showCosts && <td className="border border-black p-1" colSpan={2} />}
              </tr>
            ))}
            <tr>
              <td className="border border-black p-1 text-left" colSpan={6}>
                <span className="font-medium">*หมายเหตุ/รายละเอียดส่วนประกอบอื่นๆ :</span> {request.note ?? ""}
              </td>
            </tr>
            {showCosts && (
              <tr>
                <td className="border border-black p-1 text-right font-medium" colSpan={4}>
                  รวมมูลค่าโดยประมาณ
                </td>
                <td className="border border-black p-1 text-right font-semibold" colSpan={2}>
                  {formatTHB(grandTotal)}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-2 gap-8 text-center">
          <div>
            <p>ลงชื่อ_______________________ผู้ขอซื้อ</p>
            <p className="mt-1">ด้วยบรรจง(_______________________)</p>
            <p className="mt-1">____/____/____</p>
          </div>
          <div>
            <p>ลงชื่อ_______________________ผู้อนุมัติ</p>
            <p className="mt-1">ด้วยบรรจง(_______________________)</p>
            <p className="mt-1">____/____/____</p>
          </div>
        </div>
      </div>
    </div>
  );
}
