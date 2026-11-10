"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTHB } from "@/lib/format";
import type { ReceiptVoucher } from "@/lib/types";
import { createReceiptVoucher, updateReceiptVoucher } from "./actions";

const LIST_PATH = "/dashboard/billing-documents/receipt-voucher";
const initialState: { error: string | null; docNo?: string; id?: string } = { error: null };

// Base UI Select can't use "" as a real option value.
const NO_RECEIPT = "__none__";

export type ReceiptVoucherDraft = Omit<
  ReceiptVoucher,
  "id" | "docNo" | "recordedById" | "recordedByName" | "createdAt" | "amount"
>;

interface LineDraft {
  key: number;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
}

let nextKey = 0;
function emptyLine(): LineDraft {
  return { key: nextKey++, accountCode: "", accountName: "", debit: "", credit: "" };
}

export function ReceiptVoucherForm({
  mode,
  voucherId,
  docNo,
  initialData,
  receiptOptions = [],
}: {
  mode: "create" | "edit";
  voucherId?: string;
  docNo?: string;
  initialData: ReceiptVoucherDraft;
  // Receipts the voucher can be issued from (create mode only) — picking one
  // reloads the page with ?receiptId=… so the server fills in its data.
  receiptOptions?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<LineDraft[]>(() =>
    initialData.lines.length > 0
      ? initialData.lines.map((l) => ({
          key: nextKey++,
          accountCode: l.accountCode ?? "",
          accountName: l.accountName ?? "",
          debit: l.debit ? String(l.debit) : "",
          credit: l.credit ? String(l.credit) : "",
        }))
      : [emptyLine(), emptyLine()],
  );

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && voucherId ? await updateReceiptVoucher(voucherId, formData) : await createReceiptVoucher(formData);
    if (!result.error) router.push(LIST_PATH);
    return result;
  }, initialState);

  const totalDebit = Math.round(lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0) * 100) / 100;
  const totalCredit = Math.round(lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0) * 100) / 100;
  const balanced = Math.abs(totalDebit - totalCredit) <= 0.005;
  const receiptSelectItems = [
    { value: NO_RECEIPT, label: "ไม่อ้างอิงใบเสร็จ (กรอกเอง)" },
    ...receiptOptions.map((o) => ({ value: o.id, label: o.label })),
  ];

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: number) {
    setLines((prev) => {
      const next = prev.filter((l) => l.key !== key);
      return next.length > 0 ? next : [emptyLine()];
    });
  }

  return (
    <form
      // onSubmit (not action=) so a rejected save doesn't reset what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="max-w-3xl space-y-6"
      noValidate
    >
      {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

      <input type="hidden" name="receipt_id" value={initialData.receiptId ?? ""} />
      <input type="hidden" name="receipt_no" value={initialData.receiptNo ?? ""} />

      {mode === "create" ? (
        <div className="space-y-2">
          <Label htmlFor="receipt_picker">ดึงข้อมูลจากใบเสร็จรับเงิน</Label>
          <Select
            value={initialData.receiptId ?? NO_RECEIPT}
            onValueChange={(v) => {
              const id = v as string;
              router.push(id && id !== NO_RECEIPT ? `${LIST_PATH}/new?receiptId=${id}` : `${LIST_PATH}/new`);
            }}
            items={receiptSelectItems}
          >
            <SelectTrigger id="receipt_picker" className="w-full">
              <SelectValue placeholder="เลือกใบเสร็จรับเงิน" />
            </SelectTrigger>
            <SelectContent>
              {receiptSelectItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            เลือกแล้วระบบจะกรอกผู้ติดต่อ คำอธิบาย และรายการบัญชีให้ — แก้ไขต่อได้ก่อนบันทึก
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>เลขที่เอกสาร</Label>
            <p className="text-sm text-muted-foreground">{docNo}</p>
          </div>
          <div className="space-y-1">
            <Label>อ้างอิงใบเสร็จรับเงิน</Label>
            <p className="text-sm text-muted-foreground">{initialData.receiptNo ?? "—"}</p>
          </div>
        </div>
      )}

      <div className="space-y-2 sm:max-w-xs">
        <Label htmlFor="doc_date">วันที่</Label>
        <DateInput id="doc_date" name="doc_date" defaultValue={initialData.docDate} required />
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <p className="text-sm font-semibold">ผู้ติดต่อ (Contact)</p>
        <div className="space-y-2">
          <Label htmlFor="contact_name">ชื่อ</Label>
          <Input id="contact_name" name="contact_name" defaultValue={initialData.contactName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_address">ที่อยู่</Label>
          <Textarea id="contact_address" name="contact_address" defaultValue={initialData.contactAddress ?? undefined} />
        </div>
        <div className="space-y-2 sm:max-w-xs">
          <Label htmlFor="contact_tax_id">เลขประจำตัวผู้เสียภาษี</Label>
          <Input id="contact_tax_id" name="contact_tax_id" defaultValue={initialData.contactTaxId ?? undefined} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">คำอธิบาย (Description)</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="เช่น รับชำระเงิน #RE… จาก … Ref: #INV…"
          defaultValue={initialData.description ?? undefined}
        />
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">รายการบัญชี</p>
            <p className="text-xs text-muted-foreground">
              ตั้งรหัสบัญชีเริ่มต้นไว้ให้ตามใบสำคัญรับเงินที่ใช้อยู่ — แก้ไขรหัส/ชื่อบัญชีได้ และยอดเดบิตต้องเท่ากับเครดิต
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
            <Plus className="h-3.5 w-3.5" />
            เพิ่มรายการ
          </Button>
        </div>
        <div className="hidden gap-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[7rem_1fr_8rem_8rem_2rem]">
          <span>รหัสบัญชี</span>
          <span>ชื่อบัญชี</span>
          <span>เดบิต</span>
          <span>เครดิต</span>
          <span />
        </div>
        {lines.map((l) => (
          <div key={l.key} className="grid gap-2 sm:grid-cols-[7rem_1fr_8rem_8rem_2rem] sm:items-center">
            <Input
              name="line_account_code"
              value={l.accountCode}
              onChange={(e) => updateLine(l.key, { accountCode: e.target.value })}
              placeholder="รหัสบัญชี"
            />
            <Input
              name="line_account_name"
              value={l.accountName}
              onChange={(e) => updateLine(l.key, { accountName: e.target.value })}
              placeholder="ชื่อบัญชี"
            />
            <NumberInput
              name="line_debit"
              min={0}
              step={0.01}
              value={l.debit}
              onChange={(v) => updateLine(l.key, { debit: v })}
              placeholder="เดบิต"
            />
            <NumberInput
              name="line_credit"
              min={0}
              step={0.01}
              value={l.credit}
              onChange={(v) => updateLine(l.key, { credit: v })}
              placeholder="เครดิต"
            />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLine(l.key)} title="ลบรายการ">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap justify-between gap-2 text-sm font-medium">
          <span>รวมทั้งสิ้น</span>
          <span>
            เดบิต {formatTHB(totalDebit)} / เครดิต {formatTHB(totalCredit)}
          </span>
        </div>
        {!balanced && (
          <p className="text-xs text-amber-600">
            ยอดเดบิตกับเครดิตยังไม่เท่ากัน (ต่างกัน {formatTHB(Math.abs(totalDebit - totalCredit))} บาท) — บันทึกไม่ได้จนกว่าจะเท่ากัน
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">หมายเหตุ (Remark)</Label>
        <Textarea id="note" name="note" defaultValue={initialData.note ?? undefined} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(LIST_PATH)}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
