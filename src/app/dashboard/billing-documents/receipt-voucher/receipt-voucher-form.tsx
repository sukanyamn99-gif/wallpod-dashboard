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

interface ItemDraft {
  key: number;
  description: string;
  amount: string;
}

interface LedgerDraft {
  key: number;
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
}

let nextKey = 0;
function emptyItem(): ItemDraft {
  return { key: nextKey++, description: "", amount: "" };
}
function emptyLedger(): LedgerDraft {
  return { key: nextKey++, accountCode: "", description: "", debit: "", credit: "" };
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
  const [items, setItems] = useState<ItemDraft[]>(() =>
    initialData.items.length > 0
      ? initialData.items.map((it) => ({
          key: nextKey++,
          description: it.description,
          amount: it.amount ? String(it.amount) : "",
        }))
      : [emptyItem()],
  );
  const [ledger, setLedger] = useState<LedgerDraft[]>(() =>
    initialData.ledgerLines.length > 0
      ? initialData.ledgerLines.map((l) => ({
          key: nextKey++,
          accountCode: l.accountCode ?? "",
          description: l.description ?? "",
          debit: l.debit ? String(l.debit) : "",
          credit: l.credit ? String(l.credit) : "",
        }))
      : [emptyLedger(), emptyLedger()],
  );

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && voucherId ? await updateReceiptVoucher(voucherId, formData) : await createReceiptVoucher(formData);
    if (!result.error) router.push(LIST_PATH);
    return result;
  }, initialState);

  const total = Math.round(items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0) * 100) / 100;
  const receiptSelectItems = [
    { value: NO_RECEIPT, label: "ไม่อ้างอิงใบเสร็จ (กรอกเอง)" },
    ...receiptOptions.map((o) => ({ value: o.id, label: o.label })),
  ];

  function updateItem(key: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function updateLedger(key: number, patch: Partial<LedgerDraft>) {
    setLedger((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLedger(key: number) {
    setLedger((prev) => {
      const next = prev.filter((l) => l.key !== key);
      return next.length > 0 ? next : [emptyLedger()];
    });
  }

  function removeItem(key: number) {
    setItems((prev) => {
      const next = prev.filter((it) => it.key !== key);
      return next.length > 0 ? next : [emptyItem()];
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
            เลือกแล้วระบบจะกรอกผู้ติดต่อและรายการรับเงินให้ — แก้ไขต่อได้ก่อนบันทึก
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

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">รายการ</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
            <Plus className="h-3.5 w-3.5" />
            เพิ่มรายการ
          </Button>
        </div>
        {items.map((it, i) => (
          <div key={it.key} className="grid gap-2 sm:grid-cols-[1fr_10rem_2rem] sm:items-center">
            <Input
              name="item_description"
              value={it.description}
              onChange={(e) => updateItem(it.key, { description: e.target.value })}
              placeholder={`รายการที่ ${i + 1}`}
            />
            <NumberInput
              name="item_amount"
              min={0}
              step={0.01}
              value={it.amount}
              onChange={(v) => updateItem(it.key, { amount: v })}
              placeholder="จำนวนเงิน"
            />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeItem(it.key)} title="ลบรายการ">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <p className="text-sm font-medium">รวมเป็นเงิน {formatTHB(total)} บาท</p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <p className="text-sm font-semibold">ช่องทางรับเงิน</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bank_name">ธนาคาร/สาขา</Label>
            <Input id="bank_name" name="bank_name" defaultValue={initialData.bankName ?? undefined} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank_account_no">เลขที่บัญชี</Label>
            <Input id="bank_account_no" name="bank_account_no" defaultValue={initialData.bankAccountNo ?? undefined} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay_date">ลงวันที่</Label>
            <DateInput id="pay_date" name="pay_date" defaultValue={initialData.payDate ?? undefined} />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">รายการบัญชี</p>
            <p className="text-xs text-muted-foreground">รหัสบัญชีตั้งต้นตามใบสำคัญรับเงินที่ใช้อยู่ — แก้ไขหรือเว้นว่างได้</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setLedger((prev) => [...prev, emptyLedger()])}>
            <Plus className="h-3.5 w-3.5" />
            เพิ่มรายการ
          </Button>
        </div>
        {ledger.map((l) => (
          <div key={l.key} className="grid gap-2 sm:grid-cols-[7rem_1fr_8rem_8rem_2rem] sm:items-center">
            <Input
              name="line_account_code"
              value={l.accountCode}
              onChange={(e) => updateLedger(l.key, { accountCode: e.target.value })}
              placeholder="รหัสบัญชี"
            />
            <Input
              name="line_description"
              value={l.description}
              onChange={(e) => updateLedger(l.key, { description: e.target.value })}
              placeholder="รายการ"
            />
            <NumberInput
              name="line_debit"
              min={0}
              step={0.01}
              value={l.debit}
              onChange={(v) => updateLedger(l.key, { debit: v })}
              placeholder="เดบิต"
            />
            <NumberInput
              name="line_credit"
              min={0}
              step={0.01}
              value={l.credit}
              onChange={(v) => updateLedger(l.key, { credit: v })}
              placeholder="เครดิต"
            />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLedger(l.key)} title="ลบรายการ">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
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
