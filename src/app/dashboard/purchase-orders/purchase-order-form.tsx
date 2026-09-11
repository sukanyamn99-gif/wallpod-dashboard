"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
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
import { createPurchaseOrder } from "./actions";
import type { PurchaseRequest, StockProduct, Supplier } from "@/lib/types";

const initialState = { error: null as string | null, id: undefined as string | undefined };

interface SelectedItem {
  stockProductId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export function PurchaseOrderForm({
  approvedRequests,
  suppliers,
  stockProducts,
}: {
  approvedRequests: PurchaseRequest[];
  suppliers: Supplier[];
  stockProducts: StockProduct[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRequestId = searchParams.get("requestId") ?? "";
  const costByProductId = useMemo(() => new Map(stockProducts.map((p) => [p.id, p.unitCost])), [stockProducts]);

  const [requestId, setRequestId] = useState(preselectedRequestId);
  const [items, setItems] = useState<SelectedItem[]>(() => {
    const pr = approvedRequests.find((r) => r.id === preselectedRequestId);
    if (!pr) return [];
    return pr.items
      .filter((it) => it.stockProductId)
      .map((it) => ({
        stockProductId: it.stockProductId as string,
        sku: it.productSku ?? "",
        name: it.productName,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: costByProductId.get(it.stockProductId as string) ?? 0,
      }));
  });
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createPurchaseOrder(formData);
    if (!result.error && result.id) {
      router.push(`/dashboard/purchase-orders/view/${result.id}`);
    }
    return { error: result.error, id: result.id };
  }, initialState);

  function handleSelectRequest(id: string) {
    setRequestId(id);
    const pr = approvedRequests.find((r) => r.id === id);
    if (!pr) {
      setItems([]);
      return;
    }
    setItems(
      pr.items
        .filter((it) => it.stockProductId)
        .map((it) => ({
          stockProductId: it.stockProductId as string,
          sku: it.productSku ?? "",
          name: it.productName,
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: costByProductId.get(it.stockProductId as string) ?? 0,
        })),
    );
  }

  function updateItem(id: string, field: "quantity" | "unitPrice", value: number) {
    setItems((prev) => prev.map((it) => (it.stockProductId === id ? { ...it, [field]: value } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.stockProductId !== id));
  }

  const totalAmount = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        for (const it of items) {
          fd.append("item_product_id", it.stockProductId);
          fd.append("item_name", it.name);
          fd.append("item_sku", it.sku);
          fd.append("item_unit", it.unit);
          fd.append("item_quantity", String(it.quantity));
          fd.append("item_unit_price", String(it.unitPrice));
        }
        startTransition(() => formAction(fd));
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      {/* Left column */}
      <div className="space-y-4">
        {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}

        <div className="space-y-2">
          <Label htmlFor="request_id">ใบขอซื้อ (ที่อนุมัติแล้ว)</Label>
          <input type="hidden" name="request_id" value={requestId} />
          <Select
            value={requestId}
            onValueChange={(v) => handleSelectRequest(v ?? "")}
            items={approvedRequests.map((r) => ({ value: r.id, label: `${r.docNo} — ${r.departmentName ?? "—"}` }))}
          >
            <SelectTrigger id="request_id" className="w-full">
              <SelectValue placeholder="— เลือกใบขอซื้อ —" />
            </SelectTrigger>
            <SelectContent>
              {approvedRequests.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.docNo} — {r.departmentName ?? "—"} ({r.items.length} รายการ)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {approvedRequests.length === 0 && (
            <p className="text-xs text-muted-foreground">ยังไม่มีใบขอซื้อที่อนุมัติแล้ว — ไปอนุมัติที่หน้าใบขอซื้อก่อน</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="supplier_id">ผู้จำหน่าย</Label>
            <Link href="/dashboard/suppliers" className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2">
              <Settings2 className="h-3 w-3" />
              จัดการ
            </Link>
          </div>
          <Select name="supplier_id" items={suppliers.map((s) => ({ value: s.id, label: s.name }))}>
            <SelectTrigger id="supplier_id" className="w-full">
              <SelectValue placeholder="— เลือกผู้จำหน่าย (ถ้ามี) —" />
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
          <Label htmlFor="expected_date">วันที่คาดว่าจะได้รับสินค้า</Label>
          <DateInput id="expected_date" name="expected_date" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea id="note" name="note" placeholder="เงื่อนไขการสั่งซื้อ, ข้อมูลเพิ่มเติม..." />
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">มูลค่ารวม</p>
          <p className="text-lg font-semibold">{formatTHB(totalAmount)}</p>
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <Label>รายการสินค้า (จากใบขอซื้อที่เลือก)</Label>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">เลือกใบขอซื้อด้านซ้ายเพื่อดึงรายการสินค้า</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">รหัสสินค้า</TableHead>
                  <TableHead className="whitespace-nowrap">ชื่อสินค้า</TableHead>
                  <TableHead className="whitespace-nowrap">จำนวน</TableHead>
                  <TableHead className="whitespace-nowrap">ราคา/หน่วย</TableHead>
                  <TableHead className="whitespace-nowrap text-right">รวม</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.stockProductId}>
                    <TableCell className="whitespace-nowrap">{it.sku || "—"}</TableCell>
                    <TableCell className="min-w-[140px]">{it.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <NumberInput
                          min={0.01}
                          step={0.01}
                          value={it.quantity}
                          onChange={(v) => updateItem(it.stockProductId, "quantity", Number(v))}
                          className="w-20"
                        />
                        <span className="text-xs whitespace-nowrap text-muted-foreground">{it.unit}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <NumberInput
                        min={0}
                        step={0.01}
                        value={it.unitPrice}
                        onChange={(v) => updateItem(it.stockProductId, "unitPrice", Number(v))}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatTHB(it.quantity * it.unitPrice)}</TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="icon-sm" onClick={() => removeItem(it.stockProductId)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/purchase-orders")}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "กำลังบันทึก..." : "บันทึกใบสั่งซื้อ"}
          </Button>
        </div>
      </div>
    </form>
  );
}
