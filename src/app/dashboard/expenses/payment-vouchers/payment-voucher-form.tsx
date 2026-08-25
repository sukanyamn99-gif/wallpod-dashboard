"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPaymentVoucher, updatePaymentVoucher } from "./actions";
import type { PaymentVoucher } from "@/lib/types";

const initialState: { error: string | null; docNo?: string } = { error: null };

export function PaymentVoucherForm({
  mode,
  voucherId,
  initialData,
}: {
  mode: "create" | "edit";
  voucherId?: string;
  initialData?: PaymentVoucher;
}) {
  const router = useRouter();
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

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

      {mode === "edit" && initialData && (
        <div className="space-y-1">
          <Label>เลขที่เอกสาร</Label>
          <p className="text-sm text-muted-foreground">{initialData.docNo}</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="voucher_date">วันที่</Label>
        <Input
          id="voucher_date"
          name="voucher_date"
          type="date"
          defaultValue={initialData?.voucherDate ?? new Date().toISOString().slice(0, 10)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="payee_name">ผู้รับเงิน</Label>
        <Input id="payee_name" name="payee_name" defaultValue={initialData?.payeeName} required />
      </div>

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
        <Label htmlFor="amount">จำนวนเงิน</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min="0"
          step="0.01"
          defaultValue={initialData?.amount}
          required
        />
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

      <div className="space-y-2">
        <Label htmlFor="reference_no">เลขที่อ้างอิง</Label>
        <Input
          id="reference_no"
          name="reference_no"
          placeholder="เช่น เลขที่เช็ค, เลขที่โอน"
          defaultValue={initialData?.referenceNo ?? undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">หมายเหตุ</Label>
        <Textarea id="note" name="note" defaultValue={initialData?.note ?? undefined} />
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
