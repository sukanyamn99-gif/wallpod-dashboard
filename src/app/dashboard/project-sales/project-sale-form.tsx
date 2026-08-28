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
import { createProjectSale, getMaterialCostSuggestion, updateProjectSale } from "./actions";
import type { MaterialCostSuggestion } from "@/lib/data/stock-requisitions";
import type { AdjacentJobNos } from "@/lib/data/project-sales";
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

// Real data check (2026-08-27): 159/161 existing JOB NO.s use the Gregorian
// short year ("JB26..." for 2026) — the previous BE-based suggestion here
// ("JB69...") didn't match, so any new job saved without hand-editing the
// suggested number got a mismatched prefix and sorted to the end of its
// month instead of alongside the rest (JB6907155/156 in production).
function suggestedJobNo() {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `JB${yy}${mm}`;
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
  invoiceNo1: string;
  amount1: string;
  paidDate1: string;
  receiptNo1: string;
  receivedDate1: string;
  invoiceNo2: string;
  amount2: string;
  paidDate2: string;
  receiptNo2: string;
  receivedDate2: string;
  invoiceNo3: string;
  amount3: string;
  paidDate3: string;
  receiptNo3: string;
  receivedDate3: string;
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
}: {
  salesReps: SalesRep[];
  customers: Customer[];
  categories: string[];
  mode?: "create" | "edit";
  projectId?: string;
  initialData?: ProjectSaleInitialData;
  canSeeCosts?: boolean;
  adjacentJobNos?: AdjacentJobNos;
}) {
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
  const [materialCost, setMaterialCost] = useState(initialData?.costs.material_cost ?? "");
  const [materialCostSuggestion, setMaterialCostSuggestion] = useState<MaterialCostSuggestion | null>(null);
  const [materialCostError, setMaterialCostError] = useState<string | null>(null);
  const [fetchingMaterialCost, startMaterialCostFetch] = useTransition();

  function fetchMaterialCostSuggestion() {
    const jobNo = jobNoRef.current?.value ?? "";
    setMaterialCostError(null);
    setMaterialCostSuggestion(null);
    startMaterialCostFetch(async () => {
      const result = await getMaterialCostSuggestion(jobNo);
      if (result.error) setMaterialCostError(result.error);
      else setMaterialCostSuggestion(result.suggestion);
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
        setStatus("");
        setProductionStatus("");
        setMaterialCost("");
        setMaterialCostSuggestion(null);
        setMaterialCostError(null);
        setJobNoError(null);
        setFormKey((k) => k + 1);
      } else {
        setSavedMessage(true);
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
  const paidAmount = isAwaitingPayment
    ? 0
    : (receiptNo1.trim() ? Number(amount1) || 0 : 0) +
      (receiptNo2.trim() ? Number(amount2) || 0 : 0) +
      (receiptNo3.trim() ? Number(amount3) || 0 : 0);
  // Not floored at 0 — mirrors actions.ts's parseForm: an overpayment should
  // show as a negative number here too, not get silently hidden as ฿0.
  const outstanding = total - paidAmount;

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
              defaultValue={mode === "edit" ? initialData?.jobNo ?? "" : suggestedJobNo()}
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
            <h3 className="font-medium">ต้นทุน (ถ้ามี)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="material_cost">ค่าวัสดุ</Label>
                  <button
                    type="button"
                    onClick={fetchMaterialCostSuggestion}
                    disabled={fetchingMaterialCost}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                    title="ดึงยอดจากใบเบิกสินค้าที่ระบุ JOB NO. นี้"
                  >
                    <Download className="h-3 w-3" />
                    {fetchingMaterialCost ? "กำลังค้นหา..." : "ดึงยอดจากใบเบิก"}
                  </button>
                </div>
                <NumberInput
                  id="material_cost"
                  name="material_cost"
                  min={0}
                  step={0.01}
                  value={materialCost}
                  onChange={setMaterialCost}
                  placeholder="0"
                />
                {materialCostError && <p className="text-xs text-destructive">{materialCostError}</p>}
                {materialCostSuggestion && (
                  <div className="rounded-md border bg-muted/40 p-2 text-xs">
                    <p className="text-muted-foreground">
                      จากใบเบิกสินค้า {materialCostSuggestion.requisitionCount} ใบ ({materialCostSuggestion.itemCount} รายการ):{" "}
                      <span className="font-medium text-foreground">{formatTHB(materialCostSuggestion.total)}</span>
                      {materialCostSuggestion.missingCostItemCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {" "}
                          (มี {materialCostSuggestion.missingCostItemCount} รายการไม่ทราบต้นทุน ไม่รวมในยอดนี้)
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      * คำนวณจากต้นทุน/หน่วยปัจจุบันของสินค้า ไม่ใช่ต้นทุน ณ วันที่เบิกจริง
                    </p>
                    <button
                      type="button"
                      onClick={() => setMaterialCost(String(materialCostSuggestion.total))}
                      className="mt-1.5 text-xs font-medium text-primary underline underline-offset-2"
                    >
                      ใช้ยอดนี้
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="glue_cost">ค่ากาว</Label>
                <NumberInput id="glue_cost" name="glue_cost" min={0} step={0.01} defaultValue={initialData?.costs.glue_cost} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cutting_cost">ค่าตัด</Label>
                <NumberInput id="cutting_cost" name="cutting_cost" min={0} step={0.01} defaultValue={initialData?.costs.cutting_cost} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="install_cost">ค่าติดตั้งผู้รับเหมา</Label>
                <NumberInput id="install_cost" name="install_cost" min={0} step={0.01} defaultValue={initialData?.costs.install_cost} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parking_cost">ค่าที่จอดรถ</Label>
                <NumberInput id="parking_cost" name="parking_cost" min={0} step={0.01} defaultValue={initialData?.costs.parking_cost} placeholder="0" />
              </div>
              <div className="space-y-2">
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="invoice_no_1">เลขที่เอกสาร</Label>
              <Input id="invoice_no_1" name="invoice_no_1" defaultValue={initialData?.invoiceNo1} placeholder="IV..." />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="paid_date_1">วันที่ออกเอกสาร</Label>
              <DateInput id="paid_date_1" name="paid_date_1" defaultValue={initialData?.paidDate1} />
            </div>
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
              <DateInput id="received_date_1" name="received_date_1" defaultValue={initialData?.receivedDate1} />
            </div>
          </div>
        </div>

        {installment2 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">งวดที่ 2</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="invoice_no_2">เลขที่เอกสาร</Label>
                <Input id="invoice_no_2" name="invoice_no_2" defaultValue={initialData?.invoiceNo2} placeholder="IV..." />
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="paid_date_2">วันที่ออกเอกสาร</Label>
                <DateInput id="paid_date_2" name="paid_date_2" defaultValue={initialData?.paidDate2} />
              </div>
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
                <DateInput id="received_date_2" name="received_date_2" defaultValue={initialData?.receivedDate2} />
              </div>
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="space-y-2">
                  <Label htmlFor="invoice_no_3">เลขที่เอกสาร</Label>
                  <Input id="invoice_no_3" name="invoice_no_3" defaultValue={initialData?.invoiceNo3} placeholder="IV..." />
                </div>
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
                <div className="space-y-2">
                  <Label htmlFor="paid_date_3">วันที่ออกเอกสาร</Label>
                  <DateInput id="paid_date_3" name="paid_date_3" defaultValue={initialData?.paidDate3} />
                </div>
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
                  <DateInput id="received_date_3" name="received_date_3" defaultValue={initialData?.receivedDate3} />
                </div>
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
