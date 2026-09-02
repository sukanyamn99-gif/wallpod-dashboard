"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerAutocomplete } from "@/components/dashboard/customer-autocomplete";
import { PaymentTermLabelAutocomplete } from "@/components/dashboard/payment-term-label-autocomplete";
import { formatTHB } from "@/lib/format";
import { resizeImageToBlob } from "@/lib/image-resize";
import { createQuotation, updateQuotation } from "./actions";
import type { Customer, QuotationDetail, SalesRep } from "@/lib/types";

const NONE_VALUE = "__none__";

type ItemImage = { kind: "existing"; path: string; previewUrl: string } | { kind: "new"; blob: Blob; previewUrl: string };

interface ItemRow {
  key: number;
  productCode: string;
  description: string;
  unitPrice: string;
  discountPercent: string;
  qty: string;
  unit: string;
  image: ItemImage | null;
}

interface PaymentTermRow {
  key: number;
  label: string;
  percent: string;
}

let nextKey = 1;

function itemsFromInitial(initialData?: QuotationDetail): ItemRow[] {
  if (!initialData || initialData.items.length === 0) {
    return [
      {
        key: nextKey++,
        productCode: "",
        description: "",
        unitPrice: "",
        discountPercent: "0",
        qty: "1",
        unit: "Pcs.",
        image: null,
      },
    ];
  }
  return initialData.items.map((it) => ({
    key: nextKey++,
    productCode: it.productCode ?? "",
    description: it.description,
    unitPrice: String(it.unitPrice),
    discountPercent: String(it.discountPercent),
    qty: String(it.qty),
    unit: it.unit,
    image: it.imagePath ? { kind: "existing", path: it.imagePath, previewUrl: "" } : null,
  }));
}

function termsFromInitial(initialData?: QuotationDetail): PaymentTermRow[] {
  if (!initialData || initialData.paymentTerms.length === 0) return [];
  return initialData.paymentTerms.map((t) => ({ key: nextKey++, label: t.label, percent: String(t.percent) }));
}

