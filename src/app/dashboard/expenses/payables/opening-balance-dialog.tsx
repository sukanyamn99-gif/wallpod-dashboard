"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOpeningBalancePayable } from "./actions";
import type { Supplier } from "@/lib/types";

const initialState = { error: null as string | null };

export function OpeningBalanceDialog({ suppliers }: { suppliers: Supplier[] }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createOpeningBalancePayable(formData);
    if (!result.error) {
      setFormKey((k) => k + 1);
      setOpen(false);
    }
    return result;
  }, initialState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus className="h-4 w-4" />
        เพิ่มยอดยกมา
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form key={formKey} action={formAction} noValidate>
          <DialogHeader>
            <DialogTitle>เพิ่มยอดเจ้าหนี้ยกมา</DialogTitle>
            <DialogDescription>
              สำหรับหนี้ค่าสินค้าที่ค้างอยู่ก่อนเริ่มใช้ระบบนี้ — จะไม่กระทบสต็อกสินค้า
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 py-4">
            {state.error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="ob_supplier_id">ผู้จำหน่าย</Label>
              <Select name="supplier_id" required items={suppliers.map((s) => ({ value: s.id, label: s.name }))}>
                <SelectTrigger id="ob_supplier_id" className="w-full">
                  <SelectValue placeholder="— เลือกผู้จำหน่าย —" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ob_amount">จำนวนเงินที่ค้างจ่าย</Label>
              <NumberInput id="ob_amount" name="amount" min={0.01} step={0.01} required placeholder="0" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ob_debt_date">วันที่เริ่มค้าง (ถ้าทราบ)</Label>
              <DateInput id="ob_debt_date" name="debt_date" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ob_note">หมายเหตุ</Label>
              <Input
                id="ob_note"
                name="note"
                placeholder="เช่น ยอดคงค้างยกมาจากระบบเดิม"
                defaultValue="ยอดคงค้างยกมาจากระบบเดิม"
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
