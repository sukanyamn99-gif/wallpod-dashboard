"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerAutocomplete } from "@/components/dashboard/customer-autocomplete";
import { JobNoSelect } from "@/components/dashboard/job-no-select";
import { formatTHB } from "@/lib/format";
import { computeBillingDocumentSummary } from "@/lib/billing-document-summary";
import { createBillingDocument, fetchBillableQuotations, fetchUnbilledInvoices, updateBillingDocument } from "./actions";
import { BILLING_DOCUMENT_LABELS } from "@/lib/types";
import type { BillableQuotation, BillingDocumentDetail, BillingDocumentType, Customer, SalesRep, UnbilledInvoice } from "@/lib/types";
import type { JobLookupEntry } from "@/lib/data/reference";

const NONE_VALUE = "__none__";
const initialState = { error: null as string | null };

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// A third source of line items, alongside invoices/quotations: typed
// directly into the document. `key` is a local React key only, never sent
// to the server (the parsed amount is computed fresh there too — never
// trust a client-computed number for what feeds the summary math).
interface ManualItemRow {
  key: string;
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
}

function manualItemAmount(row: ManualItemRow): number {
  const qty = Number(row.qty) || 0;
  const unitPrice = Number(row.unitPrice) || 0;
  return Math.round(qty * unitPrice * 100) / 100;
}