export function QuotationForm({
  salesReps,
  customers,
  mode = "create",
  quotationId,
  initialData,
  imageUrlsByItemId,
}: {
  salesReps: SalesRep[];
  customers: Customer[];
  mode?: "create" | "edit";
  quotationId?: string;
  initialData?: QuotationDetail;
  imageUrlsByItemId?: Record<string, string>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [quoteDate, setQuoteDate] = useState(initialData?.quoteDate ?? new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(initialData?.deliveryDate ?? "");
  const [projectName, setProjectName] = useState(initialData?.projectName ?? "");
  const [attn, setAttn] = useState(initialData?.attn ?? "");
  const [customerName, setCustomerName] = useState(initialData?.customerName ?? "");
  const [customerAddress, setCustomerAddress] = useState(initialData?.customerAddress ?? "");
  const [customerTel, setCustomerTel] = useState(initialData?.customerTel ?? "");
  const [customerTaxId, setCustomerTaxId] = useState(initialData?.customerTaxId ?? "");
  const [jobNumber, setJobNumber] = useState(initialData?.jobNumber ?? "");
  const [poNumber, setPoNumber] = useState(initialData?.poNumber ?? "");
  const [priceValidity, setPriceValidity] = useState(initialData?.priceValidity ?? "");
  const [remark, setRemark] = useState(initialData?.remark ?? "");
  const [salesRepId, setSalesRepId] = useState(initialData?.salesRepId ?? "");

  const [items, setItems] = useState<ItemRow[]>(() => itemsFromInitial(initialData));
  const [terms, setTerms] = useState<PaymentTermRow[]>(() => termsFromInitial(initialData));

  const salesRepItems = [
    { value: NONE_VALUE, label: "— ไม่ระบุ —" },
    ...salesReps.map((r) => ({ value: r.id, label: r.name })),
  ];

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: nextKey++, productCode: "", description: "", unitPrice: "", discountPercent: "0", qty: "1", unit: "Pcs.", image: null },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => {
      const target = prev.find((it) => it.key === key);
      if (target?.image?.kind === "new") URL.revokeObjectURL(target.image.previewUrl);
      return prev.filter((it) => it.key !== key);
    });
  }

  function updateItem(key: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  async function handleImageSelect(key: number, file: File) {
    // Item photos only ever render as small thumbnails (64-80px on screen,
    // ~64px on the printed quote), so 800x800 was needlessly large for what
    // gets stored — 400x400 at a lower quality cuts file size noticeably
    // while still looking sharp at the sizes this actually displays.
    const blob = await resizeImageToBlob(file, 400, 400, 0.7);
    const item = items.find((it) => it.key === key);
    if (item?.image) URL.revokeObjectURL(item.image.previewUrl);
    updateItem(key, { image: { kind: "new", blob, previewUrl: URL.createObjectURL(blob) } });
  }

  function removeItemImage(key: number) {
    const item = items.find((it) => it.key === key);
    if (item?.image?.kind === "new") URL.revokeObjectURL(item.image.previewUrl);
    updateItem(key, { image: null });
  }

  function addTerm() {
    setTerms((prev) => [...prev, { key: nextKey++, label: "", percent: "" }]);
  }
  function removeTerm(key: number) {
    setTerms((prev) => prev.filter((t) => t.key !== key));
  }
  function updateTerm(key: number, patch: Partial<PaymentTermRow>) {
    setTerms((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  const computedItems = useMemo(
    () =>
      items.map((it) => {
        const unitPrice = Number(it.unitPrice) || 0;
        const discountPercent = Number(it.discountPercent) || 0;
        const qty = Number(it.qty) || 0;
        const netPrice = Math.round(unitPrice * (1 - discountPercent / 100) * 100) / 100;
        const totalPrice = Math.round(netPrice * qty * 100) / 100;
        return { ...it, netPrice, totalPrice };
      }),
    [items],
  );

  const preVat = computedItems.reduce((sum, it) => sum + it.totalPrice, 0);
  const vat = Math.round(preVat * 0.07 * 100) / 100;
  const grandTotal = Math.round((preVat + vat) * 100) / 100;

  const initialState = { error: null as string | null };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required positionally by useActionState's action signature; values come from React state instead, not the native FormData
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, _formData: FormData) => {
    if (!projectName.trim()) return { error: "กรุณากรอกชื่อโครงการ" };
    if (!customerName.trim()) return { error: "กรุณากรอกชื่อลูกค้า" };
    if (computedItems.every((it) => !it.description.trim())) {
      return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };
    }

    const fd = new FormData();
    fd.set("quote_date", quoteDate);
    fd.set("project_name", projectName);
    fd.set("attn", attn);
    fd.set("customer_name", customerName);
    fd.set("customer_address", customerAddress);
    fd.set("customer_tel", customerTel);
    fd.set("customer_tax_id", customerTaxId);
    fd.set("job_number", jobNumber);
    fd.set("po_number", poNumber);
    fd.set("delivery_date", deliveryDate);
    fd.set("price_validity", priceValidity);
    fd.set("remark", remark);
    fd.set("sales_rep_id", salesRepId === NONE_VALUE ? "" : salesRepId);

    for (const it of computedItems) {
      if (!it.description.trim()) continue;
      fd.append("item_product_code", it.productCode);
      fd.append("item_description", it.description);
      fd.append("item_unit_price", it.unitPrice || "0");
      fd.append("item_discount_percent", it.discountPercent || "0");
      fd.append("item_qty", it.qty || "1");
      fd.append("item_unit", it.unit || "Pcs.");
      if (it.image?.kind === "new") {
        fd.append("item_image", it.image.blob, "item.jpg");
        fd.append("item_existing_image_path", "");
        fd.append("item_remove_image", "false");
      } else if (it.image?.kind === "existing") {
        fd.append("item_image", new Blob());
        fd.append("item_existing_image_path", it.image.path);
        fd.append("item_remove_image", "false");
      } else {
        fd.append("item_image", new Blob());
        fd.append("item_existing_image_path", "");
        fd.append("item_remove_image", "true");
      }
    }

    for (const t of terms) {
      if (!t.label.trim() || !(Number(t.percent) > 0)) continue;
      fd.append("term_label", t.label);
      fd.append("term_percent", t.percent);
    }

    const result = mode === "edit" && quotationId ? await updateQuotation(quotationId, fd) : await createQuotation(fd);
    if (!result.error) {
      router.push(mode === "edit" && quotationId ? `/dashboard/quotations/view/${quotationId}` : "/dashboard/quotations");
    }
    return result;
  }, initialState);

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="space-y-6"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>วันที่</Label>
          <DateInput value={quoteDate} onChange={setQuoteDate} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>ชื่อโครงการ *</Label>
          <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label>Attn / ผู้ติดต่อ</Label>
          <Input value={attn} onChange={(e) => setAttn(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>ชื่อลูกค้า/บริษัท *</Label>
          <CustomerAutocomplete name="_customer_name_display" value={customerName} onChange={setCustomerName} customers={customers} required />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>ที่อยู่ลูกค้า</Label>
          <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>เบอร์โทร</Label>
          <Input value={customerTel} onChange={(e) => setCustomerTel(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>เลขที่ผู้เสียภาษี</Label>
          <Input value={customerTaxId} onChange={(e) => setCustomerTaxId(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>JOB Number</Label>
          <Input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>PO. Number</Label>
          <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>วันที่ส่งของ</Label>
          <DateInput value={deliveryDate || null} onChange={setDeliveryDate} />
        </div>
        <div className="space-y-2">
          <Label>พนักงานขาย</Label>
          <Select value={salesRepId || NONE_VALUE} onValueChange={(v) => setSalesRepId((v as string) ?? NONE_VALUE)} items={salesRepItems}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {salesRepItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>กำหนดยืนราคา</Label>
          <Input value={priceValidity} onChange={(e) => setPriceValidity(e.target.value)} placeholder="เช่น 30 วัน" />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label className="text-base">รายการสินค้า</Label>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-4 w-4" /> เพิ่มรายการ
          </Button>
        </div>

        {computedItems.map((it) => (
          <div key={it.key} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[100px_1fr] lg:grid-cols-[100px_1.5fr_repeat(4,110px)_36px]">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">รูปภาพ</Label>
              {it.image ? (
                <div className="relative h-20 w-20">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob or private signed URL preview, not an optimizable remote asset */}
                  <img src={it.image.kind === "existing" ? imageUrlsByItemId?.[it.image.path] ?? "" : it.image.previewUrl} alt="" className="h-20 w-20 rounded border object-cover" />
                  <button type="button" onClick={() => removeItemImage(it.key)} className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label
                  tabIndex={0}
                  title="คลิกเพื่อเลือกไฟล์ หรือคลิกแล้ววางรูป (Ctrl+V) เช่น รูปที่แคปหน้าจอมา"
                  className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  onPaste={(e) => {
                    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
                    const file = item?.getAsFile();
                    if (file) {
                      e.preventDefault();
                      handleImageSelect(it.key, file);
                    }
                  }}
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[10px]">เพิ่มรูป</span>
                  <span className="text-[9px] leading-none">หรือวาง (Ctrl+V)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageSelect(it.key, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <div className="space-y-2 sm:col-span-1 lg:col-span-1">
              <Input placeholder="รหัสสินค้า" value={it.productCode} onChange={(e) => updateItem(it.key, { productCode: e.target.value })} />
              <Textarea
                placeholder="รายละเอียด เช่น ชื่อสินค้า / ความหนา / ขนาด / สี"
                value={it.description}
                onChange={(e) => updateItem(it.key, { description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ราคาต่อหน่วย</Label>
              <NumberInput value={it.unitPrice} onChange={(v) => updateItem(it.key, { unitPrice: v })} min={0} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ส่วนลด %</Label>
              <NumberInput value={it.discountPercent} onChange={(v) => updateItem(it.key, { discountPercent: v })} min={0} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">จำนวน</Label>
              <NumberInput value={it.qty} onChange={(v) => updateItem(it.key, { qty: v })} min={0} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">หน่วย</Label>
              <Input value={it.unit} onChange={(e) => updateItem(it.key, { unit: e.target.value })} />
            </div>

            <div className="flex items-end justify-end lg:col-span-1">
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeItem(it.key)} disabled={items.length === 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-7">
              ราคาหลังส่วนลด {formatTHB(it.netPrice)} × {it.qty || 0} = <span className="font-medium text-foreground">{formatTHB(it.totalPrice)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label className="text-base">เงื่อนไขการชำระเงิน</Label>
          <Button type="button" size="sm" variant="outline" onClick={addTerm}>
            <Plus className="h-4 w-4" /> เพิ่มงวด
          </Button>
        </div>
        {terms.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีงวดการชำระเงิน</p>}
        {terms.map((t) => {
          const amount = Math.round(((grandTotal * (Number(t.percent) || 0)) / 100) * 100) / 100;
          return (
            <div key={t.key} className="flex flex-wrap items-center gap-2">
              <PaymentTermLabelAutocomplete
                placeholder="เช่น Deposit / มัดจำก่อนผลิต"
                value={t.label}
                onChange={(label) => updateTerm(t.key, { label })}
              />
              <div className="flex items-center gap-1">
                <NumberInput value={t.percent} onChange={(v) => updateTerm(t.key, { percent: v })} min={0} className="w-20" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <span className="w-32 text-right text-sm font-medium">{formatTHB(amount)}</span>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeTerm(t.key)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>หมายเหตุ</Label>
          <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} />
        </div>
        <div className="space-y-1 rounded-lg border p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">รวมเป็นเงิน</span>
            <span>{formatTHB(preVat)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ภาษีมูลค่าเพิ่ม 7%</span>
            <span>{formatTHB(vat)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <span>รวมทั้งสิ้น</span>
            <span>{formatTHB(grandTotal)}</span>
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {mode === "edit" ? "บันทึกการแก้ไข" : "บันทึกใบเสนอราคา"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
