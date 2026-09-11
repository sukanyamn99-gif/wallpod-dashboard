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
import { JobNoSelect } from "@/components/dashboard/job-no-select";
import { formatNumber, formatTHB } from "@/lib/format";
import { createPurchaseRequest } from "./actions";
import type { Department, StockProduct, Supplier } from "@/lib/types";
import type { JobLookupEntry } from "@/lib/data/reference";

const NONE_SUPPLIER = "__none__";

const initialState = { error: null as string | null, id: undefined as string | undefined };

interface SelectedItem {
  stockProductId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  supplierId: string;
  unitPrice: number;
}

export function PurchaseRequestForm({
  departments,
  stockProducts,
  suppliers,
  jobNoSuggestions,
  jobNoLookup,
}: {
  departments: Department[];
  stockProducts: StockProduct[];
  suppliers: Supplier[];
  jobNoSuggestions: string[];
  jobNoLookup: Record<string, JobLookupEntry>;
}) {
  const router = useRouter();
  const [jobNo, setJobNo] = useState("");
  const [projectName, setProjectName] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [, startTransition] = useTransition();

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await createPurchaseRequest(formData);
    if (!result.error && result.id) {
      router.push(`/dashboard/purchase-requests/view/${result.id}`);
    }
    return { error: result.error, id: result.id };
  }, initialState);

  function handleJobNoChange(value: string) {
    setJobNo(value);
    const match = jobNoLookup[value];
    if (match) setProjectName(match.projectName);
  }

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
          supplierId: "",
          unitPrice: 0,
        },
      ];
    });
  }

  function updateItem(id: string, field: "quantity" | "supplierId" | "unitPrice", value: string | number) {
    setItems((prev) => prev.map((it) => (it.stockProductId === id ? { ...it, [field]: value } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.stockProductId !== id));
  }

  const grandTotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);

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
          fd.append("item_supplier_id", it.supplierId);
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
          <div className="flex items-center justify-between">
            <Label htmlFor="department_id">ฝ่าย/แผนก</Label>
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

        <div className="space-y-2 rounded-lg border p-3">
          <Label>PROJECT</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">เลข JOB</Label>
              <input type="hidden" name="job_no" value={jobNo} />
              <JobNoSelect id="job_no" value={jobNo} onChange={handleJobNoChange} jobNos={jobNoSuggestions} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">ชื่อโครงการ</Label>
              <Input
                name="project_name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="ชื่อโครงการ"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="koonway_ref_no">No. Koonway</Label>
            <Input id="koonway_ref_no" name="koonway_ref_no" placeholder="เลขที่อ้างอิง (ถ้ามี)" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flexiplan_ref_no">No. Flexiplan</Label>
            <Input id="flexiplan_ref_no" name="flexiplan_ref_no" placeholder="เลขที่อ้างอิง (ถ้ามี)" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="purpose">เหตุผล / วัตถุประสงค์การขอซื้อ</Label>
          <Textarea id="purpose" name="purpose" placeholder="เช่น สต็อกใกล้หมด, งานลูกค้าด่วน..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">หมายเหตุ / รายละเอียดส่วนประกอบอื่นๆ</Label>
          <Textarea id="note" name="note" placeholder="ข้อมูลเพิ่มเติม..." />
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
          <Label>รายการที่ขอซื้อ</Label>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">ยังไม่มีรายการสินค้า</p>
              <p className="text-xs text-muted-foreground">ค้นหาสินค้าจากด้านบน</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">สินค้า</TableHead>
                    <TableHead className="whitespace-nowrap">ผู้ขาย (Supplier)</TableHead>
                    <TableHead className="whitespace-nowrap">จำนวน</TableHead>
                    <TableHead className="whitespace-nowrap">ราคา/หน่วย</TableHead>
                    <TableHead className="whitespace-nowrap text-right">รวม</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.stockProductId}>
                      <TableCell className="min-w-[140px]">
                        <p className="text-sm font-medium">{it.name}</p>
                        <p className="text-xs text-muted-foreground">{it.sku || "—"}</p>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <Select
                          value={it.supplierId || NONE_SUPPLIER}
                          onValueChange={(v) => updateItem(it.stockProductId, "supplierId", v === NONE_SUPPLIER ? "" : (v ?? ""))}
                          items={[{ value: NONE_SUPPLIER, label: "— ไม่ระบุ —" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="— ไม่ระบุ —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_SUPPLIER}>— ไม่ระบุ —</SelectItem>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
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
        </div>

        {items.length > 0 && (
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">มูลค่ารวมโดยประมาณ</p>
            <p className="text-lg font-semibold">{formatTHB(grandTotal)}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/purchase-requests")}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "กำลังบันทึก..." : "ส่งใบขอซื้อ"}
          </Button>
        </div>
      </div>
    </form>
  );
}
