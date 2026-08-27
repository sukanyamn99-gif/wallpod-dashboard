"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { formatNumber, formatTHB } from "@/lib/format";
import { createGoodsReceipt, updateGoodsReceipt } from "./actions";
import type { GoodsReceipt, Supplier, StockProduct } from "@/lib/types";

const initialState = { error: null as string | null };

interface SelectedItem {
  stockProductId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

export function GoodsReceiptForm({
  suppliers,
  stockProducts,
  mode = "create",
  receiptId,
  initialData,
}: {
  suppliers: Supplier[];
  stockProducts: StockProduct[];
  mode?: "create" | "edit";
  receiptId?: string;
  initialData?: GoodsReceipt;
}) {
  const router = useRouter();
  const [items, setItems] = useState<SelectedItem[]>(
    (initialData?.items ?? [])
      .filter((it) => it.stockProductId)
      .map((it) => ({
        stockProductId: it.stockProductId as string,
        sku: it.productSku ?? "",
        name: it.productName,
        unit: it.unit,
        quantity: it.quantity,
        unitCost: it.unitCost,
      })),
  );
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && receiptId
        ? await updateGoodsReceipt(receiptId, formData)
        : await createGoodsReceipt(formData);
    if (!result.error) {
      router.push(
        mode === "edit" && receiptId
          ? `/dashboard/goods-receipt/view/${receiptId}`
          : "/dashboard/goods-receipt",
      );
    }
    return result;
  }, initialState);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return stockProducts
      .filter((p) => (p.sku ?? "").toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, stockProducts]);

  function addItem(product: StockProduct) {
    setItems((prev) => {
      if (prev.some((it) => it.stockProductId === product.id)) return prev;
      return [
        ...prev,
        {
          stockProductId: product.id,
          sku: product.sku ?? "",
          name: product.name,
          unit: product.unit,
          quantity: 1,
          unitCost: product.unitCost ?? 0,
        },
      ];
    });
  }

  function updateItem(id: string, field: "quantity" | "unitCost", value: number) {
    setItems((prev) => prev.map((it) => (it.stockProductId === id ? { ...it, [field]: value } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.stockProductId !== id));
  }

  const totalValue = items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        for (const it of items) {
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
      {/* Left column */}
      <div className="space-y-4">
        {mode === "edit" && initialData && (
          <p className="text-sm text-muted-foreground">
            เลขที่เอกสาร: <span className="font-medium text-foreground">{initialData.docNo}</span>
          </p>
        )}

        {state.error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="supplier_id">ผู้จำหน่าย</Label>
            <Link
              href="/dashboard/suppliers"
              className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
            >
              <Settings2 className="h-3 w-3" />
              จัดการ
            </Link>
          </div>
          <Select
            name="supplier_id"
            items={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            defaultValue={initialData?.supplierId ?? undefined}
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
          <Label htmlFor="reference_no">เลขที่อ้างอิง</Label>
          <Input
            id="reference_no"
            name="reference_no"
            placeholder="เช่น เลขที่ใบส่งของผู้จำหน่าย"
            defaultValue={initialData?.referenceNo ?? undefined}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea id="note" name="note" placeholder="ข้อมูลเพิ่มเติม..." defaultValue={initialData?.note ?? undefined} />
        </div>

        <div className="rounded-lg border p-3 text-sm">
          <p className="text-muted-foreground">มูลค่ารวมโดยประมาณ</p>
          <p className="text-lg font-semibold">{formatTHB(totalValue)}</p>
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="product_search">เพิ่มรายการสินค้า</Label>
          <div className="relative">
            <Input
              id="product_search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
              placeholder="ค้นหาจากรหัสสินค้าหรือชื่อ..."
              autoComplete="off"
            />
            {searchOpen && searchResults.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
                {searchResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="block w-full px-2.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addItem(p);
                        setQuery("");
                        setSearchOpen(false);
                      }}
                    >
                      {p.sku ?? "—"} — {p.name} (คงเหลือ {formatNumber(p.quantityOnHand)} {p.unit})
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>รายการที่รับเข้า</Label>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">ยังไม่มีรายการสินค้า</p>
              <p className="text-xs text-muted-foreground">ค้นหาสินค้าจากด้านบน (เพิ่มได้หลายรายการในใบเดียวกัน)</p>
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
                          value={it.unitCost}
                          onChange={(v) => updateItem(it.stockProductId, "unitCost", Number(v))}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatTHB(it.quantity * it.unitCost)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => removeItem(it.stockProductId)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(
                mode === "edit" && receiptId
                  ? `/dashboard/goods-receipt/view/${receiptId}`
                  : "/dashboard/goods-receipt",
              )
            }
          >
            ยกเลิก
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "กำลังบันทึก..." : mode === "edit" ? "บันทึกการแก้ไข" : "บันทึกใบรับสินค้า"}
          </Button>
        </div>
      </div>
    </form>
  );
}
