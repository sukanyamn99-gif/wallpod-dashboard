"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";
import { formatTHB } from "@/lib/format";
import { thaiBahtText } from "@/lib/thai-baht-text";
import { computeBillingDocumentSummary } from "@/lib/billing-document-summary";
import { BILLING_DOCUMENT_LABELS } from "@/lib/types";
import type { BillingDocumentDetail, PaymentMethod } from "@/lib/types";

const PAYMENT_METHODS: PaymentMethod[] = ["เงินสด", "เช็ค", "โอนเงิน", "บัตรเครดิต"];

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("th-TH");
}

// Renders the full document body once, labeled either "ต้นฉบับ" (original)
// or "สำเนา" (copy) — printed as two consecutive pages (see the two calls
// below), the standard convention for Thai billing/tax documents.
function DocumentBody({ document, copyLabel }: { document: BillingDocumentDetail; copyLabel: string }) {
  const title = BILLING_DOCUMENT_LABELS[document.docType];
  // ใบวางบิล/ใบเสร็จรับเงิน bundle several already-invoiced documents and
  // need to show each one's own WHT deduction and net collectible amount —
  // ใบแจ้งหนี้/ใบกำกับภาษี itemize actual products instead (see below).
  const isCollectionDoc = document.docType === "billing_note" || document.docType === "receipt";
  // The itemized (invoice/tax_invoice) summary must reconcile exactly with
  // the real product lines printed above it, not with whatever
  // billing_note_items.amount currently holds — that's one hop removed
  // from the truth and can silently drift out of sync with the quotation's
  // own product data (amount is meant to track this document's own net
  // payable for OTHER documents that reference it, not to be the source of
  // truth for its own printed total). Deriving fresh from quotationItems
  // makes this printout self-consistent and self-healing regardless of
  // that drift.
  const summaryItems = document.items.map((it) => {
    if (isCollectionDoc) return { amount: it.amount, applyWht: it.applyWht };
    if (it.manualDescription) {
      return {
        amount: Math.round((it.manualQty ?? 0) * (it.manualUnitPrice ?? 0) * 1.07 * 100) / 100,
        applyWht: it.applyWht,
      };
    }
    if (it.quotationItems && it.quotationItems.length > 0) {
      const preVatSum = it.quotationItems.reduce((sum, qi) => sum + qi.totalPrice, 0);
      return { amount: Math.round(preVatSum * 1.07 * 100) / 100, applyWht: it.applyWht };
    }
    // No itemized detail available (e.g. no matching quotation found) —
    // amount is the best figure left to fall back to.
    return { amount: it.amount, applyWht: it.applyWht };
  });
  const summary = computeBillingDocumentSummary(
    summaryItems,
    document.discountAmount,
    document.whtPercent,
    document.retentionPercent,
  );
  // Shown once in the header instead of repeated per group inside the
  // items table — manual lines have no real underlying document, so
  // they're excluded. Just the reference number(s), no date.
  const referenceNos = Array.from(
    new Set(document.items.filter((it) => !it.manualDescription).map((it) => it.invoiceNo)),
  ).join(", ");

  return (
    <div className="flex min-h-[277mm] flex-col text-[13px] leading-tight">
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
            {title}
          </p>
          {/* ใบแจ้งหนี้/ใบกำกับภาษี share the same INV-prefixed doc number
              series, so this clarifies which one a printed page is. */}
          {document.docType === "invoice" && <p className="text-xs text-black">(ไม่ใช่ใบกำกับภาษี)</p>}
          <p className="text-xs text-neutral-500">{copyLabel}</p>
        </div>
      </div>

      {/* Doc info grid */}
      <div className="grid grid-cols-[3fr_2fr] gap-x-8 border-b border-black py-2">
        <div>
          <p className="font-medium">ลูกค้า</p>
          <p>{document.customerName}</p>
          {document.customerAddress && (
            <p className="whitespace-nowrap text-neutral-600">{document.customerAddress}</p>
          )}
          <p className="text-neutral-600">
            เลขประจำตัวผู้เสียภาษี: {document.customerTaxId ?? ""}
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
              <td>{document.salesRepName ?? ""}</td>
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
            <tr className="bg-[#c8d7d6]">
              <th className="w-10 border-r border-black p-1.5 font-medium">ลำดับ</th>
              <th className="w-20 border-r border-black p-1.5 font-medium">รหัสสินค้า</th>
              <th className="border-r border-black p-1.5 font-medium">รายละเอียด</th>
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
                      <td className="border-r border-t border-black p-1.5"></td>
                      <td className="border-r border-t border-black p-1.5 text-left whitespace-pre-line">
                        {it.manualDescription}
                      </td>
                      <td className="border-r border-t border-black p-1.5">
                        {it.manualQty} {it.manualUnit}
                      </td>
                      <td className="border-r border-t border-black p-1.5 text-right">
                        {formatTHB(it.manualUnitPrice ?? 0)}
                      </td>
                      {/* Pre-VAT line total (qty × unit price), not the
                          stored VAT-inclusive it.amount — matches the
                          create form's own per-row display and standard
                          invoice convention (VAT is broken out once in the
                          summary below, not per line). */}
                      <td className="border-t border-black p-1.5 text-right">
                        {formatTHB(Math.round((it.manualQty ?? 0) * (it.manualUnitPrice ?? 0) * 100) / 100)}
                      </td>
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
                      <td className="border-r border-t border-black p-1.5"></td>
                      <td className="border-r border-t border-black p-1.5 text-left whitespace-pre-line">
                        {refLabel} {it.invoiceNo} ลงวันที่ {fmtDate(it.invoiceDate)}
                      </td>
                      <td className="border-r border-t border-black p-1.5"></td>
                      <td className="border-r border-t border-black p-1.5 text-right"></td>
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
                          <td className="border-r border-t border-black p-1.5">{qi.productCode ?? ""}</td>
                          <td className="border-r border-t border-black p-1.5 text-left">
                            {specRows
                              .filter((row) => row.value)
                              .map((row) => (
                                <div key={row.label} className="flex gap-1">
                                  <span className="w-28 shrink-0">{row.label} :</span>
                                  <span>{row.value}</span>
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
                  </Fragment>
                );
              });
            })()}
          </tbody>
        </table>
      ) : (
        <table className="w-full border-collapse border border-black text-center">
          <thead>
            <tr className="bg-[#c8d7d6]">
              <th className="w-10 border-r border-black p-1.5 font-medium">ลำดับ</th>
              <th className="border-r border-black p-1.5 font-medium">เลขที่เอกสาร</th>
              <th className="w-24 border-r border-black p-1.5 font-medium">เอกสารวันที่</th>
              <th className="w-24 border-r border-black p-1.5 font-medium">วันครบกำหนด</th>
              <th className="w-28 border-r border-black p-1.5 font-medium">ยอดรวมตามเอกสาร</th>
              <th className="w-20 border-r border-black p-1.5 font-medium">หัก ณ ที่จ่าย</th>
              <th className="w-24 p-1.5 font-medium">ยอดชำระ</th>
            </tr>
          </thead>
          <tbody>
            {document.items.map((it, i) => {
              // ใบวางบิล billed from a quotation: once a ใบกำกับภาษี has
              // been issued for that same quotation, reference it instead —
              // it's the document actually being collected on.
              const docNo = it.taxInvoiceDocNo ?? it.invoiceNo;
              const docDate = it.taxInvoiceDocNo ? (it.taxInvoiceDocDate ?? null) : it.invoiceDate;
              // "ยอดรวมตามเอกสาร" shows the document's real face value
              // (grossAmount); the WHT column is simply the gap between that
              // and the already-net amount actually being collected — the
              // real deduction already applied at the source tax invoice,
              // not a fresh recompute from this document's own WHT%.
              const rowWht = Math.round((it.grossAmount - it.amount) * 100) / 100;
              return (
                <tr key={it.id}>
                  <td className="border-r border-t border-black p-1.5">{i + 1}</td>
                  <td className="border-r border-t border-black p-1.5">
                    {docNo}
                    {!it.taxInvoiceDocNo && it.quotationId && (
                      <div className="text-xs text-neutral-500">(ใบเสนอราคา)</div>
                    )}
                    {it.manualDescription && <div className="text-xs text-neutral-500">(รายการที่พิมพ์เอง)</div>}
                  </td>
                  <td className="border-r border-t border-black p-1.5">{fmtDate(docDate)}</td>
                  <td className="border-r border-t border-black p-1.5">{fmtDate(document.dueDate)}</td>
                  <td className="border-r border-t border-black p-1.5 text-right">{formatTHB(it.grossAmount)}</td>
                  <td className="border-r border-t border-black p-1.5 text-right">{formatTHB(rowWht)}</td>
                  <td className="border-t border-black p-1.5 text-right">{formatTHB(it.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Summary */}
      <div className="flex justify-end pt-2">
        <table className="w-80">
          <tbody>
            {isCollectionDoc && (
              <tr>
                <td className="py-0.5 text-neutral-600">จำนวนรวม</td>
                <td className="py-0.5 text-right">{document.items.length} รายการ</td>
              </tr>
            )}
            <tr style={{ backgroundColor: "#cfd0d0" }}>
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
            {isCollectionDoc && (
              <>
                <tr>
                  <td className="py-0.5 text-neutral-600">มูลค่าที่ไม่มี/ยกเว้นภาษี</td>
                  <td className="py-0.5 text-right">{formatTHB(0)}</td>
                </tr>
                <tr style={{ backgroundColor: "#cfd0d0" }}>
                  <td className="py-0.5 text-neutral-600">มูลค่าที่คำนวณภาษี</td>
                  <td className="py-0.5 text-right">{formatTHB(summary.afterDiscount)}</td>
                </tr>
              </>
            )}
            <tr>
              <td className="py-0.5 text-neutral-600">ภาษีมูลค่าเพิ่ม 7%</td>
              <td className="py-0.5 text-right">{formatTHB(summary.vat)}</td>
            </tr>
            <tr style={{ backgroundColor: "#d8eceb" }}>
              <td className="py-0.5 font-medium">{isCollectionDoc ? "จำนวนเงินรวมทั้งสิ้น" : "จำนวนเงินรวม"}</td>
              <td className="py-0.5 text-right font-medium">{formatTHB(summary.totalAfterVat)}</td>
            </tr>
            {!isCollectionDoc && document.whtPercent > 0 && (
              <tr>
                <td className="py-0.5 text-red-600">หัก ณ ที่จ่าย {document.whtPercent}%</td>
                <td className="py-0.5 text-right text-red-600">{formatTHB(summary.whtAmount)}</td>
              </tr>
            )}
            {!isCollectionDoc && document.retentionPercent > 0 && (
              <tr>
                <td className="py-0.5 text-red-600">หักประกันผลงาน {document.retentionPercent}%</td>
                <td className="py-0.5 text-right text-red-600">{formatTHB(summary.retentionAmount)}</td>
              </tr>
            )}
            {isCollectionDoc && summary.whtAmount > 0 && (
              <tr>
                <td className="py-0.5 text-red-600">หักภาษี ณ ที่จ่ายทั้งสิ้น</td>
                <td className="py-0.5 text-right text-red-600">{formatTHB(summary.whtAmount)}</td>
              </tr>
            )}
            {isCollectionDoc && summary.retentionAmount > 0 && (
              <tr>
                <td className="py-0.5 text-red-600">หักประกันผลงานทั้งสิ้น</td>
                <td className="py-0.5 text-right text-red-600">{formatTHB(summary.retentionAmount)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Baht-text and the final total share one line with one underline,
          instead of the total row sitting inside the table above and the
          baht-text as a separate line below it. Labeled "ยอดชำระ" for
          collection docs (the actual amount being collected, after WHT/
          retention) vs. "จำนวนเงินรวมทั้งสิ้น" elsewhere — same netPayable
          value either way. */}
      <div className="flex items-center justify-between gap-4 border-b border-black bg-[#c8d7d6] px-1 py-1.5">
        <p className="text-sm">({thaiBahtText(summary.netPayable)})</p>
        <div className="flex w-72 shrink-0 justify-between font-bold">
          <span>{isCollectionDoc ? "ยอดชำระ" : "จำนวนเงินรวมทั้งสิ้น"}</span>
          <span>{formatTHB(summary.netPayable)}</span>
        </div>
      </div>

      {document.note && (
        <p className="mt-2 text-sm">
          <span className="text-neutral-500">หมายเหตุ:</span> {document.note}
        </p>
      )}

      {/* ใบเสร็จรับเงิน gets its own payment-method + bank-details block above
          the signatures — the other 3 doc types have no such record to
          print. */}
      {document.docType === "receipt" && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-b border-black py-2 text-sm">
            <span>การชำระเงินจะสมบูรณ์เมื่อบริษัทได้รับเงินเรียบร้อยแล้ว</span>
            {PAYMENT_METHODS.map((m) => (
              <span key={m} className="flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center border border-black text-xs leading-none">
                  {document.paymentMethod === m ? "✓" : ""}
                </span>
                {m}
              </span>
            ))}
          </div>
          {(document.bankName || document.paymentReferenceNo || document.paymentDate) && (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-1 border-b border-black py-2 text-sm">
              <span>
                ธนาคาร <span className="font-medium">{document.bankName || "—"}</span>
              </span>
              <span>
                เลขที่ <span className="font-medium">{document.paymentReferenceNo || "—"}</span>
              </span>
              <span>
                วันที่ <span className="font-medium">{document.paymentDate ? fmtDate(document.paymentDate) : "—"}</span>
              </span>
              <span>
                จำนวนเงิน <span className="font-medium">{formatTHB(summary.netPayable)}</span>
              </span>
            </div>
          )}
        </>
      )}

      {(() => {
        const [leftLabel, rightLabel] =
          document.docType === "tax_invoice"
            ? ["ผู้รับสินค้า / บริการ", "ผู้อนุมัติ"]
            : document.docType === "receipt"
              ? ["ผู้จ่ายเงิน", "ผู้รับเงิน"]
              : ["ผู้รับวางบิล", "ผู้วางบิล"];
        return (
            <div className="mt-auto grid grid-cols-[1fr_auto_1fr] items-start gap-4 pt-6 text-center text-sm">
              <div>
                <p>ในนาม {document.customerName}</p>
                {/* Blank placeholder row matching the right column's
                    auto-filled name/date line — keeps both signature lines
                    at the same height even though the customer's own
                    name/date here is filled in by hand when they sign. */}
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <p>&nbsp;</p>
                  <p>&nbsp;</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <p className="border-t border-black pt-1">{leftLabel}</p>
                  <p className="border-t border-black pt-1">วันที่</p>
                </div>
              </div>
              <div className="px-4">
                <Image src="/koonwaylogo.png" alt="KOONWAY" width={127} height={20} className="mx-auto h-5 w-auto" />
                <p className="text-xs text-neutral-500">KoonWay Company Limited</p>
              </div>
              <div>
                <p>ในนาม บริษัท คูนเว จำกัด</p>
                {/* Auto-filled from whoever created the document and its
                    own doc_date — this is KOONWAY's own side, so both are
                    already known, unlike the customer's signature/date on
                    the left, which is filled in by hand when they sign. */}
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <p>{document.createdByName ?? " "}</p>
                  <p>{fmtDate(document.docDate)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <p className="border-t border-black pt-1">{rightLabel}</p>
                  <p className="border-t border-black pt-1">วันที่</p>
                </div>
              </div>
            </div>
          );
      })()}
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
        <DownloadPdfButton />
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
