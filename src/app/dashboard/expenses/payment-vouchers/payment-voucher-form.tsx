"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SizeAutocomplete } from "@/components/dashboard/size-autocomplete";
import { formatTHB } from "@/lib/format";
import { createPaymentVoucher, updatePaymentVoucher } from "./actions";
import { getJobNoError } from "@/lib/job-no";
import type { PaymentVoucher, WhtFormType } from "@/lib/types";

const initialState: { error: string | null; docNo?: string; id?: string } = { error: null };

const WHT_FORM_OPTIONS: { value: WhtFormType; label: string }[] = [
  { value: "ภ.ง.ด.1", label: "ภ.ง.ด.1" },
  { value: "ภ.ง.ด.2", label: "ภ.ง.ด.2" },
  { value: "ภ.ง.ด.3", label: "ภ.ง.ด.3" },
  { value: "ภ.ง.ด.53", label: "ภ.ง.ด.53" },
];

interface LedgerLineDraft {
  key: number;
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
}

let nextKey = 0;
function emptyLine(): LedgerLineDraft {
  return { key: nextKey++, accountCode: "", description: "", debit: "", credit: "" };
}

export function PaymentVoucherForm({
  mode,
  voucherId,
  initialData,
  jobNoSuggestions = [],
}: {
  mode: "create" | "edit";
  voucherId?: string;
  initialData?: PaymentVoucher;
  jobNoSuggestions?: string[];
}) {
  const router = useRouter();
  const [whtFormType, setWhtFormType] = useState<string>(initialData?.whtFormType ?? "");
  const [jobNo, setJobNo] = useState(initialData?.jobNo ?? "");
  const jobNoError = getJobNoError(jobNo);
  const [lines, setLines] = useState<LedgerLineDraft[]>(() => {
    if (initialData?.ledgerLines && initialData.ledgerLines.length > 0) {
      return initialData.ledgerLines.map((l) => ({
        key: nextKey++,
        accountCode: l.accountCode ?? "",
        description: l.description ?? "",
        debit: l.debit ? String(l.debit) : "",
        credit: l.credit ? String(l.credit) : "",
      }));
    }
    return [emptyLine(), emptyLine(), emptyLine()];
  });

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && voucherId
        ? await updatePaymentVoucher(voucherId, formData)
        : await createPaymentVoucher(formData);
    if (!result.error) {
      router.push("/dashboard/expenses/payment-vouchers");
    }
    return result;
  }, initialState);

  const lineTotalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const lineTotalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

  function updateLine(key: number, patch: Partial<LedgerLineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(key: number) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

      {mode === "edit" && initialData && (
        <div className="space-y-1">
          <Label>เลขที่เอกสาร</Label>
          <p className="text-sm text-muted-foreground">{initialData.docNo}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="voucher_date">วันที่</Label>
          <DateInput
            id="voucher_date"
            name="voucher_date"
            defaultValue={initialData?.voucherDate ?? new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wht_cert_no">เลขที่ใบหัก ณ ที่จ่าย</Label>
          <Input id="wht_cert_no" name="wht_cert_no" defaultValue={initialData?.whtCertNo ?? undefined} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="payee_name">จ่ายให้ (Payment to)</Label>
        <Input id="payee_name" name="payee_name" defaultValue={initialData?.payeeName} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">จำนวนเงิน</Label>
        <NumberInput
          id="amount"
          name="amount"
          min={0}
          step={0.01}
          defaultValue={initialData?.amount}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">รายการจ่าย</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="เช่น ชำระค่าประกันสังคม เดือนกรกฎาคม 2569"
          defaultValue={initialData?.description ?? undefined}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="category">หมวดหมู่ค่าใช้จ่าย</Label>
          <Input
            id="category"
            name="category"
            placeholder="เช่น ค่าเช่า, ค่าน้ำมัน, ค่าสาธารณูปโภค"
            defaultValue={initialData?.category ?? undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reference_no">เลขที่เอกสารแนบ</Label>
          <Input id="reference_no" name="reference_no" defaultValue={initialData?.referenceNo ?? undefined} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job_no">เลขที่ Job</Label>
          <SizeAutocomplete
            id="job_no"
            name="job_no"
            value={jobNo}
            onChange={setJobNo}
            suggestions={jobNoSuggestions}
            placeholder="เช่น JB2607001 (ถ้ามี)"
          />
          {jobNoError && <p className="text-xs text-destructive">{jobNoError}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">ทำจ่าย / หมายเหตุ</Label>
        <Textarea id="note" name="note" defaultValue={initialData?.note ?? undefined} />
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-semibold">ภาษีหัก ณ ที่จ่าย</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="wht_rate">อัตรา (%)</Label>
            <NumberInput id="wht_rate" name="wht_rate" min={0} step={0.01} defaultValue={initialData?.whtRate ?? undefined} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wht_amount">จำนวนภาษีหัก</Label>
            <NumberInput
              id="wht_amount"
              name="wht_amount"
              min={0}
              step={0.01}
              defaultValue={initialData?.whtAmount ?? undefined}
            />
          </div>
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
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <p className="text-sm font-semibold">การชำระเงินผ่านธนาคาร (ถ้ามี)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bank_name">ธนาคาร/สาขา</Label>
            <Input id="bank_name" name="bank_name" defaultValue={initialData?.bankName ?? undefined} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank_account_no">เลขที่บัญชี</Label>
            <Input id="bank_account_no" name="bank_account_no" defaultValue={initialData?.bankAccountNo ?? undefined} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank_transfer_date">วันที่โอน</Label>
            <DateInput
              id="bank_transfer_date"
              name="bank_transfer_date"
              defaultValue={initialData?.bankTransferDate ?? undefined}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_method">วิธีชำระเงิน</Label>
          <Input
            id="payment_method"
            name="payment_method"
            placeholder="เช่น เงินสด, โอนเงิน, เช็ค"
            defaultValue={initialData?.paymentMethod ?? undefined}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>รายการบัญชี (รหัสบัญชี / รายการ / เดบิต / เครดิต)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" />
            เพิ่มรายการ
          </Button>
        </div>
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.key} className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] items-center gap-2">
              <Input
                name="line_account_code"
                placeholder="รหัสบัญชี"
                value={line.accountCode}
                onChange={(e) => updateLine(line.key, { accountCode: e.target.value })}
              />
              <Input
                name="line_description"
                placeholder="รายการ"
                value={line.description}
                onChange={(e) => updateLine(line.key, { description: e.target.value })}
              />
              <NumberInput
                name="line_debit"
                min={0}
                step={0.01}
                placeholder="เดบิต"
                value={line.debit}
                onChange={(v) => updateLine(line.key, { debit: v })}
              />
              <NumberInput
                name="line_credit"
                min={0}
                step={0.01}
                placeholder="เครดิต"
                value={line.credit}
                onChange={(v) => updateLine(line.key, { credit: v })}
              />
              <Button type="button" variant="outline" size="icon-sm" onClick={() => removeLine(line.key)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        {(lineTotalDebit > 0 || lineTotalCredit > 0) && (
          <p className="text-sm text-muted-foreground">
            รวมเดบิต {formatTHB(lineTotalDebit)} · รวมเครดิต {formatTHB(lineTotalCredit)}
            {lineTotalDebit !== lineTotalCredit && (
              <span className="text-destructive"> — เดบิตกับเครดิตไม่เท่ากัน</span>
            )}
          </p>
        )}
      </div>

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
