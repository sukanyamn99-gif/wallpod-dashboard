"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import { createPurchaseOrderReceipt } from "./actions";
import type { PurchaseOrder } from "@/lib/types";

const initialState = { error: null as string | null, id: undefined as string | undefined };

interface ReceiveItem {
  orderItemId: string;
  stockProductId: string;
  sku: string;
  name: string;
  unit: string;
  remaining: number;
  quantity: number;
  unitCost: number;
}

function itemsFromOrder(order: PurchaseOrder | undefined): ReceiveItem[] {
  if (!order) return [];
  return order.items
    .filter((it) => it.stockProductId && it.quantity - it.receivedQuantity > 0)
    .map((it) => {
      const remaining = it.quantity - it.receivedQuantity;
      return {
        orderItemId: it.id,
        stockProductId: it.stockProductId as string,
        sku: it.productSku ?? "",
        name: it.productName,
        unit: it.unit,
        remaining,
        quantity: remaining,
        unitCost: it.unitPrice,
      };
    });
}

export function PurchaseOrderReceiptForm({ openOrders }: { openOrders: PurchaseOrder[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOrderId = searchParams.get("orderId") ?? "";

  const [orderId, setOrderId] = useState(preselectedOrderId);
  const [items, setItems] = useState<ReceiveItem[]>(() =>
    itemsFromOrder(openOrders.find((o) => o.id === preselectedOrderId)),
  );
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createPurchaseOrderReceipt(formData);
    if (!result.error && result.id) {
      router.push(`/dashboard/purchase-order-receipts/view/${result.id}`);
    }
    return { error: result.error, id: result.id };
  }, initialState);

  function handleSelectOrder(id: string) {
    setOrderId(id);
    setItems(itemsFromOrder(openOrders.find((o) => o.id === id)));
  }

  function updateItem(orderItemId: string, field: "quantity" | "unitCost", value: number) {
    setItems((prev) => prev.map((it) => (it.orderItemId === orderItemId ? { ...it, [field]: value } : it)));
  }

  const totalValue = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
  const selectedOrder = openOrders.find((o) => o.id === orderId);

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        for (const it of items) {
          if (it.quantity <= 0) continue;
          fd.append("item_order_item_id", it.orderItemId);
          fd.append("item_product_id", it.stockProductId);
          fd.append("item_name", it.name);
          fd.append("item_sku", it.sku);
          fd.append("item_unit", it.unit);
          fd.append("item_quantity", String(it.quantity));
          fd.append("item_unit_cost", String(it.unitCost));
        }
        startTransition(() => formAction(fd));
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <div className="space-y-4">
        {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

        <div className="space-y-2">
          <Label htmlFor="order_id">ใบสั่งซื้อ</Label>
          <input type="hidden" name="order_id" value={orderId} />
          <Select
            value={orderId}
            onValueChange={(v) => handleSelectOrder(v ?? "")}
            items={openOrders.map((o) => ({ value: o.id, label: `${o.docNo} — ${o.supplierName ?? "—"}` }))}
          >
            <SelectTrigger id="order_id" className="w-full">
              <SelectValue placeholder="— เลือกใบสั่งซื้อ —" />
            </SelectTrigger>
            <SelectContent>
              {openOrders.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.docNo} — {o.supplierName ?? "—"} ({o.receivingStatus})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {openOrders.length === 0 && <p className="text-xs text-muted-foreground">ไม่มีใบสั่งซื้อที่รอรับสินค้า</p>}
        </div>

        {selectedOrder && (
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">อ้างอิงใบขอซื้อ</p>
            <p className="font-medium">{selectedOrder.requestDocNo}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea id="note" name="note" placeholder="เช่น เลขที่ใบส่งของผู้จำหน่าย, สภาพสินค้าที่ได้รับ..." />
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">มูลค่ารวมที่รับเข้า</p>
          <p className="text-lg font-semibold">{formatTHB(totalValue)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <Label>รายการที่รับเข้า</Label>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">เลือกใบสั่งซื้อด้านซ้ายเพื่อดึงรายการที่รอรับ</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">รหัสสินค้า</TableHead>
                  <TableHead className="whitespace-nowrap">ชื่อสินค้า</TableHead>
                  <TableHead className="whitespace-nowrap">คงเหลือที่ต้องรับ</TableHead>
                  <TableHead className="whitespace-nowrap">จำนวนที่รับครั้งนี้</TableHead>
                  <TableHead className="whitespace-nowrap">ต้นทุน/หน่วย</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.orderItemId}>
                    <TableCell className="whitespace-nowrap">{it.sku || "—"}</TableCell>
                    <TableCell className="min-w-[140px]">{it.name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {it.remaining} {it.unit}
                    </TableCell>
                    <TableCell>
                      <NumberInput
                        min={0}
                        step={0.01}
                        value={it.quantity}
                        onChange={(v) => updateItem(it.orderItemId, "quantity", Number(v))}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <NumberInput
                        min={0}
                        step={0.01}
                        value={it.unitCost}
                        onChange={(v) => updateItem(it.orderItemId, "unitCost", Number(v))}
                        className="w-24"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/purchase-order-receipts")}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "กำลังบันทึก..." : "บันทึกใบรับสินค้า"}
          </Button>
        </div>
      </div>
    </form>
  );
}
