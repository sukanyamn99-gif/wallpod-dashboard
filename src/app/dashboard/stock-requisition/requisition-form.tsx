"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Factory, FlaskConical, Package, Plus, Settings2, X } from "lucide-react";
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
import { CustomerAutocomplete } from "@/components/dashboard/customer-autocomplete";
import { JobNoSelect } from "@/components/dashboard/job-no-select";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { createStockRequisition } from "./actions";
import type { Customer, Department, RequisitionPurpose, StockProduct } from "@/lib/types";

const initialState = { error: null as string | null };

interface SelectedItem {
  stockProductId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

export function RequisitionForm({
  departments,
  jobNoSuggestions,
  customers,
  stockProducts,
  frequentlyUsed,
  showCosts = false,
}: {
  departments: Department[];
  jobNoSuggestions: string[];
  customers: Customer[];
  stockProducts: StockProduct[];
  frequentlyUsed: StockProduct[];
  showCosts?: boolean;
}) {
  const router = useRouter();
  const [jobNo, setJobNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [purpose, setPurpose] = useState<RequisitionPurpose>("production");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createStockRequisition(formData);
    if (!result.error) {
      router.push("/dashboard/stock-requisition");
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

  function addItem(product: StockProduct, qty = 1) {
    setItems((prev) => {
      const existing = prev.find((it) => it.stockProductId === product.id);
      if (existing) {
        return prev.map((it) =>
          it.stockProductId === product.id ? { ...it, quantity: it.quantity + qty } : it,
        );
      }
      return [
        ...prev,
        {
          stockProductId: product.id,
          sku: product.sku ?? "",
          name: product.name,
          unit: product.unit,
          quantity: qty,
          unitCost: product.unitCost,
        },
      ];
    });
  }

  function updateQuantity(id: string, quantity: number) {
    setItems((prev) => prev.map((it) => (it.stockProductId === id ? { ...it, quantity } : it)));
  }

  function updateUnitCost(id: string, unitCost: number) {
    setItems((prev) => prev.map((it) => (it.stockProductId === id ? { ...it, unitCost } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.stockProductId !== id));
  }

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
          fd.append("item_unit_cost", String(it.unitCost));
        }
        startTransition(() => formAction(fd));
      }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      {/* Left column */}
      <div className="space-y-4">
        {state.error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="department_id">แผนก</Label>
            <Link
              href="/dashboard/stock-requisition/departments"
              className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
            >
              <Settings2 className="h-3 w-3" />
              จัดการ
            </Link>
          </div>
          <Select name="department_id" required items={departments.map((d) => ({ value: d.id, label: d.name }))}>
            <SelectTrigger id="department_id" className="w-full">
              <SelectValue placeholder="— เลือกแผนก —" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="job_no"># เลข JOB</Label>
          <input type="hidden" name="job_no" value={jobNo} />
          <JobNoSelect id="job_no" value={jobNo} onChange={setJobNo} jobNos={jobNoSuggestions} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project_name">ชื่องาน / โครงการ</Label>
          <Input id="project_name" name="project_name" placeholder="เช่น Phone Boot Lot 1" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer_name">ลูกค้า</Label>
          <CustomerAutocomplete
            id="customer_name"
            name="customer_name"
            value={customerName}
            onChange={setCustomerName}
            customers={customers}
            placeholder="ค้นหาลูกค้า (ถ้ามี)"
          />
        </div>

        <div className="space-y-2">
          <Label>วัตถุประสงค์</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPurpose("production")}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors",
                purpose === "production" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <Factory className="h-5 w-5" />
              เบิกเพื่อผลิต
            </button>
            <button
              type="button"
              onClick={() => setPurpose("sample")}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition-colors",
                purpose === "sample" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <FlaskConical className="h-5 w-5" />
              เบิกทำตัวอย่าง
            </button>
          </div>
          <input type="hidden" name="purpose" value={purpose} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">หมายเหตุ</Label>
          <Textarea id="note" name="note" placeholder="เหตุผลหรือข้อมูลเพิ่มเติม..." />
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        {frequentlyUsed.length > 0 && (
          <div className="space-y-2">
            <Label>สินค้าที่ใช้บ่อย</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {frequentlyUsed.map((p) => {
                const low = p.quantityOnHand <= p.reorderPoint;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p)}
                    className="relative rounded-lg border p-3 text-left hover:bg-muted"
                  >
                    <span className="absolute top-2 right-2">
                      {low ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                    <p className="text-xs text-muted-foreground">{p.sku ?? "—"}</p>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className={cn("text-xs", low ? "text-destructive" : "text-muted-foreground")}>
                      คงเหลือ {formatNumber(p.quantityOnHand)} {p.unit}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
          <Label>รายการที่เลือก</Label>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">ยังไม่มีรายการสินค้า</p>
              <p className="text-xs text-muted-foreground">ค้นหาสินค้าหรือเลือกจากรายการด้านบน</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.stockProductId} className="flex items-center gap-2 rounded-lg border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.sku || "—"}</p>
                  </div>
                  <NumberInput
                    min={0.01}
                    step={0.01}
                    value={it.quantity}
                    onChange={(v) => updateQuantity(it.stockProductId, Number(v))}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">{it.unit}</span>
                  {showCosts && (
                    <div className="flex flex-col items-center gap-0.5">
                      <NumberInput
                        min={0}
                        step={0.01}
                        value={it.unitCost}
                        onChange={(v) => updateUnitCost(it.stockProductId, Number(v))}
                        className="w-24"
                      />
                      <span className="text-[10px] text-muted-foreground">ราคาต้นทุน/หน่วย</span>
                    </div>
                  )}
                  <Button type="button" variant="outline" size="icon-sm" onClick={() => removeItem(it.stockProductId)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/stock-requisition")}
          >
            ยกเลิก
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "กำลังส่ง..." : "ส่งคำขอเบิก"}
          </Button>
        </div>
      </div>
    </form>
  );
}
