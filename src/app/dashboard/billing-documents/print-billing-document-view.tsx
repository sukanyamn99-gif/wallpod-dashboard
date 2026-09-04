"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
import { thaiBahtText } from "@/lib/thai-baht-text";
import { computeBillingDocumentSummary } from "@/lib/billing-document-summary";
import { BILLING_DOCUMENT_LABELS } from "@/lib/types";
import type { BillingDocumentDetail } from "@/lib/types";

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("th-TH");
}

// Renders the full document body once, labeled either "ต้นฉบับ" (original)
// or "สำเนา" (copy) — printed as two consecutive pages (see the two calls
// below), the standard convention for Thai billing/tax documents.
function DocumentBody({ document, copyLabel }: { document: BillingDocumentDetail; copyLabel: string }) {
  const summary = computeBillingDocumentSummary(
    document.items.map((it) => it.amount),
    document.discountAmount,
    document.whtPercent,
    document.retentionPercent,
  );
  const title = BILLING_DOCUMENT_LABELS[document.docType];
  // Shown once in the header instead of repeated per group inside the
  // items table — manual lines have no real underlying document, so
  // they're excluded. Just the reference number(s), no date.
  const referenceNos = Array.from(
    new Set(document.items.filter((it) => !it.manualDescription).map((it) => it.invoiceNo)),
  ).join(", ");

  return (
    <div className="text-[13px] leading-tight">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-3xl font-bold tracking-tight">
            KOO<span style={{ color: "#2793a2" }}>N</span>WAY
          </p>
          <p className="mt-1 font-semibold">บริษัท คูนเว จำกัด (สำนักงานใหญ่)</p>
          <p>24/2-4 สุขาภิบาล 2 แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250</p>
          <p>เลขประจำตัวผู้เสียภาษี 0-1055-59182-97-3</p>
          <p>โทร. 091-524-4441</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold" style={{ color: "#2793a2" }}>
            {title}
          </p>
          {/* ใบแจ้งหนี้/ใบกำกับภาษี share the same INV-prefixed doc number
              series, so this clarifies which one a printed page is. */}
          {document.docType === "invoice" && <p className="text-xs text-black">(ไม่ใช่ใบกำกับภาษี)</p>}
          <p className="text-xs text-neutral-500">{copyLabel}</p>
        </div>
      </div>

      {/* Doc info grid */}
      <div className="grid grid-cols-2 gap-x-8 border-b border-black py-2">
        <div>
          <p className="font-medium">ลูกค้า</p>
          <p>{document.customerName}</p>
          {document.customerAddress && <p className="text-neutral-600">{document.customerAddress}</p>}
          <p className="text-neutral-600">
            เลขประจำตัวผู้เสียภาษี: {document.customerTaxId ?? "—"}
            {document.customerPhone && <> &nbsp;|&nbsp; โทร. {document.customerPhone}</>}
          </p>
        </div>
        <table className="ml-auto text-right">
          <tbody>
            <tr>
              <td className="pr-2 text-left text-neutral-500">เลขที่</td>
              <td className="font-medium">{document.docNo}</td>
            </tr>
            <tr>
              <td className="pr-2 text-left text-neutral-500">วันที่</td>
              <td>{fmtDate(document.docDate)}</td>
            </tr>
            <tr>
              <td className="pr-2 text-left text-neutral-500">เครดิต</td>
              <td>{document.creditDays} วัน</td>
            </tr>
            <tr>
              <td className="pr-2 text-left text-neutral-500">ครบกำหนด</td>
              <td>{fmtDate(document.dueDate)}</td>
            </tr>
            <tr>
              <td className="pr-2 text-left text-neutral-500">ผู้ขาย</td>
              <td>{document.salesRepName ?? "—"}</td>
            </tr>
            {(document.docType === "invoice" || document.docType === "tax_invoice") && referenceNos && (
              <tr>
                <td className="pr-2 text-left text-neutral-500">เลขที่อ้างอิง</td>
                <td>{referenceNos}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Items — ใบแจ้งหนี้/ใบกำกับภาษี itemize each line's actual products
          (see BillingDocumentItem.quotationItems); ใบวางบิล/ใบเสร็จรับเงิน
          keep the plain one-row-per-invoice summary table. */}
      {document.docType === "invoice" || document.docType === "tax_invoice" ? (
        <table className="w-full border-collapse border border-black text-center">
          <thead>
            <tr className="bg-neutral-100">
              <th className="w-10 border-r border-black p-1.5 font-medium">ลำดับ</th>
              <th className="border-r border-black p-1.5 font-medium text-left">รายละเอียด</th>
              <th className="w-16 border-r border-black p-1.5 font-medium">จำนวน</th>
              <th className="w-24 border-r border-black p-1.5 font-medium">ราคาต่อหน่วย</th>
              <th className="w-28 p-1.5 font-medium">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Plain running sequence across every product line (1, 2, 3, …)
              // regardless of which invoice/quotation it's grouped under —
              // group header and subtotal rows don't get a number.
              let seq = 0;
              return document.items.map((it) => {
                // Typed directly into the document — no underlying invoice
                // or quotation to group under, so it's just one plain row.
                if (it.manualDescription) {
                  seq += 1;
                  return (
                    <tr key={it.id}>
                      <td className="border-r border-t border-black p-1.5">{seq}</td>
                      <td className="border-r border-t border-black p-1.5 text-left whitespace-pre-line">
                        {it.manualDescription}
                      </td>
                      <td className="border-r border-t border-black p-1.5">
                        {it.manualQty} {it.manualUnit}
                      </td>
                      <td className="border-r border-t border-black p-1.5 text-right">
                        {formatTHB(it.manualUnitPrice ?? 0)}
                      </td>
                      <td className="border-t border-black p-1.5 text-right">{formatTHB(it.amount)}</td>
                    </tr>
                  );
                }
                const detail = it.quotationItems;
                // Items billed directly from a quotation (no invoice behind
                // them yet) are labeled "ใบเสนอราคา", not "เลขที่เอกสาร".
                const refLabel = it.quotationId ? "ใบเสนอราคา" : "เลขที่เอกสาร";
                if (!detail || detail.length === 0) {
                  // No matching quotation found for this invoice's JOB —
                  // fall back to a single summary row so nothing is lost.
                  seq += 1;
                  return (
                    <tr key={it.id}>
                      <td className="border-r border-t border-black p-1.5">{seq}</td>
                      <td className="border-r border-t border-black p-1.5 text-left whitespace-pre-line">
                        {refLabel} {it.invoiceNo} ลงวันที่ {fmtDate(it.invoiceDate)}
                      </td>
                      <td className="border-r border-t border-black p-1.5">—</td>
                      <td className="border-r border-t border-black p-1.5 text-right">—</td>
                      <td className="border-t border-black p-1.5 text-right">{formatTHB(it.amount)}</td>
                    </tr>
                  );
                }
                return (
                  <Fragment key={it.id}>
                    {detail.map((qi, qidx) => {
                      seq += 1;
                      // Label:value rows, aligned in a fixed-width label
                      // column so every line lines up — same idea as the
                      // reference "DESCRIPTION" block, kept in one cell
                      // instead of splitting into separate table columns.
                      const specRows: { label: string; value: string | null }[] = [
                        { label: "Product Name", value: qi.productName },
                        { label: "Thickness /หนา", value: qi.thickness },
                        { label: "Size /ขนาด", value: qi.size },
                        { label: "Color/สี", value: qi.color },
                      ];
                      return (
                        <tr key={qidx}>
                          <td className="border-r border-t border-black p-1.5">{seq}</td>
                          <td className="border-r border-t border-black p-1.5 text-left">
                            {qi.productCode && <p className="text-neutral-500">[{qi.productCode}]</p>}
                            {specRows
                              .filter((row) => row.value)
                              .map((row) => (
                                <div key={row.label} className="flex gap-1">
                                  <span className="w-28 shrink-0 text-neutral-500">{row.label} :</span>
                                  <span className="font-medium">{row.value}</span>
                                </div>
                              ))}
                          </td>
                          <td className="border-r border-t border-black p-1.5">
                            {qi.qty} {qi.unit}
                          </td>
                          <td className="border-r border-t border-black p-1.5 text-right">{formatTHB(qi.unitPrice)}</td>
                          <td className="border-t border-black p-1.5 text-right">{formatTHB(qi.totalPrice)}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="border-r border-t border-black p-1.5"></td>
                      <td colSpan={3} className="border-r border-t border-black p-1.5 text-right text-neutral-600">
                        ยอดรวมตามเอกสาร {it.invoiceNo}
                      </td>
                      <td className="border-t border-black p-1.5 text-right font-medium">{formatTHB(it.amount)}</td>
                    </tr>
                  </Fragment>
                );
              });
            })()}
          </tbody>
        </table>
      ) : (
        <table className="w-full border-collapse border border-black text-center">
          <thead>
            <tr className="bg-neutral-100">
              <th className="w-10 border-r border-black p-1.5 font-medium">ลำดับ</th>
              <th className="border-r border-black p-1.5 font-medium">เลขที่เอกสาร</th>
              <th className="w-32 border-r border-black p-1.5 font-medium">เอกสารวันที่</th>
              <th className="w-32 p-1.5 font-medium">ยอดรวมตามเอกสาร</th>
            </tr>
          </thead>
          <tbody>
            {document.items.map((it, i) => (
              <tr key={it.id}>
                <td className="border-r border-t border-black p-1.5">{i + 1}</td>
                <td className="border-r border-t border-black p-1.5">
                  {it.invoiceNo}
                  {it.quotationId && <div className="text-xs text-neutral-500">(ใบเสนอราคา)</div>}
                  {it.manualDescription && <div className="text-xs text-neutral-500">(รายการที่พิมพ์เอง)</div>}
                </td>
                <td className="border-r border-t border-black p-1.5">{fmtDate(it.invoiceDate)}</td>
                <td className="border-t border-black p-1.5 text-right">{formatTHB(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Summary */}
      <div className="flex justify-end py-2">
        <table className="w-72">
          <tbody>
            <tr>
              <td className="py-0.5 text-neutral-600">รวมเป็นเงิน</td>
              <td className="py-0.5 text-right">{formatTHB(summary.subtotal)}</td>
            </tr>
            {summary.discountAmount > 0 && (
              <>
                <tr>
                  <td className="py-0.5 text-red-600">หักส่วนลด</td>
                  <td className="py-0.5 text-right text-red-600">{formatTHB(summary.discountAmount)}</td>
                </tr>
                <tr>
                  <td className="py-0.5 text-neutral-600">จำนวนเงินรวมหลังหักส่วนลด</td>
                  <td className="py-0.5 text-right">{formatTHB(summary.afterDiscount)}</td>
                </tr>
              </>
            )}
            <tr>
              <td className="py-0.5 text-neutral-600">ภาษีมูลค่าเพิ่ม 7%</td>
              <td className="py-0.5 text-right">{formatTHB(summary.vat)}</td>
            </tr>
            <tr>
              <td className="py-0.5 font-medium">จำนวนเงินรวม</td>
              <td className="py-0.5 text-right font-medium">{formatTHB(summary.totalAfterVat)}</td>
            </tr>
            {document.whtPercent > 0 && (
              <tr>
                <td className="py-0.5 text-red-600">หัก ณ ที่จ่าย {document.whtPercent}%</td>
                <td className="py-0.5 text-right text-red-600">{formatTHB(summary.whtAmount)}</td>
              </tr>
            )}
            {document.retentionPercent > 0 && (
              <tr>
                <td className="py-0.5 text-red-600">หักประกันผลงาน {document.retentionPercent}%</td>
                <td className="py-0.5 text-right text-red-600">{formatTHB(summary.retentionAmount)}</td>
              </tr>
            )}
            <tr className="bg-neutral-100">
              <td className="px-1 py-1.5 font-bold">จำนวนเงินรวมทั้งสิ้น</td>
              <td className="px-1 py-1.5 text-right font-bold">{formatTHB(summary.netPayable)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="border-t border-black pt-2 text-sm">({thaiBahtText(summary.netPayable)})</p>

      {document.note && (
        <p className="mt-2 text-sm">
          <span className="text-neutral-500">หมายเหตุ:</span> {document.note}
        </p>
      )}

      {/* Signatures — ใบแจ้งหนี้/ใบวางบิล get the "ในนาม" + KOONWAY-logo
          layout; other doc types keep the plain two-signature footer. */}
      {document.docType === "invoice" || document.docType === "billing_note" ? (
        <div className="mt-10 grid grid-cols-[1fr_auto_1fr] items-start gap-4 text-center text-sm">
          <div>
            <p>ในนาม {document.customerName}</p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <p className="border-t border-black pt-1">ผู้รับวางบิล</p>
              <p className="border-t border-black pt-1">วันที่</p>
            </div>
          </div>
          <div className="px-4">
            <p className="text-xl font-bold tracking-tight">
              KOO<span style={{ color: "#2793a2" }}>N</span>WAY
            </p>
            <p className="text-xs text-neutral-500">KoonWay Company Limited</p>
          </div>
          <div>
            <p>ในนาม บริษัท คูนเว จำกัด</p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <p className="border-t border-black pt-1">ผู้วางบิล</p>
              <p className="border-t border-black pt-1">วันที่</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-8 text-center">
          <div className="space-y-8">
            <p>ผู้รับวางบิล</p>
            <p className="border-t border-black pt-1">วันที่ :</p>
          </div>
          <div className="space-y-8">
            <p>ผู้วางบิล</p>
            <p className="border-t border-black pt-1">วันที่ :</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function PrintBillingDocumentView({
  document,
  editHref,
  closeHref,
}: {
  document: BillingDocumentDetail;
  editHref?: string;
  closeHref: string;
}) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black print:p-0">
      <div className="mb-4 flex justify-end gap-2 print:hidden">
        {editHref && (
          <Button variant="outline" nativeButton={false} render={<Link href={editHref} />}>
            แก้ไข
          </Button>
        )}
        {/* Reached via router.push/Link in the same tab (never a
            script-opened window), so window.close() is a silent no-op.
            router.back() also isn't reliable here — a page opened fresh
            (direct link, refresh) has no history to go back to, which made
            this button appear to do nothing — so navigate to this
            document's own list page explicitly instead. */}
        <Button variant="outline" onClick={() => router.push(closeHref)}>
          ปิด
        </Button>
        <Button onClick={() => window.print()}>พิมพ์</Button>
      </div>

      {/* Printed as two consecutive pages: ต้นฉบับ (original) for the
          customer, สำเนา (copy) kept on file — standard practice for this
          kind of document. break-after-page only affects print output; on
          screen both copies simply stack. */}
      <div className="break-after-page">
        <DocumentBody document={document} copyLabel="ต้นฉบับ" />
      </div>
      <DocumentBody document={document} copyLabel="สำเนา" />
    </div>
  );
}
