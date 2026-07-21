"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createStockProduct, updateStockProduct } from "./actions";
import { formatTHB } from "@/lib/format";
import type { ProductCategory } from "@/lib/types";

const initialState = { error: null as string | null };

const PRODUCT_CATEGORIES: ProductCategory[] = [
  "WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER",
];

export interface StockProductInitialData {
  sku: string;
  name: string;
  category: string;
  color: string;
  size: string;
  thickness: string;
  location: string;
  note: string;
  unit: string;
  reorderPoint: string;
  unitCost: string;
  quantityOnHand: number;
}

export function StockProductForm({
  mode = "create",
  productId,
  initialData,
}: {
  mode?: "create" | "edit";
  productId?: string;
  initialData?: StockProductInitialData;
}) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && productId
        ? await updateStockProduct(productId, formData)
        : await createStockProduct(formData);

    if (!result.error) {
      if (mode === "edit") {
        router.push("/dashboard/stock-product");
      } else {
        setFormKey((k) => k + 1);
      }
    }
    return result;
  }, initialState);

  return (
    <form key={formKey} action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku">รหัสสินค้า (SKU)</Label>
          <Input id="sku" name="sku" defaultValue={initialData?.sku} placeholder="เช่น GP-24" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">ชื่อสินค้า</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={initialData?.name}
            placeholder="เช่น แผ่นซับเสียง WALLPOD 9mm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">หมวดหมู่</Label>
          <Select name="category" required defaultValue={initialData?.category}>
            <SelectTrigger id="category" className="w-full">
              <SelectValue placeholder="เลือก" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">หน่วยนับ</Label>
          <Input id="unit" name="unit" defaultValue={initialData?.unit ?? "ชิ้น"} placeholder="ชิ้น" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">สี</Label>
          <Input id="color" name="color" defaultValue={initialData?.color} placeholder="เช่น เทา" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">ขนาด</Label>
          <Input id="size" name="size" defaultValue={initialData?.size} placeholder="เช่น 1200x2400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="thickness">ความหนา</Label>
          <Input id="thickness" name="thickness" defaultValue={initialData?.thickness} placeholder="เช่น 9 มม." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">ตำแหน่งจัดเก็บ</Label>
          <Input id="location" name="location" defaultValue={initialData?.location} placeholder="เช่น Store 01" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="product_note">หมายเหตุ</Label>
        <Textarea id="product_note" name="product_note" defaultValue={initialData?.note} placeholder="รายละเอียดเพิ่มเติม" />
      </div>

      {mode === "create" ? (
        <div className="space-y-2">
          <Label htmlFor="initial_quantity">จำนวนเริ่มต้น</Label>
          <Input id="initial_quantity" name="initial_quantity" type="number" min="0" step="1" placeholder="0" />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>คงเหลือปัจจุบัน</Label>
          <p className="text-sm text-muted-foreground">
            {initialData?.quantityOnHand ?? 0} {initialData?.unit} — แก้ไขผ่านปุ่ม &quot;รับเข้า/เบิกออก&quot; เท่านั้น
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="reorder_point">จุดสั่งซื้อขั้นต่ำ</Label>
          <Input
            id="reorder_point"
            name="reorder_point"
            type="number"
            min="0"
            step="1"
            defaultValue={initialData?.reorderPoint}
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit_cost">ราคาต้นทุนต่อหน่วย (บาท)</Label>
          <Input
            id="unit_cost"
            name="unit_cost"
            type="number"
            min="0"
            step="0.01"
            defaultValue={initialData?.unitCost}
            placeholder="0"
          />
        </div>
      </div>

      {initialData?.unitCost && initialData?.quantityOnHand ? (
        <p className="text-sm text-muted-foreground">
          มูลค่าคงเหลือโดยประมาณ: {formatTHB(initialData.quantityOnHand * Number(initialData.unitCost))}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "กำลังบันทึก..." : mode === "edit" ? "บันทึกการแก้ไข" : "บันทึกสินค้า"}
      </Button>
    </form>
  );
}
