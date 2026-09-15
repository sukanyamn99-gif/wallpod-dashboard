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

// stockProductId can be null here — a ใบขอซื้อ line for something not yet
// in the Stock Product catalog carries no stock_product_id either, and
// must not be silently dropped when pulled into a PO. Keyed by a local
// counter rather than stockProductId for the same reason.
interface SelectedItem {
  key: number;
  stockProductId: string | null;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

let nextKey = 1;

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
  const [supplierId, setSupplierId] = useState(
    () => approvedRequests.find((r) => r.id === preselectedRequestId)?.supplierId ?? "",
  );
  const [todayMs] = useState(() => Date.now());
  const [creditDays, setCreditDays] = useState("30");
  const [discountAmount, setDiscountAmount] = useState("");
  const [whtPercent, setWhtPercent] = useState("");
  const [items, setItems] = useState<SelectedItem[]>(() => {
    const pr = approvedRequests.find((r) => r.id === preselectedRequestId);
    if (!pr) return [];
    return pr.items.map((it) => ({
      key: nextKey++,
      stockProductId: it.stockProductId,
      sku: it.productSku ?? "",
      name: it.productName,
      unit: it.unit,
      quantity: it.quantity,
      // The requester's own suggested price (from the ใบขอซื้อ) takes
      // priority over the product's current cost — it's more specific to
      // this purchase, when given.
      unitPrice: it.unitPrice > 0 ? it.unitPrice : (it.stockProductId && costByProductId.get(it.stockProductId)) || 0,
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
      setSupplierId("");
      return;
    }
    setSupplierId(pr.supplierId ?? "");
    setItems(
      pr.items.map((it) => ({
        key: nextKey++,
        stockProductId: it.stockProductId,
        sku: it.productSku ?? "",
        name: it.productName,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice > 0 ? it.unitPrice : (it.stockProductId && costByProductId.get(it.stockProductId)) || 0,
      })),
    );
  }

  function updateItem(key: number, field: "quantity" | "unitPrice", value: number) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)));
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  const totalAmount = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const discountValue = Number(discountAmount) || 0;
  const afterDiscount = Math.max(0, totalAmount - discountValue);
  const vat = Math.round(afterDiscount * 0.07 * 100) / 100;
  const whtValue = Number(whtPercent) || 0;
  const whtAmount = Math.round(afterDiscount * (whtValue / 100) * 100) / 100;
  const netPayable = Math.round((afterDiscount + vat - whtAmount) * 100) / 100;

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("credit_days", creditDays || "0");
        fd.set("discount_amount", discountAmount || "0");
        fd.set("wht_percent", whtPercent || "0");
        for (const it of items) {
          fd.append("item_product_id", it.stockProductId ?? "");
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
          <input type="hidden" name="supplier_id" value={supplierId} />
          <Select
            value={supplierId}
            onValueChange={(v) => setSupplierId(v ?? "")}
            items={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          >
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="credit_days">เครดิต (วัน)</Label>
            <NumberInput id="credit_days" value={creditDays} onChange={setCreditDays} min={0} />
          </div>
          <div className="space-y-2">
            <Label>ครบกำหนด</Label>
            <p className="flex h-8 items-center text-sm text-muted-foreground">
              {new Date(todayMs + (Number(creditDays) || 0) * 86400000).toLocaleDateString("th-TH")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="discount_amount">ส่วนลด (บาท)</Label>
            <NumberInput id="discount_amount" value={discountAmount} onChange={setDiscountAmount} min={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wht_percent">หัก ณ ที่จ่าย (%)</Label>
            <NumberInput id="wht_percent" value={whtPercent} onChange={setWhtPercent} min={0} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea id="note" name="note" placeholder="เงื่อนไขการสั่งซื้อ, ข้อมูลเพิ่มเติม..." />
        </div>

        <div className="space-y-1 rounded-lg border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">รวมเป็นเงิน</span>
            <span>{formatTHB(totalAmount)}</span>
          </div>
          {discountValue > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">หักส่วนลด</span>
              <span>-{formatTHB(discountValue)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">ภาษีมูลค่าเพิ่ม 7%</span>
            <span>{formatTHB(vat)}</span>
          </div>
          {whtValue > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">หัก ณ ที่จ่าย {whtValue}%</span>
              <span>-{formatTHB(whtAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <span>ยอดชำระ</span>
            <span>{formatTHB(netPayable)}</span>
          </div>
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
                  <TableRow key={it.key}>
                    <TableCell className="whitespace-nowrap">{it.sku || (it.stockProductId ? "—" : "ยังไม่มีในระบบสินค้า")}</TableCell>
                    <TableCell className="min-w-[140px]">{it.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <NumberInput
                          min={0.01}
                          step={0.01}
                          value={it.quantity}
                          onChange={(v) => updateItem(it.key, "quantity", Number(v))}
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
                        onChange={(v) => updateItem(it.key, "unitPrice", Number(v))}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatTHB(it.quantity * it.unitPrice)}</TableCell>
                    <TableCell>
                      <Button type="button" variant="outline" size="icon-sm" onClick={() => removeItem(it.key)}>
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
