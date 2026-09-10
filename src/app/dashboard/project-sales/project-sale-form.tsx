"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { NumberInput } from "@/components/ui/number-input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProjectSale, getJobLinkedCostSuggestion, getSuggestedJobNo, updateProjectSale } from "./actions";
import type { AdjacentJobNos, JobLinkedCostSummary } from "@/lib/data/project-sales";
import { formatTHB } from "@/lib/format";
import { CustomerAutocomplete } from "@/components/dashboard/customer-autocomplete";
import type { Customer, CustomerType, PaymentStatus, ProductionStatus, SalesRep } from "@/lib/types";
import { PRODUCTION_STATUSES } from "@/lib/types";
import { getJobNoError } from "@/lib/job-no";

const initialState = { error: null as string | null };

const CUSTOMER_TYPES: CustomerType[] = [
  "Owner", "Designer", "Turnkey", "Contractor", "Corporate", "Dealer", "School",
];

const PAYMENT_STATUSES: PaymentStatus[] = ["เก็บเงินเรียบร้อย", "ชำระมาแล้ว 50%", "รอชำระเงิน"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface ItemRow {
  key: number;
  category: string;
  amount: string;
}

export interface ProjectSaleInitialData {
  projectDate: string;
  jobNo: string | null;
  customerName: string;
  projectName: string;
  salesRepId: string;
  customerType: string;
  productionStatus: string;
  items: { category: string; amount: string }[];
  costs: {
    material_cost: string;
    glue_cost: string;
    cutting_cost: string;
    install_cost: string;
    parking_cost: string;
    shipping_cost: string;
  };
  status: string;
  billingNoteNo1: string;
  billingNoteDate1: string;
  invoiceNo1: string;
  amount1: string;
  paidDate1: string;
  taxInvoiceNo1: string;
  taxInvoiceDate1: string;
  receiptNo1: string;
  receivedDate1: string;
  whtAmount1: string;
  billingNoteNo2: string;
  billingNoteDate2: string;
  invoiceNo2: string;
  amount2: string;
  paidDate2: string;
  taxInvoiceNo2: string;
  taxInvoiceDate2: string;
  receiptNo2: string;
  receivedDate2: string;
  whtAmount2: string;
  billingNoteNo3: string;
  billingNoteDate3: string;
  invoiceNo3: string;
  amount3: string;
  paidDate3: string;
  taxInvoiceNo3: string;
  taxInvoiceDate3: string;
  receiptNo3: string;
  receivedDate3: string;
  whtAmount3: string;
}

export function ProjectSaleForm({
  salesReps,
  customers,
  categories,
  mode = "create",
  projectId,
  initialData,
  canSeeCosts = true,
  adjacentJobNos,
  suggestedJobNo = "",
}: {
  salesReps: SalesRep[];
  customers: Customer[];
  categories: string[];
  mode?: "create" | "edit";
  projectId?: string;
  initialData?: ProjectSaleInitialData;
  canSeeCosts?: boolean;
  adjacentJobNos?: AdjacentJobNos;
  suggestedJobNo?: string;
}) {
  // เลขที่เอกสาร (invoice_no) was the old manual way of marking an
  // installment billed, before ใบกำกับภาษี auto-syncs in via Billing
  // Documents — per the user's explicit cutoff, only jobs before JB2609188
  // (the fixed-width JB+YYMM+seq format sorts lexicographically the same as
  // numerically, so a plain string compare works) still show it; every job
  // from that point on shows only the amount, relying on the auto-filled
  // ใบกำกับภาษี field instead. A brand-new job being created now is always
  // past that cutoff.
  const usesLegacyInvoiceNo = mode === "edit" && !!initialData?.jobNo && initialData.jobNo < "JB2609188";
  const nextRowKey = useRef(initialData?.items.length ?? 1);
  const [items, setItems] = useState<ItemRow[]>(
    initialData?.items.length
      ? initialData.items.map((it, i) => ({ key: i, category: it.category, amount: it.amount }))
      : [{ key: 0, category: "", amount: "" }],
  );
  const [customerName, setCustomerName] = useState(initialData?.customerName ?? "");
  const [installment2, setInstallment2] = useState(
    Boolean(initialData?.amount2 || initialData?.invoiceNo2),
  );
  const [installment3, setInstallment3] = useState(
    Boolean(initialData?.amount3 || initialData?.invoiceNo3),
  );
  const [amount1, setAmount1] = useState(initialData?.amount1 ?? "");
  const [amount2, setAmount2] = useState(initialData?.amount2 ?? "");
  const [amount3, setAmount3] = useState(initialData?.amount3 ?? "");
  const [receiptNo1, setReceiptNo1] = useState(initialData?.receiptNo1 ?? "");
  const [receiptNo2, setReceiptNo2] = useState(initialData?.receiptNo2 ?? "");
  const [receiptNo3, setReceiptNo3] = useState(initialData?.receiptNo3 ?? "");
  // Controlled (not defaultValue) purely to satisfy Base UI's own suggested
  // fix for its "changing default value after being initialized" warning —
  // seen when navigating between two different jobs' edit pages, where the
  // page-level key={detail.id} already guarantees a fresh mount per job (so
  // the data itself was never actually stale), but React's transition
  // timing around that remount still tripped the uncontrolled-field check.
  const [billingNoteNo1, setBillingNoteNo1] = useState(initialData?.billingNoteNo1 ?? "");
  const [billingNoteDate1, setBillingNoteDate1] = useState(initialData?.billingNoteDate1 ?? "");
  const [invoiceNo1, setInvoiceNo1] = useState(initialData?.invoiceNo1 ?? "");
  const [paidDate1, setPaidDate1] = useState(initialData?.paidDate1 ?? "");
  const [taxInvoiceNo1, setTaxInvoiceNo1] = useState(initialData?.taxInvoiceNo1 ?? "");
  const [taxInvoiceDate1, setTaxInvoiceDate1] = useState(initialData?.taxInvoiceDate1 ?? "");
  const [receivedDate1, setReceivedDate1] = useState(initialData?.receivedDate1 ?? "");
  const [whtAmount1, setWhtAmount1] = useState(initialData?.whtAmount1 ?? "");
  const [billingNoteNo2, setBillingNoteNo2] = useState(initialData?.billingNoteNo2 ?? "");
  const [billingNoteDate2, setBillingNoteDate2] = useState(initialData?.billingNoteDate2 ?? "");
  const [invoiceNo2, setInvoiceNo2] = useState(initialData?.invoiceNo2 ?? "");
  const [paidDate2, setPaidDate2] = useState(initialData?.paidDate2 ?? "");
  const [taxInvoiceNo2, setTaxInvoiceNo2] = useState(initialData?.taxInvoiceNo2 ?? "");
  const [taxInvoiceDate2, setTaxInvoiceDate2] = useState(initialData?.taxInvoiceDate2 ?? "");
  const [receivedDate2, setReceivedDate2] = useState(initialData?.receivedDate2 ?? "");
  const [whtAmount2, setWhtAmount2] = useState(initialData?.whtAmount2 ?? "");
  const [billingNoteNo3, setBillingNoteNo3] = useState(initialData?.billingNoteNo3 ?? "");
  const [billingNoteDate3, setBillingNoteDate3] = useState(initialData?.billingNoteDate3 ?? "");
  const [invoiceNo3, setInvoiceNo3] = useState(initialData?.invoiceNo3 ?? "");
  const [paidDate3, setPaidDate3] = useState(initialData?.paidDate3 ?? "");
  const [taxInvoiceNo3, setTaxInvoiceNo3] = useState(initialData?.taxInvoiceNo3 ?? "");
  const [taxInvoiceDate3, setTaxInvoiceDate3] = useState(initialData?.taxInvoiceDate3 ?? "");
  const [receivedDate3, setReceivedDate3] = useState(initialData?.receivedDate3 ?? "");
  const [whtAmount3, setWhtAmount3] = useState(initialData?.whtAmount3 ?? "");
  const [status, setStatus] = useState(initialData?.status ?? "");
  const [productionStatus, setProductionStatus] = useState(initialData?.productionStatus ?? "");
  const [savedMessage, setSavedMessage] = useState(false);
  // Bumped after every successful create to force-remount the <form> below —
  // several fields (cost NumberInputs, DateInputs, invoice_no) are
  // uncontrolled, so resetting individual useState variables never touched
  // their leftover typed values; a fresh key remounts everything cleanly,
  // the same as a real page reload would.
  const [formKey, setFormKey] = useState(0);

  const jobNoRef = useRef<HTMLInputElement>(null);
  const [jobNoError, setJobNoError] = useState<string | null>(null);
  // Server-computed on page load (see new/page.tsx's getNextJobNo) — kept in
  // state, not just the initial prop, because it has to advance again after
  // each successful save while the user stays on this page entering the
  // next job; the prop value would otherwise get reused and collide.
  const [nextJobNoSuggestion, setNextJobNoSuggestion] = useState(suggestedJobNo);
  const [materialCost, setMaterialCost] = useState(initialData?.costs.material_cost ?? "");
  const [jobCostSummary, setJobCostSummary] = useState<JobLinkedCostSummary | null>(null);
  const [jobCostError, setJobCostError] = useState<string | null>(null);
  const [fetchingJobCost, startJobCostFetch] = useTransition();

  function fetchJobCostSummary() {
    const jobNo = jobNoRef.current?.value ?? "";
    setJobCostError(null);
    setJobCostSummary(null);
    startJobCostFetch(async () => {
      const result = await getJobLinkedCostSuggestion(jobNo);
      if (result.error) setJobCostError(result.error);
      else setJobCostSummary(result.summary);
    });
  }

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && projectId
        ? await updateProjectSale(projectId, formData)
        : await createProjectSale(formData);

    if (!result.error) {
      if (mode === "create") {
        setItems([{ key: 0, category: "", amount: "" }]);
        setCustomerName("");
        setInstallment2(false);
        setInstallment3(false);
        setAmount1("");
        setAmount2("");
        setAmount3("");
        setReceiptNo1("");
        setReceiptNo2("");
        setReceiptNo3("");
        setBillingNoteNo1("");
        setBillingNoteDate1("");
        setInvoiceNo1("");
        setPaidDate1("");
        setTaxInvoiceNo1("");
        setTaxInvoiceDate1("");
        setReceivedDate1("");
        setWhtAmount1("");
        setBillingNoteNo2("");
        setBillingNoteDate2("");
        setInvoiceNo2("");
        setPaidDate2("");
        setTaxInvoiceNo2("");
        setTaxInvoiceDate2("");
        setReceivedDate2("");
        setWhtAmount2("");
        setBillingNoteNo3("");
        setBillingNoteDate3("");
        setInvoiceNo3("");
        setPaidDate3("");
        setTaxInvoiceNo3("");
        setTaxInvoiceDate3("");
        setReceivedDate3("");
        setWhtAmount3("");
        setStatus("");
        setProductionStatus("");
        setMaterialCost("");
        setJobCostSummary(null);
        setJobCostError(null);
        setJobNoError(null);
        // Awaited before the form remounts below — the remount reads
        // nextJobNoSuggestion as its defaultValue only once, at mount time
        // (it's an uncontrolled input), so a suggestion that arrived after
        // the remount would never actually reach the field.
        const freshSuggestion = await getSuggestedJobNo().catch(() => "");
        if (freshSuggestion) setNextJobNoSuggestion(freshSuggestion);
        setFormKey((k) => k + 1);
      } else {
        setSavedMessage(true);
        // A successful edit save triggers Next's automatic RSC refetch for
        // this route (the server action calls revalidatePath), which hands
        // this component a freshly-fetched `initialData` object — bumping
        // formKey remounts the <form> so its uncontrolled inputs
        // (DateInput/tax_invoice_no/receipt_no, etc.) pick up that fresh
        // defaultValue as a real fresh mount, instead of Base UI seeing
        // their defaultValue prop silently change on an already-initialized
        // field and warning about it.
        setFormKey((k) => k + 1);
      }
    }
    return result;
  }, initialState);

  const preVat = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
    [items],
  );
  const vat = Math.round(preVat * 0.07 * 100) / 100;
  const total = preVat + vat;
  // An installment only counts toward "paid" once its receipt number is
  // filled in AND สถานะ isn't still "รอชำระเงิน" — a receipt number alone
  // isn't proof money arrived for the one customer (ร้อกเวิธ) who requires
  // an advance receipt before their own payment cycle actually pays it, so
  // สถานะ is what they flip once the money genuinely lands. An invoice
  // number/amount alone (no receipt) still never counts either, matching
  // the original rule this builds on.
  const isAwaitingPayment = status === "รอชำระเงิน";
  // A received installment's WHT amount counts toward "paid" too — it's
  // money already settled via a WHT certificate rather than cash, not
  // still outstanding (see wht_amount's own comment in schema.sql).
  const paidAmount = isAwaitingPayment
    ? 0
    : (receiptNo1.trim() ? (Number(amount1) || 0) + (Number(whtAmount1) || 0) : 0) +
      (receiptNo2.trim() ? (Number(amount2) || 0) + (Number(whtAmount2) || 0) : 0) +
      (receiptNo3.trim() ? (Number(amount3) || 0) + (Number(whtAmount3) || 0) : 0);
  // Not floored at 0 — mirrors actions.ts's parseForm: an overpayment should
  // show as a negative number here too, not get silently hidden as ฿0.
  // Snapped to exactly 0 when the gap is sub-satang so floating-point drift
  // can't land on -0 and display as a confusing "-0.00".
  const outstandingRaw = total - paidAmount;
  const outstanding = Math.abs(outstandingRaw) < 0.005 ? 0 : outstandingRaw;

  // Fills every active installment with an equal share of the total,
  // rounded to the satang — any leftover from the division (e.g. a total
  // that doesn't split evenly by 2 or 3) goes onto the last installment so
  // the installments always sum to exactly `total`, not a few satang short.
  function splitEvenly() {
    const activeCount = installment3 ? 3 : installment2 ? 2 : 1;
    const base = Math.floor((total / activeCount) * 100) / 100;
    const amounts = Array<number>(activeCount).fill(base);
    const remainder = Math.round((total - base * activeCount) * 100) / 100;
    amounts[activeCount - 1] = Math.round((amounts[activeCount - 1] + remainder) * 100) / 100;
    setAmount1(String(amounts[0]));
    if (installment2) setAmount2(String(amounts[1]));
    if (installment3) setAmount3(String(amounts[2]));
  }

  function addRow() {
    setItems((prev) => [...prev, { key: nextRowKey.current++, category: "", amount: "" }]);
  }
  function removeRow(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }
  function updateRow(key: number, field: "category" | "amount", value: string) {
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    setSavedMessage(false);
  }

  return (
    <form
      key={formKey}
      action={formAction}
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        if (mode !== "create") return;
        const error = getJobNoError(jobNoRef.current?.value ?? "", { required: true });
        if (error) {
          e.preventDefault();
          setJobNoError(error);
          jobNoRef.current?.focus();
        }
      }}
    >
      {state.error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
      )}
      {savedMessage && (
        <p className="rounded-md bg-green-100 p-3 text-sm text-green-900">บันทึกการแก้ไขเรียบร้อย</p>
      )}

      {/* Section 1: job info */}
      <div className="space-y-4">
        <h3 className="font-medium">ข้อมูลงาน</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="project_date">วันที่</Label>
            <DateInput
              id="project_date"
              name="project_date"
              defaultValue={initialData?.projectDate ?? todayISO()}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job_no">JOB NO.</Label>
            <Input
              id="job_no"
              name="job_no"
              ref={jobNoRef}
              defaultValue={mode === "edit" ? initialData?.jobNo ?? "" : nextJobNoSuggestion}
              readOnly={mode === "edit"}
              className={mode === "edit" ? "bg-muted" : undefined}
              placeholder="เช่น JB2607001"
              aria-invalid={mode === "create" && !!jobNoError}
              onChange={mode === "create" ? () => setJobNoError(null) : undefined}
              onBlur={
                mode === "create"
                  ? (e) => setJobNoError(getJobNoError(e.target.value, { required: true }))
                  : undefined
              }
            />
            {mode === "create" && jobNoError && (
              <p className="text-xs text-destructive">{jobNoError}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_name">ชื่อลูกค้า</Label>
          <CustomerAutocomplete
            id="customer_name"
            name="customer_name"
            required
            value={customerName}
            onChange={(v) => {
              setCustomerName(v);
              setSavedMessage(false);
            }}
            customers={customers}
            placeholder="เช่น บจก. ABC"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project_name">ชื่องาน/โปรเจกต์</Label>
          <Input
            id="project_name"
            name="project_name"
            required
            defaultValue={initialData?.projectName}
            placeholder="เช่น โรงแรม XYZ ชั้น 3"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sales_rep_id">เซลล์</Label>
            <Select
              name="sales_rep_id"
              required
              defaultValue={initialData?.salesRepId}
              items={salesReps.map((rep) => ({ value: rep.id, label: rep.name }))}
            >
              <SelectTrigger id="sales_rep_id" className="w-full">
                <SelectValue placeholder="เลือกเซลล์" />
              </SelectTrigger>
              <SelectContent>
                {salesReps.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer_type">กลุ่มลูกค้า</Label>
            <Select name="customer_type" required defaultValue={initialData?.customerType}>
              <SelectTrigger id="customer_type" className="w-full">
                <SelectValue placeholder="เลือก" />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="production_status">สถานะของงาน</Label>
          <Select
            name="production_status"
            value={productionStatus}
            onValueChange={(v) => setProductionStatus((v as string) ?? "")}
          >
            <SelectTrigger id="production_status" className="w-full">
              <SelectValue placeholder="เลือกสถานะของงาน" />
            </SelectTrigger>
            <SelectContent>
              {/* A job already saved with a status removed from the picklist
                  (e.g. old "เก็บเงินงวดสุดท้าย" records) still gets an option
                  here so opening its edit page doesn't silently blank out
                  its recorded status — it just can't be chosen for other jobs. */}
              {initialData?.productionStatus && !PRODUCTION_STATUSES.includes(initialData.productionStatus as ProductionStatus) && (
                <SelectItem value={initialData.productionStatus}>{initialData.productionStatus}</SelectItem>
              )}
              {PRODUCTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Section 2: product items */}
      <div className="space-y-4">
        <h3 className="font-medium">รายการสินค้า</h3>
        <div className="space-y-2">
          {items.map((row) => (
            <div key={row.key} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">ประเภทสินค้า</Label>
                <Select
                  name="item_category"
                  value={row.category}
                  onValueChange={(v) => updateRow(row.key, "category", v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40 space-y-1">
                <Label className="text-xs text-muted-foreground">จำนวนเงิน</Label>
                <NumberInput
                  name="item_amount"
                  min={0}
                  step={0.01}
                  value={row.amount}
                  onChange={(v) => updateRow(row.key, "amount", v)}
                  placeholder="0"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeRow(row.key)}
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" />
            เพิ่มรายการ
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4 rounded-md border p-3 text-sm">
          <div>
            <p className="text-muted-foreground">PRE.VAT</p>
            <p className="font-medium">{formatTHB(preVat)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">VAT (7%)</p>
            <p className="font-medium">{formatTHB(vat)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">รวมทั้งสิ้น</p>
            <p className="font-medium">{formatTHB(total)}</p>
          </div>
        </div>
      </div>

      {canSeeCosts && (
        <>
          <Separator />

          {/* Section 3: costs */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">ต้นทุน (ถ้ามี)</h3>
              <button
                type="button"
                onClick={fetchJobCostSummary}
                disabled={fetchingJobCost}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                title="แสดงยอดใบเบิกสินค้า/Payment Voucher/เงินสดย่อยที่ผูก JOB NO. นี้ (รวมอยู่ในต้นทุนรวมให้อัตโนมัติแล้ว)"
              >
                <Download className="h-3 w-3" />
                {fetchingJobCost ? "กำลังค้นหา..." : "ดูต้นทุนที่ผูกกับ JOB นี้"}
              </button>
            </div>
            {jobCostError && <p className="text-xs text-destructive">{jobCostError}</p>}
            {jobCostSummary && (
              <div className="space-y-2 rounded-md border bg-muted/40 p-2 text-xs">
                {[
                  { label: "ใบเบิกสินค้า", docs: jobCostSummary.requisitions },
                  { label: "Payment Voucher", docs: jobCostSummary.vouchers },
                  { label: "เงินสดย่อย", docs: jobCostSummary.pettyCash },
                ].map(
                  ({ label, docs }) =>
                    docs.length > 0 && (
                      <div key={label}>
                        <p className="font-medium text-foreground">{label}</p>
                        <ul className="text-muted-foreground">
                          {docs.map((doc) => (
                            <li key={doc.docNo} className="flex justify-between gap-2">
                              <span>{doc.docNo}</span>
                              <span>{formatTHB(doc.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ),
                )}
                <p className="border-t pt-2 font-medium text-foreground">รวม {formatTHB(jobCostSummary.total)}</p>
                <p className="text-[11px] text-muted-foreground">
                  * ยอดนี้รวมอยู่ในต้นทุนรวมของ JOB นี้ให้อัตโนมัติแล้ว ไม่ต้องคัดลอกมาใส่ในช่องต้นทุนด้านล่างซ้ำ
                </p>
              </div>
            )}
            {/* ค่าตัด is always shown/editable — every other cost field only
                shows when a JOB already has a nonzero value saved for it
                (older jobs entered before this field was trimmed down), so
                past data stays visible instead of silently hiding real
                numbers. A newly-created JOB has no initialData at all, so
                every one of these starts at 0 and stays hidden — only
                ค่าตัด shows, per the user's explicit request. Hidden fields
                stay in the form (not deleted) so their existing values keep
                submitting unchanged on save. */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cutting_cost">ค่าตัด</Label>
                <NumberInput id="cutting_cost" name="cutting_cost" min={0} step={0.01} defaultValue={initialData?.costs.cutting_cost} placeholder="0" />
              </div>
              <div className="space-y-2" hidden={!(Number(initialData?.costs.material_cost) > 0)}>
                <Label htmlFor="material_cost">ค่าวัสดุ</Label>
                <NumberInput
                  id="material_cost"
                  name="material_cost"
                  min={0}
                  step={0.01}
                  value={materialCost}
                  onChange={setMaterialCost}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2" hidden={!(Number(initialData?.costs.glue_cost) > 0)}>
                <Label htmlFor="glue_cost">ค่ากาว</Label>
                <NumberInput id="glue_cost" name="glue_cost" min={0} step={0.01} defaultValue={initialData?.costs.glue_cost} placeholder="0" />
              </div>
              <div className="space-y-2" hidden={!(Number(initialData?.costs.install_cost) > 0)}>
                <Label htmlFor="install_cost">ค่าติดตั้งผู้รับเหมา</Label>
                <NumberInput id="install_cost" name="install_cost" min={0} step={0.01} defaultValue={initialData?.costs.install_cost} placeholder="0" />
              </div>
              <div className="space-y-2" hidden={!(Number(initialData?.costs.parking_cost) > 0)}>
                <Label htmlFor="parking_cost">ค่าเดินทาง+ค่าที่จอดรถ</Label>
                <NumberInput id="parking_cost" name="parking_cost" min={0} step={0.01} defaultValue={initialData?.costs.parking_cost} placeholder="0" />
              </div>
              <div className="space-y-2" hidden={!(Number(initialData?.costs.shipping_cost) > 0)}>
                <Label htmlFor="shipping_cost">ค่าขนส่ง</Label>
                <NumberInput id="shipping_cost" name="shipping_cost" min={0} step={0.01} defaultValue={initialData?.costs.shipping_cost} placeholder="0" />
              </div>
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Section 4: payments */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">การชำระเงิน</h3>
          <Button type="button" variant="outline" size="sm" onClick={splitEvenly} disabled={total <= 0}>
            แบ่งยอดเท่ากันทุกงวด
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">งวดที่ 1</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
            {/* เลขที่ใบวางบิล/เลขที่ใบกำกับภาษี are pure auto-fill, never
                typed by staff (see SYNC_FIELDS in billing-documents/actions.ts)
                — hidden while empty instead of showing an input staff can't
                meaningfully use, and appearing once a real document syncs
                the value in. เลขที่ใบเสร็จ stays always visible below since
                staff do type into it directly. */}
            {billingNoteNo1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="billing_note_no_1">เลขที่ใบวางบิล</Label>
                  <Input
                    id="billing_note_no_1"
                    name="billing_note_no_1"
                    value={billingNoteNo1}
                    onChange={(e) => setBillingNoteNo1(e.target.value)}
                    placeholder="BN..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billing_note_date_1">วันที่ออกใบวางบิล</Label>
                  <DateInput id="billing_note_date_1" name="billing_note_date_1" value={billingNoteDate1} onChange={setBillingNoteDate1} />
                </div>
              </>
            )}
            {usesLegacyInvoiceNo && (
              <div className="space-y-2">
                <Label htmlFor="invoice_no_1">เลขที่เอกสาร</Label>
                <Input
                  id="invoice_no_1"
                  name="invoice_no_1"
                  value={invoiceNo1}
                  onChange={(e) => setInvoiceNo1(e.target.value)}
                  placeholder="IV..."
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="amount_1">จำนวนเงิน</Label>
              <NumberInput
                id="amount_1"
                name="amount_1"
                min={0}
                step={0.01}
                value={amount1}
                onChange={setAmount1}
                placeholder="0"
              />
            </div>
            {usesLegacyInvoiceNo && (
              <div className="space-y-2">
                <Label htmlFor="paid_date_1">วันที่ออกเอกสาร</Label>
                <DateInput id="paid_date_1" name="paid_date_1" value={paidDate1} onChange={setPaidDate1} />
              </div>
            )}
            {taxInvoiceNo1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tax_invoice_no_1">เลขที่ใบกำกับภาษี</Label>
                  <Input
                    id="tax_invoice_no_1"
                    name="tax_invoice_no_1"
                    value={taxInvoiceNo1}
                    onChange={(e) => setTaxInvoiceNo1(e.target.value)}
                    placeholder="INV..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_invoice_date_1">วันที่ออกใบกำกับภาษี</Label>
                  <DateInput id="tax_invoice_date_1" name="tax_invoice_date_1" value={taxInvoiceDate1} onChange={setTaxInvoiceDate1} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="receipt_no_1">เลขที่ใบเสร็จ</Label>
              <Input
                id="receipt_no_1"
                name="receipt_no_1"
                value={receiptNo1}
                onChange={(e) => setReceiptNo1(e.target.value)}
                placeholder="RE... (กรอกเมื่อได้รับเงินแล้ว)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="received_date_1">วันที่รับชำระเงิน</Label>
              <DateInput id="received_date_1" name="received_date_1" value={receivedDate1} onChange={setReceivedDate1} />
            </div>
            {/* Auto-synced from the tax invoice/billing note/receipt that
                deducted it — settled via a WHT certificate, not cash, but
                not still outstanding either (see paidAmount above). Hidden
                while empty/0, same convention as เลขที่ใบวางบิล/เลขที่ใบกำกับภาษี. */}
            {Number(whtAmount1) > 0 && (
              <div className="space-y-2">
                <Label htmlFor="wht_amount_1">หัก ณ ที่จ่าย</Label>
                <NumberInput
                  id="wht_amount_1"
                  name="wht_amount_1"
                  min={0}
                  step={0.01}
                  value={whtAmount1}
                  onChange={setWhtAmount1}
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </div>

        {installment2 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">งวดที่ 2</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
              {billingNoteNo2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="billing_note_no_2">เลขที่ใบวางบิล</Label>
                    <Input
                      id="billing_note_no_2"
                      name="billing_note_no_2"
                      value={billingNoteNo2}
                      onChange={(e) => setBillingNoteNo2(e.target.value)}
                      placeholder="BN..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_note_date_2">วันที่ออกใบวางบิล</Label>
                    <DateInput id="billing_note_date_2" name="billing_note_date_2" value={billingNoteDate2} onChange={setBillingNoteDate2} />
                  </div>
                </>
              )}
              {usesLegacyInvoiceNo && (
                <div className="space-y-2">
                  <Label htmlFor="invoice_no_2">เลขที่เอกสาร</Label>
                  <Input
                    id="invoice_no_2"
                    name="invoice_no_2"
                    value={invoiceNo2}
                    onChange={(e) => setInvoiceNo2(e.target.value)}
                    placeholder="IV..."
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="amount_2">จำนวนเงิน</Label>
                <NumberInput
                  id="amount_2"
                  name="amount_2"
                  min={0}
                  step={0.01}
                  value={amount2}
                  onChange={setAmount2}
                  placeholder="0"
                />
              </div>
              {usesLegacyInvoiceNo && (
                <div className="space-y-2">
                  <Label htmlFor="paid_date_2">วันที่ออกเอกสาร</Label>
                  <DateInput id="paid_date_2" name="paid_date_2" value={paidDate2} onChange={setPaidDate2} />
                </div>
              )}
              {taxInvoiceNo2 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tax_invoice_no_2">เลขที่ใบกำกับภาษี</Label>
                    <Input
                      id="tax_invoice_no_2"
                      name="tax_invoice_no_2"
                      value={taxInvoiceNo2}
                      onChange={(e) => setTaxInvoiceNo2(e.target.value)}
                      placeholder="INV..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_invoice_date_2">วันที่ออกใบกำกับภาษี</Label>
                    <DateInput id="tax_invoice_date_2" name="tax_invoice_date_2" value={taxInvoiceDate2} onChange={setTaxInvoiceDate2} />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="receipt_no_2">เลขที่ใบเสร็จ</Label>
                <Input
                  id="receipt_no_2"
                  name="receipt_no_2"
                  value={receiptNo2}
                  onChange={(e) => setReceiptNo2(e.target.value)}
                  placeholder="RE... (กรอกเมื่อได้รับเงินแล้ว)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="received_date_2">วันที่รับชำระเงิน</Label>
                <DateInput id="received_date_2" name="received_date_2" value={receivedDate2} onChange={setReceivedDate2} />
              </div>
              {Number(whtAmount2) > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="wht_amount_2">หัก ณ ที่จ่าย</Label>
                  <NumberInput
                    id="wht_amount_2"
                    name="wht_amount_2"
                    min={0}
                    step={0.01}
                    value={whtAmount2}
                    onChange={setWhtAmount2}
                    placeholder="0"
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setInstallment2(true)}>
            <Plus className="h-4 w-4" />
            เพิ่มงวดที่ 2
          </Button>
        )}

        {installment2 &&
          (installment3 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">งวดที่ 3</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
                {billingNoteNo3 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="billing_note_no_3">เลขที่ใบวางบิล</Label>
                      <Input
                        id="billing_note_no_3"
                        name="billing_note_no_3"
                        value={billingNoteNo3}
                        onChange={(e) => setBillingNoteNo3(e.target.value)}
                        placeholder="BN..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_note_date_3">วันที่ออกใบวางบิล</Label>
                      <DateInput id="billing_note_date_3" name="billing_note_date_3" value={billingNoteDate3} onChange={setBillingNoteDate3} />
                    </div>
                  </>
                )}
                {usesLegacyInvoiceNo && (
                  <div className="space-y-2">
                    <Label htmlFor="invoice_no_3">เลขที่เอกสาร</Label>
                    <Input
                      id="invoice_no_3"
                      name="invoice_no_3"
                      value={invoiceNo3}
                      onChange={(e) => setInvoiceNo3(e.target.value)}
                      placeholder="IV..."
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="amount_3">จำนวนเงิน</Label>
                  <NumberInput
                    id="amount_3"
                    name="amount_3"
                    min={0}
                    step={0.01}
                    value={amount3}
                    onChange={setAmount3}
                    placeholder="0"
                  />
                </div>
                {usesLegacyInvoiceNo && (
                  <div className="space-y-2">
                    <Label htmlFor="paid_date_3">วันที่ออกเอกสาร</Label>
                    <DateInput id="paid_date_3" name="paid_date_3" value={paidDate3} onChange={setPaidDate3} />
                  </div>
                )}
                {taxInvoiceNo3 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="tax_invoice_no_3">เลขที่ใบกำกับภาษี</Label>
                      <Input
                        id="tax_invoice_no_3"
                        name="tax_invoice_no_3"
                        value={taxInvoiceNo3}
                        onChange={(e) => setTaxInvoiceNo3(e.target.value)}
                        placeholder="INV..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax_invoice_date_3">วันที่ออกใบกำกับภาษี</Label>
                      <DateInput id="tax_invoice_date_3" name="tax_invoice_date_3" value={taxInvoiceDate3} onChange={setTaxInvoiceDate3} />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="receipt_no_3">เลขที่ใบเสร็จ</Label>
                  <Input
                    id="receipt_no_3"
                    name="receipt_no_3"
                    value={receiptNo3}
                    onChange={(e) => setReceiptNo3(e.target.value)}
                    placeholder="RE... (กรอกเมื่อได้รับเงินแล้ว)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="received_date_3">วันที่รับชำระเงิน</Label>
                  <DateInput id="received_date_3" name="received_date_3" value={receivedDate3} onChange={setReceivedDate3} />
                </div>
                {Number(whtAmount3) > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="wht_amount_3">หัก ณ ที่จ่าย</Label>
                    <NumberInput
                      id="wht_amount_3"
                      name="wht_amount_3"
                      min={0}
                      step={0.01}
                      value={whtAmount3}
                      onChange={setWhtAmount3}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setInstallment3(true)}>
              <Plus className="h-4 w-4" />
              เพิ่มงวดที่ 3
            </Button>
          ))}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">สถานะ</Label>
            <Select name="status" required value={status} onValueChange={(v) => setStatus(v ?? "")}>
              <SelectTrigger id="status" className="w-full">
                <SelectValue placeholder="เลือก" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">ยอดคงค้าง (คำนวณอัตโนมัติ)</Label>
            <p className="flex h-8 items-center text-sm font-medium">{formatTHB(outstanding)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : mode === "edit" ? "บันทึกการแก้ไข" : "บันทึกงานขาย"}
        </Button>
        {adjacentJobNos && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={!adjacentJobNos.prevJobNo}
              nativeButton={!adjacentJobNos.prevJobNo}
              render={
                adjacentJobNos.prevJobNo ? (
                  <Link href={`/dashboard/project-sales/edit/${encodeURIComponent(adjacentJobNos.prevJobNo)}`} />
                ) : undefined
              }
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              ย้อนกลับ
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!adjacentJobNos.nextJobNo}
              nativeButton={!adjacentJobNos.nextJobNo}
              render={
                adjacentJobNos.nextJobNo ? (
                  <Link href={`/dashboard/project-sales/edit/${encodeURIComponent(adjacentJobNos.nextJobNo)}`} />
                ) : undefined
              }
            >
              หน้าถัดไป
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
