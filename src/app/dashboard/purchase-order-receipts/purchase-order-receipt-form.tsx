"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { PurchaseOrder, StockProduct } from "@/lib/types";

const initialState = { error: null as string | null, id: undefined as string | undefined };

interface ReceiveItem {
  orderItemId: string;
  // null when the ใบขอซื้อ line this PO item came from was free-typed —
  // never matched to a real Stock Product catalog entry. Can't be received
  // (stock has nowhere to deduct into) until linked to one here.
  stockProductId: string | null;
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
    .filter((it) => it.quantity - it.receivedQuantity > 0)
    .map((it) => {
      const remaining = it.quantity - it.receivedQuantity;
      return {
        orderItemId: it.id,
        stockProductId: it.stockProductId,
        sku: it.productSku ?? "",
        name: it.productName,
        unit: it.unit,
        remaining,
        quantity: remaining,
        unitCost: it.unitPrice,
      };
    });
}

// Search-and-link cell for a PO item with no matching Stock Product yet —
// same Input + filtered-suggestion-list + onMouseDown pattern already
// proven for this kind of "free-typed item, optional catalog match" field
// elsewhere in this app (e.g. Purchase Request's ItemSearchCell).
function LinkStockProductCell({
  item,
  stockProducts,
  onLink,
}: {
  item: ReceiveItem;
  stockProducts: StockProduct[];
  onLink: (product: StockProduct) => void;
}) {
  const [query, setQuery] = useState(item.name);
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return stockProducts
      .filter((p) => (p.sku ?? "").toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, stockProducts]);

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder="ค้นหาสินค้าในสต๊อกที่ตรงกัน..."
          className="text-sm"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-64 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onLink(p);
                  }}
                >
                  {p.sku ?? "—"} — {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="flex items-center gap-1 text-xs text-destructive">
        ยังไม่ได้ผูกกับสินค้าในระบบ — เลือกสินค้าที่ตรงกัน หรือ
        <Link href="/dashboard/stock-product/new" target="_blank" className="inline-flex items-center gap-0.5 underline underline-offset-2">
          เพิ่มสินค้าใหม่ <ExternalLink className="h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}

export function PurchaseOrderReceiptForm({
  openOrders,
  stockProducts,
}: {
  openOrders: PurchaseOrder[];
  stockProducts: StockProduct[];
}) {
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

  function linkStockProduct(orderItemId: string, product: StockProduct) {
    setItems((prev) =>
      prev.map((it) =>
        it.orderItemId === orderItemId
          ? { ...it, stockProductId: product.id, sku: product.sku ?? it.sku, unit: product.unit }
          : it,
      ),
    );
  }

  const totalValue = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
  const selectedOrder = openOrders.find((o) => o.id === orderId);
  const unlinkedCount = items.filter((it) => !it.stockProductId).length;

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        for (const it of items) {
          if (it.quantity <= 0 || !it.stockProductId) continue;
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
                {items.map((it) =>
                  it.stockProductId ? (
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
                  ) : (
                    // No stockProductId — this ใบขอซื้อ line was free-typed
                    // and never matched to a real Stock Product, so there's
                    // nothing to deduct stock into yet. Spans the row with a
                    // search/link cell instead of the normal columns.
                    <TableRow key={it.orderItemId}>
                      <TableCell colSpan={3} className="min-w-[220px]">
                        <p className="mb-1 text-sm font-medium">
                          {it.name} <span className="font-normal text-muted-foreground">({it.remaining} {it.unit})</span>
                        </p>
                        <LinkStockProductCell
                          item={it}
                          stockProducts={stockProducts}
                          onLink={(product) => linkStockProduct(it.orderItemId, product)}
                        />
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
                  ),
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {unlinkedCount > 0 && (
          <p className="text-xs text-amber-600">
            มี {unlinkedCount} รายการที่ยังไม่ได้ผูกกับสินค้าในระบบ — รายการเหล่านี้จะไม่ถูกบันทึกจนกว่าจะเลือกสินค้าที่ตรงกัน
          </p>
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