export function BillingDocumentForm({
  docType,
  customers,
  salesReps,
  jobNoSuggestions = [],
  jobNoLookup = {},
  listPath,
  mode = "create",
  docId,
  initialData,
}: {
  docType: BillingDocumentType;
  customers: Customer[];
  salesReps: SalesRep[];
  // Only used in create mode (edit mode fixes the customer, so the JOB NO.
  // picker isn't rendered there) — optional so the edit route doesn't need
  // to fetch data its form usage never reads.
  jobNoSuggestions?: string[];
  jobNoLookup?: Record<string, JobLookupEntry>;
  listPath: string;
  mode?: "create" | "edit";
  docId?: string;
  initialData?: BillingDocumentDetail;
}) {
  const router = useRouter();
  const [jobNo, setJobNo] = useState("");
  const [customerId, setCustomerId] = useState(initialData?.customerId ?? "");
  const [customerName, setCustomerName] = useState(initialData?.customerName ?? "");
  const [invoices, setInvoices] = useState<UnbilledInvoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((initialData?.items ?? []).map((it) => it.paymentId).filter((id): id is string => !!id)),
  );
  const [quotations, setQuotations] = useState<BillableQuotation[]>([]);
  const [selectedQuotations, setSelectedQuotations] = useState<Set<string>>(
    () => new Set((initialData?.items ?? []).map((it) => it.quotationId).filter((id): id is string => !!id)),
  );
  const [manualItems, setManualItems] = useState<ManualItemRow[]>(() =>
    (initialData?.items ?? [])
      .filter((it) => it.manualDescription)
      .map((it, i) => ({
        key: `initial-${i}`,
        description: it.manualDescription ?? "",
        qty: String(it.manualQty ?? 1),
        unit: it.manualUnit ?? "หน่วย",
        unitPrice: String(it.manualUnitPrice ?? 0),
      })),
  );
  const [loadingInvoices, setLoadingInvoices] = useState(mode === "edit");
  const [docDate, setDocDate] = useState(initialData?.docDate ?? new Date().toISOString().slice(0, 10));
  const [creditDays, setCreditDays] = useState(String(initialData?.creditDays ?? 0));
  const [salesRepId, setSalesRepId] = useState(initialData?.salesRepId ?? "");
  const [discountAmount, setDiscountAmount] = useState(String(initialData?.discountAmount ?? 0));
  const [whtPercent, setWhtPercent] = useState(String(initialData?.whtPercent ?? 0));
  const [retentionPercent, setRetentionPercent] = useState(String(initialData?.retentionPercent ?? 0));
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    if (mode === "edit" && docId) {
      const result = await updateBillingDocument(docType, docId, formData);
      if (!result.error) router.push(`/dashboard/billing-documents/${docType.replace("_", "-")}/view/${docId}`);
      return { error: result.error };
    }
    const result = await createBillingDocument(docType, formData);
    if (!result.error && result.id) {
      router.push(`/dashboard/billing-documents/${docType.replace("_", "-")}/view/${result.id}`);
    }
    return { error: result.error };
  }, initialState);

  // Shared by both entry points into picking a customer — searching by name
  // (CustomerAutocomplete) or by JOB NO. (handleJobNoChange below). `preselectJobNo`
  // pre-checks that one job's own invoice(s) once loaded, since picking a
  // specific job is a strong signal that's the one being billed — the
  // customer's other open invoices still show up, just unchecked, so more
  // can be added to the same bundle if wanted.
  async function pickCustomer(id: string, name: string, preselectJobNo?: string) {
    setCustomerId(id);
    setCustomerName(name);
    setSelected(new Set());
    setSelectedQuotations(new Set());
    setLoadingInvoices(true);
    try {
      const [rows, billableQuotations] = await Promise.all([fetchUnbilledInvoices(id), fetchBillableQuotations(name)]);
      setInvoices(rows);
      setQuotations(billableQuotations);
      if (preselectJobNo) {
        setSelected(new Set(rows.filter((r) => r.jobNo === preselectJobNo).map((r) => r.paymentId)));
      }
    } finally {
      setLoadingInvoices(false);
    }
  }

  function handleCustomerSelect(customer: Customer) {
    setJobNo("");
    void pickCustomer(customer.id, customer.name);
  }

  function handleJobNoChange(value: string) {
    setJobNo(value);
    const match = jobNoLookup[value];
    if (match?.customerId) {
      void pickCustomer(match.customerId, match.customerName, value);
      // A JOB has exactly one assigned sales rep — a stronger, unambiguous
      // signal than the customer alone (who can have deals across several
      // reps), so this is the one path that auto-fills ผู้ขาย too.
      setSalesRepId(match.salesRepId ?? "");
    }
  }

  // Edit mode: customer is fixed (changing it would invalidate the whole
  // invoice bundle), so fetch its open invoices once on mount instead of
  // waiting for a CustomerAutocomplete selection that will never happen.
  useEffect(() => {
    if (mode !== "edit" || !initialData) return;
    let cancelled = false;
    (async () => {
      const [rows, billableQuotations] = await Promise.all([
        fetchUnbilledInvoices(initialData.customerId),
        fetchBillableQuotations(initialData.customerName),
      ]);
      if (!cancelled) {
        setInvoices(rows);
        setQuotations(billableQuotations);
        setLoadingInvoices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the fixed initialData.customerId
  }, []);

  function toggleInvoice(paymentId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  }

  function toggleQuotation(quotationId: string) {
    setSelectedQuotations((prev) => {
      const next = new Set(prev);
      if (next.has(quotationId)) next.delete(quotationId);
      else next.add(quotationId);
      return next;
    });
  }

  function addManualItem() {
    setManualItems((prev) => [
      ...prev,
      { key: `manual-${Date.now()}-${prev.length}`, description: "", qty: "1", unit: "หน่วย", unitPrice: "0" },
    ]);
  }

  function updateManualItem(key: string, field: keyof Omit<ManualItemRow, "key">, value: string) {
    setManualItems((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function removeManualItem(key: string) {
    setManualItems((prev) => prev.filter((row) => row.key !== key));
  }

  // Shows automatically whenever a customer is picked — whether via the
  // JOB NO. picker, CustomerAutocomplete, or (edit mode) already fixed —
  // same as the customer name itself already does, so staff can confirm
  // the contact details that will print on the document before issuing it.
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  const selectedAmounts = useMemo(
    () => [
      ...invoices.filter((inv) => selected.has(inv.paymentId)).map((inv) => inv.amount),
      ...quotations.filter((q) => selectedQuotations.has(q.id)).map((q) => q.total),
      ...manualItems.filter((row) => row.description.trim()).map(manualItemAmount),
    ],
    [invoices, selected, quotations, selectedQuotations, manualItems],
  );
  const summary = useMemo(
    () => computeBillingDocumentSummary(selectedAmounts, Number(discountAmount) || 0, Number(whtPercent) || 0, Number(retentionPercent) || 0),
    [selectedAmounts, discountAmount, whtPercent, retentionPercent],
  );

  const dueDate = addDays(docDate, Number(creditDays) || 0);
  const salesRepItems = [
    { value: NONE_VALUE, label: "— ไม่ระบุ —" },
    ...salesReps.map((r) => ({ value: r.id, label: r.name })),
  ];

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        // The Select's own hidden input mirrors its displayed value
        // (NONE_VALUE when unset), so new FormData(form) would submit that
        // sentinel literally — overwrite with the real state, which is
        // already "" when no sales rep is picked.
        fd.set("sales_rep_id", salesRepId);
        for (const paymentId of selected) {
          fd.append("item_payment_id", paymentId);
        }
        for (const quotationId of selectedQuotations) {
          fd.append("item_quotation_id", quotationId);
        }
        for (const row of manualItems) {
          if (!row.description.trim()) continue;
          fd.append("item_manual_description", row.description);
          fd.append("item_manual_qty", row.qty);
          fd.append("item_manual_unit", row.unit);
          fd.append("item_manual_unit_price", row.unitPrice);
        }
        startTransition(() => formAction(fd));
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <div className="space-y-4">
        {mode === "edit" && initialData && (
          <p className="text-sm text-muted-foreground">
            เลขที่เอกสาร: <span className="font-medium text-foreground">{initialData.docNo}</span>
          </p>
        )}

        {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

        {mode === "create" && (
          <div className="space-y-2">
            <Label htmlFor="job_no_picker">เลขที่ Job</Label>
            <JobNoSelect id="job_no_picker" value={jobNo} onChange={handleJobNoChange} jobNos={jobNoSuggestions} />
            <p className="text-xs text-muted-foreground">
              เลือก JOB เพื่อดึงลูกค้าและรายการใบแจ้งหนี้ของ JOB นั้นมาให้อัตโนมัติ (หรือค้นหาลูกค้าด้านล่างแทนก็ได้)
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="customer_id">ลูกค้า</Label>
          <input type="hidden" name="customer_id" value={customerId} />
          {mode === "edit" ? (
            // Fixed on edit — changing the customer would invalidate the
            // whole open-invoices bundle, so this isn't an editable field.
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{customerName}</p>
          ) : (
            <CustomerAutocomplete
              id="customer_id"
              name="_customer_name_display"
              value={customerName}
              onChange={setCustomerName}
              onSelect={handleCustomerSelect}
              customers={customers}
              placeholder="ค้นหาลูกค้า"
              required
            />
          )}
          {selectedCustomer && (
            <p className="text-xs text-muted-foreground">
              {selectedCustomer.address ?? "ไม่มีที่อยู่ในระบบ"}
              {" • "}
              เลขผู้เสียภาษี: {selectedCustomer.taxId ?? "—"}
              {" • "}
              โทร. {selectedCustomer.phone ?? "—"}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="doc_date">วันที่</Label>
            <DateInput id="doc_date" name="doc_date" value={docDate} onChange={setDocDate} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credit_days">เครดิต (วัน)</Label>
            <NumberInput id="credit_days" name="credit_days" min={0} step={1} value={creditDays} onChange={setCreditDays} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>ครบกำหนด</Label>
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{new Date(dueDate).toLocaleDateString("th-TH")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sales_rep_id">ผู้ขาย</Label>
          <Select
            name="sales_rep_id"
            items={salesRepItems}
            value={salesRepId || NONE_VALUE}
            onValueChange={(v) => setSalesRepId(v === NONE_VALUE ? "" : ((v as string) ?? ""))}
          >
            <SelectTrigger id="sales_rep_id" className="w-full">
              <SelectValue placeholder="— ไม่ระบุ —" />
            </SelectTrigger>
            <SelectContent>
              {salesRepItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="discount_amount">ส่วนลด (บาท)</Label>
            <NumberInput
              id="discount_amount"
              name="discount_amount"
              min={0}
              step={0.01}
              value={discountAmount}
              onChange={setDiscountAmount}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wht_percent">หัก ณ ที่จ่าย (%)</Label>
            <NumberInput id="wht_percent" name="wht_percent" min={0} step={0.01} value={whtPercent} onChange={setWhtPercent} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="retention_percent">หักประกันผลงาน (%)</Label>
            <NumberInput
              id="retention_percent"
              name="retention_percent"
              min={0}
              step={0.01}
              value={retentionPercent}
              onChange={setRetentionPercent}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea id="note" name="note" placeholder="ข้อมูลเพิ่มเติม..." defaultValue={initialData?.note ?? undefined} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>รายการใบแจ้งหนี้ที่ยังไม่ได้ชำระ</Label>
          {!customerId ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">เลือกลูกค้าก่อนเพื่อดูรายการใบแจ้งหนี้</p>
            </div>
          ) : loadingInvoices ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : invoices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                ลูกค้ารายนี้ไม่มีใบแจ้งหนี้ค้างชำระ
                {quotations.length > 0 && " — เลือกจากใบเสนอราคาด้านล่างแทนได้"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <label
                  key={inv.paymentId}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(inv.paymentId)}
                    onChange={() => toggleInvoice(inv.paymentId)}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {inv.invoiceNo} {inv.jobNo && <span className="text-muted-foreground">— {inv.jobNo}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.projectName} {inv.invoiceDate && `• ${new Date(inv.invoiceDate).toLocaleDateString("th-TH")}`}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">{formatTHB(inv.amount)}</p>
                </label>
              ))}
            </div>
          )}
        </div>

        {customerId && !loadingInvoices && quotations.length > 0 && (
          <div className="space-y-2">
            <Label>ใบเสนอราคาที่ลูกค้าตอบตกลง (ยังไม่บันทึกเป็นงานจริง)</Label>
            <p className="text-xs text-muted-foreground">
              ใช้เมื่อยังไม่มีใบแจ้งหนี้จาก WALLPOD Project Sales — เลือกแล้วจะดึงยอดและรายการสินค้าทั้งใบมาให้
            </p>
            <div className="space-y-2">
              {quotations.map((q) => (
                <label key={q.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-2 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selectedQuotations.has(q.id)}
                    onChange={() => toggleQuotation(q.id)}
                    className="h-4 w-4"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{q.docNo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {q.projectName} • {new Date(q.quoteDate).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium">{formatTHB(q.total)}</p>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>รายการที่พิมพ์เอง</Label>
            <Button type="button" size="sm" variant="outline" onClick={addManualItem}>
              <Plus className="h-3.5 w-3.5" />
              เพิ่มรายการ
            </Button>
          </div>
          {manualItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              ใช้เมื่อไม่มีใบแจ้งหนี้หรือใบเสนอราคาให้ดึง — พิมพ์ชื่อสินค้า/บริการ จำนวน และราคาต่อหน่วยเอง
            </p>
          ) : (
            <div className="space-y-2">
              {manualItems.map((row) => (
                <div key={row.key} className="flex items-start gap-2 rounded-lg border p-2">
                  <div className="grid flex-1 grid-cols-4 gap-2">
                    <Input
                      className="col-span-4 sm:col-span-1"
                      placeholder="ชื่อสินค้า/บริการ"
                      value={row.description}
                      onChange={(e) => updateManualItem(row.key, "description", e.target.value)}
                    />
                    <NumberInput
                      placeholder="จำนวน"
                      min={0}
                      step={0.01}
                      value={row.qty}
                      onChange={(v) => updateManualItem(row.key, "qty", v)}
                    />
                    <Input
                      placeholder="หน่วย"
                      value={row.unit}
                      onChange={(e) => updateManualItem(row.key, "unit", e.target.value)}
                    />
                    <NumberInput
                      placeholder="ราคาต่อหน่วย"
                      min={0}
                      step={0.01}
                      value={row.unitPrice}
                      onChange={(v) => updateManualItem(row.key, "unitPrice", v)}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <span className="w-20 shrink-0 text-right text-sm font-medium">
                      {formatTHB(manualItemAmount(row))}
                    </span>
                    <Button type="button" size="icon-sm" variant="outline" onClick={() => removeManualItem(row.key)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1 rounded-lg border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">รวมเป็นเงิน</span>
            <span>{formatTHB(summary.subtotal)}</span>
          </div>
          {summary.discountAmount > 0 && (
            <>
              <div className="flex justify-between text-destructive">
                <span>หักส่วนลด</span>
                <span>{formatTHB(summary.discountAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">จำนวนเงินรวมหลังหักส่วนลด</span>
                <span>{formatTHB(summary.afterDiscount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">ภาษีมูลค่าเพิ่ม 7%</span>
            <span>{formatTHB(summary.vat)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">จำนวนเงินรวม</span>
            <span>{formatTHB(summary.totalAfterVat)}</span>
          </div>
          {Number(whtPercent) > 0 && (
            <div className="flex justify-between text-destructive">
              <span>หัก ณ ที่จ่าย {whtPercent}%</span>
              <span>{formatTHB(summary.whtAmount)}</span>
            </div>
          )}
          {Number(retentionPercent) > 0 && (
            <div className="flex justify-between text-destructive">
              <span>หักประกันผลงาน {retentionPercent}%</span>
              <span>{formatTHB(summary.retentionAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <span>จำนวนเงินรวมทั้งสิ้น</span>
            <span>{formatTHB(summary.netPayable)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(
                mode === "edit" && docId
                  ? `/dashboard/billing-documents/${docType.replace("_", "-")}/view/${docId}`
                  : listPath,
              )
            }
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            disabled={
              pending ||
              (selected.size === 0 && selectedQuotations.size === 0 && !manualItems.some((row) => row.description.trim()))
            }
          >
            {pending ? "กำลังบันทึก..." : mode === "edit" ? "บันทึกการแก้ไข" : `ออก${BILLING_DOCUMENT_LABELS[docType]}`}
          </Button>
        </div>
      </div>
    </form>
  );
}
