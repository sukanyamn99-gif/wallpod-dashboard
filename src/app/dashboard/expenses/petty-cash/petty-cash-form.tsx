"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createPettyCashTransaction } from "./actions";
import type { PettyCashTransactionType } from "@/lib/types";

const initialState: { error: string | null; docNo?: string } = { error: null };

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

export function PettyCashForm({ categorySuggestions = SUGGESTED_CATEGORIES }: { categorySuggestions?: string[] }) {
  const router = useRouter();
  const [type, setType] = useState<PettyCashTransactionType>("expense");
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createPettyCashTransaction(formData);
    if (!result.error) {
      router.push("/dashboard/expenses/petty-cash");
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
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
        <Input
          id="transaction_date"
          name="transaction_date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">จำนวนเงิน (รวมสุทธิ)</Label>
        <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">รายการ</Label>
        <Textarea id="description" name="description" placeholder="เช่น ซื้ออุปกรณ์สำนักงาน, เติมเงินสดย่อยประจำเดือน" required />
      </div>

      {type === "expense" && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="biller_name">ผู้บิล</Label>
              <Input id="biller_name" name="biller_name" placeholder="ผู้เบิก/ผู้ซื้อของ" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_no">งาน/Job</Label>
              <Input id="job_no" name="job_no" placeholder="เช่น JB2601001 (ถ้ามี)" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">หมวดหมู่</Label>
            <Input id="category" name="category" list="petty-cash-categories" placeholder="เลือกหรือพิมพ์หมวดหมู่ใหม่" />
            <datalist id="petty-cash-categories">
              {categorySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vat_amount">ภาษีซื้อ</Label>
              <Input id="vat_amount" name="vat_amount" type="number" min="0" step="0.01" placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wht_amount">ภาษีหัก ณ ที่จ่าย</Label>
              <Input id="wht_amount" name="wht_amount" type="number" min="0" step="0.01" placeholder="0" />
            </div>
          </div>
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
