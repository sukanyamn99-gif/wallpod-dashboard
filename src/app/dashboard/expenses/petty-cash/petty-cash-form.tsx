"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JobNoSelect } from "@/components/dashboard/job-no-select";
import { cn } from "@/lib/utils";
import { createPettyCashTransaction, updatePettyCashTransaction } from "./actions";
import type { PettyCashTransaction, PettyCashTransactionType, WhtFormType, WhtIncomeType } from "@/lib/types";

const initialState: { error: string | null; docNo?: string } = { error: null };

const WHT_FORM_OPTIONS: { value: WhtFormType; label: string }[] = [
  { value: "ภ.ง.ด.1", label: "ภ.ง.ด.1" },
  { value: "ภ.ง.ด.2", label: "ภ.ง.ด.2" },
  { value: "ภ.ง.ด.3", label: "ภ.ง.ด.3" },
  { value: "ภ.ง.ด.53", label: "ภ.ง.ด.53" },
];

const WHT_INCOME_TYPE_OPTIONS: { value: WhtIncomeType; label: string }[] = [
  { value: "1", label: "1. เงินเดือน ค่าจ้าง ฯลฯ มาตรา 40(1)" },
  { value: "2", label: "2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ มาตรา 40(2)" },
  { value: "3", label: "3. ค่าแห่งลิขสิทธิ์ ฯลฯ มาตรา 40(3)" },
  { value: "4a", label: "4(ก). ดอกเบี้ย ฯลฯ มาตรา 40(4)(ก)" },
  { value: "4b", label: "4(ข). เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ มาตรา 40(4)(ข)" },
  { value: "5", label: "5. ค่าจ้างทำของ/บริการ ตามคำสั่งกรมสรรพากร" },
  { value: "6", label: "6. อื่นๆ" },
];

// Common Thai withholding-tax rates (ภ.ง.ด.3/53 practice: 1% transport,
// 2%/3% services, 5% rent/advertising) — no single rate is universally
// correct, so this stays a picker rather than a hardcoded percentage.
const WHT_RATE_OPTIONS = [
  { value: "0", label: "ไม่มี" },
  { value: "1", label: "1%" },
  { value: "1.5", label: "1.5%" },
  { value: "2", label: "2%" },
  { value: "3", label: "3%" },
  { value: "5", label: "5%" },
];

// Matches the fixed category columns on the real petty-cash reconciliation
// sheet — offered as suggestions (a <datalist>, same free-text-with-
// suggestions pattern as customer/size autocompletes elsewhere) rather than
// a locked list, so a category the business hasn't used yet still works.
const SUGGESTED_CATEGORIES = [
  "ค่าจ้าง-ค่าบริการ",
  "อุปกรณ์สำนักงาน",
  "ค่าโทรศัพท์",
  "ค่าขนส่งสินค้า",
  "ค่าไปรษณีย์",
];

// Same click-to-fill idea as the category suggestions above, just as chips
// instead of a <datalist> — a <textarea> doesn't support the list attribute
// reliably across browsers, so this is a plain button that fills the field
// directly; the text stays fully editable afterward either way.
const DESCRIPTION_SUGGESTIONS: Record<PettyCashTransactionType, string[]> = {
  topup: ["เติมเงินสดย่อยประจำเดือน", "เติมเงินสดย่อยเพิ่มเติม"],
  expense: [
    "ซื้ออุปกรณ์สำนักงาน",
    "ค่าเดินทาง",
    "ค่าส่งเอกสาร/พัสดุ",
    "ค่าอาหาร/เครื่องดื่มรับรอง",
    "ค่าจอดรถ/ทางด่วน",
  ],
};

