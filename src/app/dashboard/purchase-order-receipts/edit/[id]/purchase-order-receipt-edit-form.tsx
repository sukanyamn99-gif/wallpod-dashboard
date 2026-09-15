"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { updatePurchaseOrderReceipt } from "../../actions";
import type { PurchaseOrderReceipt } from "@/lib/types";

const initialState = { error: null as string | null };

interface EditableItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

export function PurchaseOrderReceiptEditForm({ receipt }: { receipt: PurchaseOrderReceipt }) {
  const router = useRouter();
  const [note, setNote] = useState(receipt.note ?? "");
  const [items, setItems] = useState<EditableItem[]>(() =>
    receipt.items.map((it) => ({
      id: it.id,
      sku: it.productSku ?? "",
      name: it.productName,
      unit: it.unit,
      quantity: it.quantity,
      unitCost: it.unitCost,
    })),
  );
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await updatePurchaseOrderReceipt(receipt.id, formData);
    if (!result.error) {
      router.push(`/dashboard/purchase-order-receipts/view/${receipt.id}`);
    }
    return { error: result.error };
  }, initialState);

  function updateItem(id: string, field: "quantity" | "unitCost", value: number) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  }

  const totalValue = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("note", note);
        for (const it of items) {
          fd.append("item_id", it.id);
          fd.append("item_quantity", String(it.quantity));
          fd.append("item_unit_cost", String(it.unitCost));
        }
        startTransition(() => formAction(fd));
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <div className="space-y-4">
        {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">อ้างอิงใบสั่งซื้อ</p>
          <p className="font-medium">{receipt.orderDocNo}</p>
          <p className="mt-2 text-muted-foreground">ผู้จำหน่าย</p>
          <p className="font-medium">{receipt.supplierName ?? "—"}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น เลขที่ใบส่งของผู้จำหน่าย, สภาพสินค้าที่ได้รับ..."
          />
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">มูลค่ารวมที่รับเข้า</p>
          <p className="text-lg font-semibold">{formatTHB(totalValue)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Label>รายการที่รับเข้า</Label>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">รหัสสินค้า</TableHead>
                <TableHead className="whitespace-nowrap">ชื่อสินค้า</TableHead>
                <TableHead className="whitespace-nowrap">จำนวนที่รับ</TableHead>
                <TableHead className="whitespace-nowrap">ต้นทุน/หน่วย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="whitespace-nowrap">{it.sku || "—"}</TableCell>
                  <TableCell className="min-w-[140px]">{it.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <NumberInput
                        min={0.01}
                        step={0.01}
                        value={it.quantity}
                        onChange={(v) => updateItem(it.id, "quantity", Number(v))}
                        className="w-24"
                      />
                      <span className="text-xs whitespace-nowrap text-muted-foreground">{it.unit}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      min={0}
                      step={0.01}
                      value={it.unitCost}
                      onChange={(v) => updateItem(it.id, "unitCost", Number(v))}
                      className="w-24"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          แก้ไขได้เฉพาะจำนวน/ต้นทุนของรายการที่รับไปแล้ว — เพิ่มหรือลบรายการไม่ได้ที่นี่
        </p>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/purchase-order-receipts/view/${receipt.id}`)}
          >
            ยกเลิก
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
          </Button>
        </div>
      </div>
    </form>
  );
}
