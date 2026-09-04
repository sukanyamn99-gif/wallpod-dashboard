"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
import { REQUISITION_PURPOSE_LABELS } from "@/lib/types";
import type { StockRequisition } from "@/lib/types";

const MIN_ITEM_ROWS = 6;
const SIGNATURE_BLOCKS = ["ผู้เบิก", "ผู้อนุมัติ", "ผู้จ่ายสินค้า (สโตร์)"];

export function PrintRequisitionView({
  requisition,
  showCosts: canSeeCosts,
}: {
  requisition: StockRequisition;
  // Permission (role-based) — whether cost data is present at all. A
  // separate displayCosts toggle below lets someone who CAN see costs
  // still choose to print without them (e.g. a copy for another
  // department); someone without permission never gets the toggle.
  showCosts: boolean;
}) {
  const [displayCosts, setDisplayCosts] = useState(canSeeCosts);
  const showCosts = canSeeCosts && displayCosts;
  const totalValue = requisition.items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
  const hasAnyCost = requisition.items.some((it) => it.unitCost > 0);
  const hasEstimatedCost = requisition.items.some((it) => it.isEstimatedCost);

  const rows = [...requisition.items];
  while (rows.length < MIN_ITEM_ROWS) {
    rows.push({
      id: `blank-${rows.length}`,
      stockProductId: null,
      productName: "",
      productSku: null,
      quantity: 0,
      unit: "",
      unitCost: 0,
      isEstimatedCost: false,
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
            แสดงต้นทุน
          </label>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.close()}>
            ปิด
          </Button>
          <Button onClick={() => window.print()}>พิมพ์</Button>
        </div>
      </div>

      <div className="border border-black text-[13px] leading-tight">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-black p-3">
          <div>
            <Image src="/koonwaylogo.png" alt="KOONWAY" width={228} height={36} className="h-9 w-auto" priority />
            <p className="mt-1">บริษัท คูนเว จำกัด</p>
            <p>เลขที่ 24/2-4 ถนนสุขาภิบาล 2</p>
            <p>แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250</p>
          </div>
          <div className="text-right">
            <p className="font-medium">เลขที่เอกสาร / Doc No.</p>
            <p className="text-lg font-semibold">{requisition.docNo}</p>
          </div>
        </div>

        <div className="border-b border-black p-2 text-center text-lg font-semibold">
          ใบเบิกสินค้า / STOCK REQUISITION
        </div>

        {/* Doc info — outer border only, no internal row/column rules (matches
            the quotation print view's customer-info grid convention). */}
        <div className="grid grid-cols-2 border-b border-black">
          <p className="p-2">วันที่ /Date : {new Date(requisition.createdAt).toLocaleDateString("th-TH")}</p>
          <p className="p-2">ชื่องาน /โครงการ : {requisition.projectName ?? "—"}</p>
          <p className="p-2">แผนก /Department : {requisition.departmentName ?? "—"}</p>
          <p className="p-2">วัตถุประสงค์ /Purpose : {REQUISITION_PURPOSE_LABELS[requisition.purpose]}</p>
          <p className="p-2">ผู้เบิก /Requested by : {requisition.requestedByName}</p>
          <p className="p-2">ลูกค้า /Customer : {requisition.customerName ?? "—"}</p>
          <p className="p-2">เลข JOB : {requisition.jobNo ?? "—"}</p>
          <p className="p-2">หมายเหตุ /Note : {requisition.note ?? "—"}</p>
        </div>

        {/* Items */}
        <table className="w-full border-collapse border-b border-black text-center">
          <thead>
            <tr>
              <th className="w-10 border-r border-black p-1 font-medium">ลำดับ</th>
              <th className="w-24 border-r border-black p-1 font-medium">รหัสสินค้า</th>
              <th className="border-r border-black p-1 font-medium">ชื่อสินค้า</th>
              <th className="w-20 border-r border-black p-1 font-medium">จำนวน</th>
              <th className={showCosts ? "w-16 border-r border-black p-1 font-medium" : "w-16 p-1 font-medium"}>
                หน่วย
              </th>
              {showCosts && (
                <th className="w-24 border-r border-black p-1 font-medium">ต้นทุน/หน่วย</th>
              )}
              {showCosts && <th className="w-24 p-1 font-medium">รวม</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => (
              <tr key={item.id} className="h-7">
                <td className="border-r border-t border-black p-1">{item.productName ? i + 1 : ""}</td>
                <td className="border-r border-t border-black p-1">{item.productSku ?? ""}</td>
                <td className="border-r border-t border-black p-1 text-left">{item.productName}</td>
                <td className="border-r border-t border-black p-1">{item.productName ? item.quantity : ""}</td>
                <td className={showCosts ? "border-r border-t border-black p-1" : "border-t border-black p-1"}>
                  {item.unit}
                </td>
                {showCosts && (
                  <td className="border-r border-t border-black p-1 text-right">
                    {item.productName && item.unitCost > 0
                      ? `${formatTHB(item.unitCost)}${item.isEstimatedCost ? "*" : ""}`
                      : ""}
                  </td>
                )}
                {showCosts && (
                  <td className="border-t border-black p-1 text-right">
                    {item.productName && item.unitCost > 0
                      ? `${formatTHB(item.quantity * item.unitCost)}${item.isEstimatedCost ? "*" : ""}`
                      : ""}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {showCosts && (
          <div className="border-b border-black p-2 text-right">
            {hasAnyCost ? (
              <>
                <span className="font-medium">มูลค่ารวม : </span>
                <span className="font-semibold">{formatTHB(totalValue)}</span>
                {hasEstimatedCost && (
                  <p className="mt-1 text-[10px] text-neutral-500">
                    * ประมาณจากต้นทุน/หน่วยปัจจุบันของสินค้า (ใบเบิกนี้บันทึกก่อนระบบเริ่มบันทึกราคาต้นทุน ณ วันที่เบิกจริง)
                  </p>
                )}
              </>
            ) : (
              <span className="text-neutral-500">ไม่มีข้อมูลต้นทุน</span>
            )}
          </div>
        )}

        {/* Signatures */}
        <table className="w-full border-collapse text-center">
          <tbody>
            <tr>
              {SIGNATURE_BLOCKS.map((label, i) => (
                <td
                  key={label}
                  className={i < SIGNATURE_BLOCKS.length - 1 ? "border-r border-black p-2" : "p-2"}
                  style={{ height: 80 }}
                >
                  <p className="mb-10 font-medium">{label}</p>
                  <p className="border-t border-black pt-1">วันที่ :</p>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