// Reconstructs the WHT rate picker's initial selection from a saved
// wht_amount — the column only stores the computed amount, not which rate
// produced it, so this backs it out and snaps to the closest known option
// (exact match in practice, since every save already went through this
// same fixed rate list).
function inferWhtRatePercent(whtAmount: number, preVatAmount: number): string {
  if (whtAmount <= 0 || preVatAmount <= 0) return "0";
  const impliedRate = (whtAmount / preVatAmount) * 100;
  let closest = WHT_RATE_OPTIONS[0];
  let closestDiff = Infinity;
  for (const opt of WHT_RATE_OPTIONS) {
    const diff = Math.abs(Number(opt.value) - impliedRate);
    if (diff < closestDiff) {
      closest = opt;
      closestDiff = diff;
    }
  }
  return closest.value;
}

export function PettyCashForm({
  categorySuggestions = SUGGESTED_CATEGORIES,
  recentDescriptions,
  recentBillers = [],
  jobNoSuggestions = [],
  mode = "create",
  transactionId,
  initialData,
}: {
  categorySuggestions?: string[];
  recentDescriptions?: Record<PettyCashTransactionType, string[]>;
  recentBillers?: string[];
  jobNoSuggestions?: string[];
  mode?: "create" | "edit";
  transactionId?: string;
  initialData?: PettyCashTransaction;
}) {
  const router = useRouter();
  const [type, setType] = useState<PettyCashTransactionType>(initialData?.transactionType ?? "expense");
  const [amount, setAmount] = useState(initialData ? String(initialData.amount) : "");
  const [whtRatePercent, setWhtRatePercent] = useState(() => {
    if (!initialData) return "0";
    const saved = initialData.whtRate === null ? null : String(initialData.whtRate);
    if (saved !== null && WHT_RATE_OPTIONS.some((o) => o.value === saved)) return saved;
    return inferWhtRatePercent(initialData.whtAmount, initialData.preVatAmount ?? initialData.amount / 1.07);
  });
  // Bill paid AFTER withholding was deducted (e.g. a phone bill paid net of
  // 3% WHT): the cash amount typed in is then the total minus WHT, not the
  // VAT-inclusive total. Only detectable on edit from the stored base:
  // amount matches pre-VAT + VAT - WHT instead of pre-VAT + VAT.
  const [netOfWht, setNetOfWht] = useState(() => {
    if (!initialData || initialData.preVatAmount === null || initialData.whtAmount <= 0) return false;
    const gross = initialData.preVatAmount + initialData.vatAmount;
    const net = gross - initialData.whtAmount;
    return Math.abs(initialData.amount - net) < 0.05 && Math.abs(initialData.amount - gross) >= 0.05;
  });
  const [whtFormType, setWhtFormType] = useState<string>(initialData?.whtFormType ?? "");
  const [incomeType, setIncomeType] = useState<string>(initialData?.incomeType ?? "5");
  const [jobNo, setJobNo] = useState(initialData?.jobNo ?? "");
  // Not every bill has VAT (many small/non-VAT-registered vendors don't
  // charge it) — checked by default since that's the common case, but a
  // biller with no VAT needs to be able to clear it back to 0 instead of
  // having it force-extracted from the total.
  const [hasVat, setHasVat] = useState(() => (initialData ? initialData.vatAmount > 0 : true));
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const billerRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);

  // Normally "จำนวนเงิน (รวมสุทธิ)" is entered VAT-inclusive, so VAT is
  // extracted out of it (×7/107) rather than added on top; WHT then applies
  // to the pre-VAT portion, matching standard Thai withholding-tax practice.
  // When hasVat is off, the full amount is treated as pre-VAT instead. In
  // net mode the amount is the cash actually paid after WHT was deducted, so
  // pre-VAT is solved from amount = preVat × (1 + vat% − wht%) instead.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const amountNum = Number(amount) || 0;
  const whtRateNum = Number(whtRatePercent) || 0;
  const netMode = type === "expense" && netOfWht && whtRateNum > 0;
  const vatFactor = hasVat ? 1.07 : 1;
  const divisor = netMode ? vatFactor - whtRateNum / 100 : vatFactor;
  const preVatAmount = amountNum > 0 ? round2(amountNum / divisor) : 0;
  const vatAmount = !hasVat || amountNum <= 0 ? 0 : netMode ? round2(preVatAmount * 0.07) : round2(amountNum - preVatAmount);
  const whtAmount = whtRateNum > 0 ? round2(preVatAmount * (whtRateNum / 100)) : 0;

  // Text actually typed before (most relevant to this business) leads,
  // followed by the generic fixed suggestions — deduplicated so a phrase
  // that happens to match both doesn't show twice.
  const descriptionChips = Array.from(
    new Set([...(recentDescriptions?.[type] ?? []), ...DESCRIPTION_SUGGESTIONS[type]]),
  );

  function fillDescription(text: string) {
    if (descriptionRef.current) {
      descriptionRef.current.value = text;
      descriptionRef.current.focus();
    }
  }

  function fillBiller(text: string) {
    if (billerRef.current) {
      billerRef.current.value = text;
      billerRef.current.focus();
    }
  }

  function fillCategory(text: string) {
    if (categoryRef.current) {
      categoryRef.current.value = text;
      categoryRef.current.focus();
    }
  }
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && transactionId
        ? await updatePettyCashTransaction(transactionId, formData)
        : await createPettyCashTransaction(formData);
    if (!result.error) {
      router.push("/dashboard/expenses/petty-cash");
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

      <div className="space-y-2">
        <Label>ประเภทรายการ</Label>
        <input type="hidden" name="transaction_type" value={type} />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("topup")}
            className={cn(
              "flex-1 rounded-md border px-3 py-2 text-sm font-medium",
              type === "topup" ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400" : "text-muted-foreground",
            )}
          >
            เติมเงิน
          </button>
          <button
            type="button"
            onClick={() => setType("expense")}
            className={cn(
              "flex-1 rounded-md border px-3 py-2 text-sm font-medium",
              type === "expense" ? "border-destructive bg-destructive/10 text-destructive" : "text-muted-foreground",
            )}
          >
            ใช้จ่าย
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="transaction_date">วันที่บิล</Label>
        <DateInput
          id="transaction_date"
          name="transaction_date"
          defaultValue={initialData?.transactionDate ?? new Date().toISOString().slice(0, 10)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">{netMode ? "จำนวนเงิน (ยอดจ่ายจริง หลังหัก ณ ที่จ่ายแล้ว)" : "จำนวนเงิน (รวมสุทธิ)"}</Label>
        <NumberInput
          id="amount"
          name="amount"
          min={0}
          step={0.01}
          value={amount}
          onChange={setAmount}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">รายการ</Label>
        <Textarea
          id="description"
          name="description"
          ref={descriptionRef}
          defaultValue={initialData?.description}
          placeholder="เช่น ซื้ออุปกรณ์สำนักงาน, เติมเงินสดย่อยประจำเดือน"
          required
        />
        <div className="flex flex-wrap gap-1.5">
          {descriptionChips.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => fillDescription(s)}
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {type === "expense" && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="biller_name">ผู้เบิก</Label>
              <Input
                id="biller_name"
                name="biller_name"
                ref={billerRef}
                defaultValue={initialData?.billerName ?? undefined}
                placeholder="ผู้เบิก/ผู้ซื้อของ"
              />
              {recentBillers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recentBillers.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => fillBiller(name)}
                      className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_no">งาน/Job</Label>
              <input type="hidden" name="job_no" value={jobNo} />
              <JobNoSelect id="job_no" value={jobNo} onChange={setJobNo} jobNos={jobNoSuggestions} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">หมวดหมู่</Label>
            <Input
              id="category"
              name="category"
              ref={categoryRef}
              defaultValue={initialData?.category ?? undefined}
              placeholder="เลือกหรือพิมพ์หมวดหมู่ใหม่"
            />
            <div className="flex flex-wrap gap-1.5">
              {categorySuggestions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => fillCategory(c)}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              {/* Display-only — this is the base the WHT amount below and
                  the printed ใบหัก ณ ที่จ่าย certificate both actually use
                  (amount minus VAT), shown here so that base is visible
                  without doing the math by hand. Not its own DB column:
                  it's always exactly amount - vat_amount, both of which are
                  already stored, so there's nothing to persist separately. */}
              <Label htmlFor="pre_vat_amount">ราคาก่อนภาษีมูลค่าเพิ่ม</Label>
              <NumberInput
                id="pre_vat_amount"
                name="pre_vat_amount"
                value={preVatAmount ? preVatAmount.toFixed(2) : ""}
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat_amount">ภาษีซื้อ</Label>
              <NumberInput
                id="vat_amount"
                name="vat_amount"
                value={vatAmount ? vatAmount.toFixed(2) : ""}
                readOnly
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={hasVat}
                  onChange={(e) => setHasVat(e.target.checked)}
                />
                บิลนี้มีภาษีมูลค่าเพิ่ม (คำนวณอัตโนมัติจากยอดรวม แยก VAT 7%)
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wht_rate">อัตราภาษีหัก ณ ที่จ่าย</Label>
              <input type="hidden" name="wht_rate" value={whtRatePercent} />
              <Select value={whtRatePercent} onValueChange={(v) => setWhtRatePercent(v ?? "0")} items={WHT_RATE_OPTIONS}>
                <SelectTrigger id="wht_rate" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHT_RATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {whtRateNum > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={netOfWht} onChange={(e) => setNetOfWht(e.target.checked)} />
                  จำนวนเงินที่กรอกคือยอดที่จ่ายจริงหลังหัก ณ ที่จ่ายแล้ว (ระบบคำนวณราคาก่อนภาษีให้ย้อนกลับ)
                </label>
              )}
              <Label htmlFor="wht_amount">ภาษีหัก ณ ที่จ่าย</Label>
              <NumberInput
                id="wht_amount"
                name="wht_amount"
                value={whtAmount ? whtAmount.toFixed(2) : ""}
                readOnly
              />
            </div>
          </div>

          {whtAmount > 0 && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-sm font-semibold">สำหรับพิมพ์ใบหัก ณ ที่จ่าย</p>
              <div className="space-y-2">
                <Label htmlFor="wht_cert_no">เลขที่ใบหัก ณ ที่จ่าย</Label>
                {/* Same auto-fill-once-then-editable convention as Payment
                    Voucher's own cert-no field — see payment-voucher-form.tsx. */}
                <Input id="wht_cert_no" name="wht_cert_no" defaultValue={initialData?.whtCertNo ?? undefined} />
                {!initialData?.whtCertNo && (
                  <p className="text-xs text-muted-foreground">
                    เว้นว่างไว้ได้ — ระบบจะรันเลขที่ให้อัตโนมัติเมื่อบันทึก
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="wht_form_type">ประเภทแบบ</Label>
                  <input type="hidden" name="wht_form_type" value={whtFormType} />
                  <Select value={whtFormType} onValueChange={(v) => setWhtFormType(v ?? "")} items={WHT_FORM_OPTIONS}>
                    <SelectTrigger id="wht_form_type" className="w-full">
                      <SelectValue placeholder="— ไม่ระบุ —" />
                    </SelectTrigger>
                    <SelectContent>
                      {WHT_FORM_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payee_tax_id">เลขประจำตัวผู้เสียภาษีของผู้รับเงิน</Label>
                  <Input id="payee_tax_id" name="payee_tax_id" defaultValue={initialData?.payeeTaxId ?? undefined} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="income_type">ประเภทเงินได้ (สำหรับใบหัก ณ ที่จ่าย)</Label>
                <input type="hidden" name="income_type" value={incomeType} />
                <Select value={incomeType} onValueChange={(v) => setIncomeType(v ?? "5")} items={WHT_INCOME_TYPE_OPTIONS}>
                  <SelectTrigger id="income_type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WHT_INCOME_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payee_address">ที่อยู่ผู้รับเงิน (สำหรับใบหัก ณ ที่จ่าย)</Label>
                <Textarea id="payee_address" name="payee_address" defaultValue={initialData?.payeeAddress ?? undefined} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
