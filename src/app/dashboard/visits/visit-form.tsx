"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logVisit } from "./actions";
import type { Customer, SalesRep } from "@/lib/types";

const initialState = { error: null as string | null };

export function VisitForm({
  salesReps,
  customers,
}: {
  salesReps: SalesRep[];
  customers: Customer[];
}) {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return logVisit(formData);
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="sales_rep_id">เซลล์</Label>
        <Select name="sales_rep_id" required>
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
        <Label htmlFor="customer_id">ลูกค้า (ถ้ามี)</Label>
        <Select name="customer_id">
          <SelectTrigger id="customer_id" className="w-full">
            <SelectValue placeholder="เลือกลูกค้า" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">หมายเหตุ</Label>
        <Textarea id="note" name="note" placeholder="เช่น นำเสนอตัวอย่างวัสดุ, เก็บเงินงวดสุดท้าย" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "กำลังบันทึก..." : "บันทึกนัดหมาย"}
      </Button>
    </form>
  );
}
