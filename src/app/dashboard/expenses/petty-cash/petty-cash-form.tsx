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

export function PettyCashForm() {
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
        <Label htmlFor="amount">จำนวนเงิน</Label>
        <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">รายละเอียด</Label>
        <Textarea id="description" name="description" placeholder="เช่น ซื้ออุปกรณ์สำนักงาน, เติมเงินสดย่อยประจำเดือน" required />
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
