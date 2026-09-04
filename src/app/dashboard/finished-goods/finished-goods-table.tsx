"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Check, PackagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTHB } from "@/lib/format";
import type { FinishedGood } from "@/lib/types";
import type { QuotationItemRaw } from "@/lib/data/quotations";
import { JobNoSelect } from "@/components/dashboard/job-no-select";
import {
  createFinishedGood,
  deleteFinishedGood,
  fetchAcceptedQuotationItemsForJob,
  receiveFinishedGood,
  updateFinishedGood,
} from "./actions";

const addInitialState = { error: null as string | null };

// Empty-string fallback for every text field, since a picked quotation item
// may itself have null thickness/size/color — never render "null" into the
// form.
function AddFinishedGoodForm({ jobNoSuggestions }: { jobNoSuggestions: string[] }) {
  const [formKey, setFormKey] = useState(0);
  const [jobNo, setJobNo] = useState("");
  const [name, setName] = useState("");
  const [thickness, setThickness] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [initialQty, setInitialQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [quotationMatch, setQuotationMatch] = useState<{ quotationDocNo: string; items: QuotationItemRaw[] } | null>(null);
  const [quotationLoading, setQuotationLoading] = useState(false);

  const [state, formAction, pending] = useActionState(async (_prev: typeof addInitialState, formData: FormData) => {
    const result = await createFinishedGood(formData);
    if (!result.error) {
      setFormKey((k) => k + 1);
      setJobNo("");
      setName("");
      setThickness("");
      setSize("");
      setColor("");
      setInitialQty("");
      setUnitCost("");
      setQuotationMatch(null);
    }
    return result;
  }, addInitialState);

  // Only fires once a real JOB NO. is committed (JobNoSelect reverts
  // anything that doesn't match an existing job) — looks up that job's
  // accepted quotation. A single-item quotation (the common case) fills
  // the form immediately with no extra click; a multi-item quotation still
  // shows the picker below since guessing which line was actually produced
  // would risk silently filling in the wrong one. A JOB with no quotation
  // on file at all (expected for anything before quotations were adopted,
  // per the user — no fallback needed) just leaves the form blank as before.
  function handleJobNoChange(value: string) {
    setJobNo(value);
    setQuotationMatch(null);
    if (!value) return;
    setQuotationLoading(true);
    fetchAcceptedQuotationItemsForJob(value)
      .then((result) => {
        setQuotationMatch(result);
        if (result?.items.length === 1) applyQuotationItem(result.items[0]);
      })
      .finally(() => setQuotationLoading(false));
  }

  // Pulls descriptive fields and a suggested quantity from the quotation
  // item — never unit_cost, since a quotation's price is what's charged to
  // the customer, not this app's internal production cost. Every field
  // stays editable afterward.
  function applyQuotationItem(item: QuotationItemRaw) {
    setName(item.productName);
    setThickness(item.thickness ?? "");
    setSize(item.size ?? "");
    setColor(item.color ?? "");
    setInitialQty(String(item.qty));
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <form key={formKey} action={formAction} className="flex flex-wrap items-start gap-2" noValidate>
        <div className="w-[160px]">
          <JobNoSelect value={jobNo} onChange={handleJobNoChange} jobNos={jobNoSuggestions} placeholder="JOB ที่ผลิต (ถ้ามี)" />
          <input type="hidden" name="job_no" value={jobNo} />
        </div>
        <Input name="name" placeholder="ชื่อสินค้า" className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          name="thickness"
          placeholder="ความหนา (ถ้ามี)"
          className="max-w-[120px]"
          value={thickness}
          onChange={(e) => setThickness(e.target.value)}
        />
        <Input name="size" placeholder="ขนาด (ถ้ามี)" className="max-w-[120px]" value={size} onChange={(e) => setSize(e.target.value)} />
        <Input name="color" placeholder="สี (ถ้ามี)" className="max-w-[100px]" value={color} onChange={(e) => setColor(e.target.value)} />
        <NumberInput
          name="initial_quantity"
          placeholder="จำนวนเริ่มต้น"
          min={0}
          step={0.01}
          className="max-w-[130px]"
          value={initialQty}
          onChange={setInitialQty}
        />
        <NumberInput
          name="unit_cost"
          placeholder="ราคา/หน่วย"
          min={0}
          step={0.01}
          className="max-w-[120px]"
          value={unitCost}
          onChange={setUnitCost}
        />
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />
          {pending ? "กำลังบันทึก..." : "เพิ่มสินค้าสำเร็จรูป"}
        </Button>
        {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      </form>

      {quotationLoading && <p className="text-xs text-muted-foreground">กำลังค้นหาใบเสนอราคาของ JOB นี้...</p>}
      {quotationMatch && quotationMatch.items.length > 0 && (
        <div className="space-y-1 rounded-md bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground">
            ดึงข้อมูลจากใบเสนอราคา {quotationMatch.quotationDocNo} — เลือกรายการเพื่อกรอกให้อัตโนมัติ (แก้ไขจำนวน/ราคาต่อได้)
          </p>
          <div className="flex flex-wrap gap-1">
            {quotationMatch.items.map((item, i) => (
              <button
                key={i}
                type="button"
                className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
                onClick={() => applyQuotationItem(item)}
              >
                {item.productName}
                {[item.thickness, item.size, item.color].some(Boolean) &&
                  ` (${[item.thickness, item.size, item.color].filter(Boolean).join("/")})`}
                {" × "}
                {item.qty}
              </button>
            ))}
          </div>
        </div>
      )}
      {quotationMatch && quotationMatch.items.length === 0 && !quotationLoading && (
        <p className="text-xs text-muted-foreground">พบใบเสนอราคา {quotationMatch.quotationDocNo} ของ JOB นี้ แต่ไม่มีรายการสินค้า</p>
      )}
    </div>
  );
}

const receiveInitialState = { error: null as string | null };

function ReceiveDialog({
  product,
  open,
  onOpenChange,
}: {
  product: FinishedGood;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, pending] = useActionState(async (_prev: typeof receiveInitialState, formData: FormData) => {
    const result = await receiveFinishedGood(product.id, formData);
    if (!result.error) {
      setFormKey((k) => k + 1);
      onOpenChange(false);
    }
    return result;
  }, receiveInitialState);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form key={formKey} action={formAction} noValidate>
          <DialogHeader>
            <DialogTitle>รับเข้าเพิ่ม — {product.name}</DialogTitle>
            <DialogDescription>คงเหลือปัจจุบัน {product.quantityOnHand} • ต้นทุนเฉลี่ย {formatTHB(product.unitCost)}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 py-4">
            {state.error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}
            <div className="space-y-2">
              <Label htmlFor="fg_receive_qty">จำนวนที่รับเข้า</Label>
              <NumberInput id="fg_receive_qty" name="quantity" min={0} step={0.01} required placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fg_receive_cost">ราคา/หน่วย (ของรอบนี้)</Label>
              <NumberInput id="fg_receive_cost" name="unit_cost" min={0} step={0.01} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fg_receive_note">หมายเหตุ</Label>
              <Input id="fg_receive_note" name="note" placeholder="เช่น ผลิตรอบ 2" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FinishedGoodRow({
  product,
  canManage,
  canReceive,
}: {
  product: FinishedGood;
  canManage: boolean;
  canReceive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [jobNo, setJobNo] = useState(product.jobNo ?? "");
  const [name, setName] = useState(product.name);
  const [thickness, setThickness] = useState(product.thickness ?? "");
  const [size, setSize] = useState(product.size ?? "");
  const [color, setColor] = useState(product.color ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setJobNo(product.jobNo ?? "");
    setName(product.name);
    setThickness(product.thickness ?? "");
    setSize(product.size ?? "");
    setColor(product.color ?? "");
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(false);
      reset();
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("job_no", jobNo.trim());
      fd.set("name", trimmed);
      fd.set("thickness", thickness.trim());
      fd.set("size", size.trim());
      fd.set("color", color.trim());
      const result = await updateFinishedGood(product.id, fd);
      if (result.error) {
        setError(result.error);
        reset();
      }
      setEditing(false);
    });
  }

  function handleConfirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteFinishedGood(product.id);
      if (result.error) setError(result.error);
      setConfirmingDelete(false);
    });
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-medium">{product.sku}</TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={jobNo} onChange={(e) => setJobNo(e.target.value)} className="max-w-[120px]" autoFocus disabled={pending} />
        ) : (
          product.jobNo || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-[180px]" disabled={pending} />
        ) : (
          product.name
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={thickness} onChange={(e) => setThickness(e.target.value)} className="max-w-[100px]" disabled={pending} />
        ) : (
          product.thickness || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={size} onChange={(e) => setSize(e.target.value)} className="max-w-[100px]" disabled={pending} />
        ) : (
          product.size || "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {editing ? (
          <Input value={color} onChange={(e) => setColor(e.target.value)} className="max-w-[90px]" disabled={pending} />
        ) : (
          product.color || "—"
        )}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">{product.quantityOnHand}</TableCell>
      <TableCell className="text-right whitespace-nowrap">{formatTHB(product.unitCost)}</TableCell>
      <TableCell className="text-right whitespace-nowrap">{formatTHB(product.quantityOnHand * product.unitCost)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            {editing ? (
              <>
                <Button size="icon-sm" variant="outline" onClick={handleSave} disabled={pending}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    reset();
                  }}
                  disabled={pending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : confirmingDelete ? (
              <>
                <Button
                  size="icon-sm"
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={pending}
                  title={`ยืนยันลบ "${product.name}"`}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon-sm" variant="outline" onClick={() => setConfirmingDelete(false)} disabled={pending} title="ยกเลิก">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                {canReceive && (
                  <Button size="icon-sm" variant="outline" onClick={() => setReceiveOpen(true)} title="รับเข้าเพิ่ม">
                    <PackagePlus className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canManage && (
                  <>
                    <Button size="icon-sm" variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </TableCell>
      {canReceive && <ReceiveDialog product={product} open={receiveOpen} onOpenChange={setReceiveOpen} />}
    </TableRow>
  );
}

export function FinishedGoodsTable({
  products,
  canManage,
  canReceive,
  jobNoSuggestions,
}: {
  products: FinishedGood[];
  canManage: boolean;
  canReceive: boolean;
  jobNoSuggestions: string[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.sku, p.jobNo, p.name, p.thickness, p.size, p.color].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [products, search]);

  return (
    <div className="space-y-4">
      {canManage && <AddFinishedGoodForm jobNoSuggestions={jobNoSuggestions} />}

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหารหัสสินค้า, JOB, ชื่อสินค้า, ขนาด, สี..."
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รหัสสินค้า</TableHead>
              <TableHead>JOB ที่ผลิต</TableHead>
              <TableHead>ชื่อสินค้า</TableHead>
              <TableHead>ความหนา</TableHead>
              <TableHead>ขนาด</TableHead>
              <TableHead>สี</TableHead>
              <TableHead className="text-right">คงเหลือ</TableHead>
              <TableHead className="text-right">ราคา/หน่วย</TableHead>
              <TableHead className="text-right">มูลค่ารวม</TableHead>
              <TableHead>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  {products.length === 0 ? "ยังไม่มีสินค้าสำเร็จรูปในระบบ" : "ไม่พบสินค้าที่ค้นหา"}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <FinishedGoodRow key={p.id} product={p} canManage={canManage} canReceive={canReceive} />
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        แสดง {filtered.length} จาก {products.length} รายการ
      </p>
    </div>
  );
}
