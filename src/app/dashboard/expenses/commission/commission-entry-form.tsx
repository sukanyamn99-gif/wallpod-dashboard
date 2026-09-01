"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { formatTHB } from "@/lib/format";
import { createCommissionEntry, updateCommissionEntry } from "./actions";
import type { CommissionEntry, CommissionRateTier } from "@/lib/types";

const initialState: { error: string | null } = { error: null };

export function CommissionEntryForm({
  tiers,
  mode = "create",
  entryId,
  initialData,
}: {
  tiers: CommissionRateTier[];
  mode?: "create" | "edit";
  entryId?: string;
  initialData?: CommissionEntry;
}) {
  const router = useRouter();
  const [entryDate, setEntryDate] = useState(initialData?.entryDate ?? new Date().toISOString().slice(0, 10));
  const [jobNo, setJobNo] = useState(initialData?.jobNo ?? "");
  const [projectTitle, setProjectTitle] = useState(initialData?.projectTitle ?? "");
  const [projectName, setProjectName] = useState(initialData?.projectName ?? "");
  const [brokerName, setBrokerName] = useState(initialData?.brokerName ?? "");
  const [amount, setAmount] = useState(initialData ? String(initialData.amount) : "");
  const [discountPercent, setDiscountPercent] = useState(
    initialData ? String(initialData.discountPercent) : "0",
  );
  const [commissionRatePercent, setCommissionRatePercent] = useState(
    initialData ? String(initialData.commissionRatePercent) : "",
  );
  const [installmentLabel, setInstallmentLabel] = useState(initialData?.installmentLabel ?? "");
  const [invoiceNo, setInvoiceNo] = useState(initialData?.invoiceNo ?? "");
  const [receiptNo, setReceiptNo] = useState(initialData?.receiptNo ?? "");
  const [receivedDate, setReceivedDate] = useState(initialData?.receivedDate ?? "");
  const [paidAmount, setPaidAmount] = useState(initialData?.paidAmount != null ? String(initialData.paidAmount) : "");

  // Auto-fills the commission rate from the discount tier table whenever
  // the discount % matches a known tier — still a plain editable field, so
  // a discount % outside the table (or a special negotiated rate) can be
  // typed in directly without being overwritten.
  function handleDiscountChange(value: string) {
    setDiscountPercent(value);
    const match = tiers.find((t) => t.discountPercent === Number(value));
    if (match) setCommissionRatePercent(String(match.commissionRatePercent));
  }

  const amountNum = Number(amount) || 0;
  const amountInclVat = Math.round(amountNum * 1.07 * 100) / 100;
  const commissionAmount = Math.round((amountNum * (Number(commissionRatePercent) || 0)) / 100 * 100) / 100;

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && entryId
        ? await updateCommissionEntry(entryId, formData)
        : await createCommissionEntry(formData);
    if (!result.error) {
      router.push("/dashboard/expenses/commission");
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="max-w-2xl space-y-4" noValidate>
      {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="entry_date">วันที่</Label>
          <DateInput id="entry_date" name="entry_date" value={entryDate} onChange={setEntryDate} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job_no">เลขที่ Job</Label>
          <Input id="job_no" name="job_no" value={jobNo} onChange={(e) => setJobNo(e.target.value)} placeholder="เช่น JB2602038" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="project_title">ชื่องาน/บริษัท</Label>
        <Input
          id="project_title"
          name="project_title"
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project_name">ชื่อโปรเจค</Label>
        <Input id="project_name" name="project_name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="broker_name">พนักงานขาย/นายหน้า</Label>
        <Input
          id="broker_name"
          name="broker_name"
          value={brokerName}
          onChange={(e) => setBrokerName(e.target.value)}
          placeholder="เช่น วรินทร (พี่นิ้ง)"
          required
        />
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount">จำนวนเงิน (ก่อน VAT)</Label>
            <NumberInput id="amount" name="amount" min={0} step={0.01} value={amount} onChange={setAmount} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>จำนวนเงิน +VAT</Label>
            <p className="flex h-8 items-center text-sm text-muted-foreground">{formatTHB(amountInclVat)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="discount_percent">อัตราส่วนลด (%)</Label>
            <NumberInput
              id="discount_percent"
              name="discount_percent"
              min={0}
              step={0.01}
              value={discountPercent}
              onChange={handleDiscountChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission_rate_percent">อัตราค่าคอมมิชชั่น (%)</Label>
            <NumberInput
              id="commission_rate_percent"
              name="commission_rate_percent"
              min={0}
              step={0.01}
              value={commissionRatePercent}
              onChange={setCommissionRatePercent}
            />
          </div>
        </div>
        <p className="text-sm">
          ค่าคอมมิชชั่น: <span className="font-semibold text-primary">{formatTHB(commissionAmount)}</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="installment_label">รายการ (งวดที่)</Label>
        <Input
          id="installment_label"
          name="installment_label"
          value={installmentLabel}
          onChange={(e) => setInstallmentLabel(e.target.value)}
          placeholder="เช่น งวดที่ 1 100%"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="paid_amount">จำนวนเงินที่ชำระ (+VAT)</Label>
          <NumberInput id="paid_amount" name="paid_amount" min={0} step={0.01} value={paidAmount} onChange={setPaidAmount} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="received_date">วันที่รับชำระ</Label>
          <DateInput id="received_date" name="received_date" value={receivedDate} onChange={setReceivedDate} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice_no">เลขที่ใบกำกับ (IV)</Label>
          <Input id="invoice_no" name="invoice_no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="receipt_no">เลขที่ใบรับเงิน (RE)</Label>
          <Input id="receipt_no" name="receipt_no" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">หมายเหตุ</Label>
        <Textarea id="note" name="note" defaultValue={initialData?.note ?? undefined} placeholder="หมายเหตุ (ถ้ามี)" />
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
