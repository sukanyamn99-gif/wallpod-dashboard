"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Plus, Settings2, X } from "lucide-react";
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
import { formatTHB } from "@/lib/format";
import { createPurchaseRequest } from "./actions";
import type { Department, StockProduct, Supplier } from "@/lib/types";
import type { JobLookupEntry } from "@/lib/data/reference";

const NONE_SUPPLIER = "__none__";

const initialState = { error: null as string | null, id: undefined as string | undefined };

// stockProductId is null for a manually-typed item with no catalog entry
// yet (e.g. "ไม้ PB 9 mm. สีขาว ขนาดตามแบบแนบ" — a real material never
// bought before) — a ใบขอซื้อ needs to name something before it exists in
// Stock Product, unlike every other document in this app that only ever
// picks from the existing catalog. Keyed by a local counter instead of
// stockProductId since multiple manual rows have no id to dedupe by.
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

// The ชื่อสินค้า cell for one row — typing suggests matching Stock Product
// catalog entries (same "existing item" list the old top search box drew
// from); picking one fills sku/unit/stockProductId too, but typing anything
// that doesn't match just stays a free-text item (the same fallback the
// catalog-only rest of this app doesn't otherwise need — see SelectedItem's
// own comment on why).
function ItemNameCell({
  item,
  stockProducts,
  onUpdate,
}: {
  item: SelectedItem;
  stockProducts: StockProduct[];
  onUpdate: (patch: Partial<SelectedItem>) => void;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = item.name.trim().toLowerCase();
    if (!q) return [];
    return stockProducts
      .filter((p) => (p.sku ?? "").toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [item.name, stockProducts]);

  return (
    <div className="relative min-w-[160px]">
      <Input
        value={item.name}
        onChange={(e) => {
          // Typing away from a previously-matched product turns this back
          // into a free-text row — same "no longer bound to that catalog
          // entry" rule the top-level search-and-add used to enforce by
          // only ever adding a fresh row per pick.
          onUpdate({ name: e.target.value, stockProductId: null, sku: "" });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="พิมพ์ชื่อหรือรหัสสินค้า..."
        autoComplete="off"
        className="text-sm font-medium"
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
                  onUpdate({ name: p.name, sku: p.sku ?? "", unit: p.unit, stockProductId: p.id });
                  setOpen(false);
                }}
              >
                {p.sku ?? "—"} — {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
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

  // A blank row the user fills in directly (name/quantity/price all inline)
  // — no separate search-then-add step. Typing a name still suggests
  // existing Stock Product entries via ItemNameCell, exactly like before;
  // this just changes how a row gets created in the first place.
  function addBlankItem() {
    setItems((prev) => [
      ...prev,
      { key: nextKey++, stockProductId: null, sku: "", name: "", unit: "ชิ้น", quantity: 1, unitPrice: 0 },
    ]);
  }

  function updateItem(key: number, patch: Partial<SelectedItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((it) => it.key !== key));
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
          <input type="hidden" name="supplier_id" value={supplierId} />
          <Select
            value={supplierId || NONE_SUPPLIER}
            onValueChange={(v) => setSupplierId(v === NONE_SUPPLIER ? "" : (v ?? ""))}
            items={[{ value: NONE_SUPPLIER, label: "— ไม่ระบุ —" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
          >
            <SelectTrigger id="supplier_id" className="w-full">
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
          <div className="flex items-center justify-between">
            <Label>รายการที่ขอซื้อ</Label>
            <Button type="button" variant="outline" size="sm" onClick={addBlankItem}>
              <Plus className="h-4 w-4" />
              เพิ่มรายการ
            </Button>
          </div>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">ยังไม่มีรายการสินค้า</p>
              <p className="text-xs text-muted-foreground">กด &quot;เพิ่มรายการ&quot; ด้านบนเพื่อเริ่มกรอก</p>
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
                    <TableHead className="whitespace-nowrap text-right">ราคารวม</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.key}>
                      <TableCell className="whitespace-nowrap">
                        {it.sku ||
                          (it.stockProductId
                            ? "—"
                            : it.name.trim() && (
                                <span className="text-xs text-muted-foreground">ยังไม่มีในระบบสินค้า</span>
                              ))}
                      </TableCell>
                      <TableCell>
                        <ItemNameCell item={it} stockProducts={stockProducts} onUpdate={(patch) => updateItem(it.key, patch)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <NumberInput
                            min={0.01}
                            step={0.01}
                            value={it.quantity}
                            onChange={(v) => updateItem(it.key, { quantity: Number(v) })}
                            className="w-20"
                          />
                          <Input
                            value={it.unit}
                            onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                            className="w-14 px-1 text-xs"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <NumberInput
                          min={0}
                          step={0.01}
                          value={it.unitPrice}
                          onChange={(v) => updateItem(it.key, { unitPrice: Number(v) })}
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
