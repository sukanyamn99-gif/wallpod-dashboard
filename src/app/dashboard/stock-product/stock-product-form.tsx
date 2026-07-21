"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { SizeAutocomplete } from "@/components/dashboard/size-autocomplete";
import { createStockProduct, updateStockProduct } from "./actions";
import { resizeImageToBlob } from "@/lib/image-resize";
import { formatTHB } from "@/lib/format";

const initialState = { error: null as string | null };

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
  sellingPrice: string;
  quantityOnHand: number;
  imageUrl: string | null;
}

export function StockProductForm({
  mode = "create",
  productId,
  initialData,
  sizeSuggestions,
  categories,
}: {
  mode?: "create" | "edit";
  productId?: string;
  initialData?: StockProductInitialData;
  sizeSuggestions: string[];
  categories: string[];
}) {
  const router = useRouter();
  const [size, setSize] = useState(initialData?.size ?? "");
  const [image, setImage] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [resizing, setResizing] = useState(false);

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result =
      mode === "edit" && productId
        ? await updateStockProduct(productId, formData)
        : await createStockProduct(formData);

    if (!result.error) {
      router.push("/dashboard/stock-product");
    }
    return result;
  }, initialState);

  function closeDialog() {
    router.push("/dashboard/stock-product");
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setResizing(true);
    try {
      const blob = await resizeImageToBlob(file, 800, 800, 0.85);
      if (image) URL.revokeObjectURL(image.previewUrl);
      setImage({ blob, previewUrl: URL.createObjectURL(blob) });
      setRemoveExistingImage(false);
    } finally {
      setResizing(false);
    }
  }

  function clearImage() {
    if (image) {
      URL.revokeObjectURL(image.previewUrl);
      setImage(null);
    } else if (initialData?.imageUrl) {
      setRemoveExistingImage(true);
    }
  }

  const previewUrl = image ? image.previewUrl : removeExistingImage ? null : (initialData?.imageUrl ?? null);

  return (
    <Dialog open onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="max-w-2xl">
        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (image) fd.set("image", image.blob, "product.jpg");
            if (removeExistingImage) fd.set("remove_image", "1");
            formAction(fd);
          }}
        >
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}</DialogTitle>
            <DialogDescription>
              {mode === "edit" ? "แก้ไขข้อมูลสินค้าคงคลัง" : "เพิ่มรายการสินค้าคงคลังใหม่"}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 py-4">
            {state.error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
            )}

            <Tabs defaultValue="general">
              <TabsList>
                <TabsTab value="general">ข้อมูลทั่วไป</TabsTab>
                <TabsTab value="stock">สต็อก</TabsTab>
                <TabsTab value="price">ราคา</TabsTab>
                <TabsIndicator />
              </TabsList>

              <TabsPanel value="general" className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">รหัสสินค้า (SKU)</Label>
                    <Input id="sku" name="sku" defaultValue={initialData?.sku} placeholder="เช่น GP-24" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">หมวดหมู่</Label>
                    <Select name="category" required defaultValue={initialData?.category}>
                      <SelectTrigger id="category" className="w-full">
                        <SelectValue placeholder="เลือก" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit">หน่วยนับ</Label>
                    <Input id="unit" name="unit" defaultValue={initialData?.unit ?? "ชิ้น"} placeholder="ชิ้น" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">ตำแหน่งจัดเก็บ</Label>
                    <Input id="location" name="location" defaultValue={initialData?.location} placeholder="เช่น Store 01" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="size">ขนาด</Label>
                    <SizeAutocomplete
                      id="size"
                      name="size"
                      value={size}
                      onChange={setSize}
                      suggestions={sizeSuggestions}
                      placeholder="เช่น 1200x2400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="thickness">ความหนา</Label>
                    <Input id="thickness" name="thickness" defaultValue={initialData?.thickness} placeholder="เช่น 9 มม." />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color">สี</Label>
                  <Input id="color" name="color" defaultValue={initialData?.color} placeholder="เช่น เทา" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product_note">รายละเอียด/หมายเหตุ</Label>
                  <Textarea
                    id="product_note"
                    name="product_note"
                    defaultValue={initialData?.note}
                    placeholder="รายละเอียดเพิ่มเติม"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product_image">รูปภาพสินค้า</Label>
                  {previewUrl ? (
                    <div className="relative w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local blob or private signed URL preview, not an optimizable remote asset */}
                      <img src={previewUrl} alt="รูปสินค้า" className="h-32 w-32 rounded-md border object-cover" />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute -top-2 -right-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        aria-label="ลบรูปนี้"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Input
                      id="product_image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelected}
                      disabled={resizing}
                    />
                  )}
                  {resizing && <p className="text-sm text-muted-foreground">กำลังปรับขนาดรูปภาพ...</p>}
                  <p className="text-xs text-muted-foreground">รองรับ JPG, PNG, WEBP</p>
                </div>
              </TabsPanel>

              <TabsPanel value="stock" className="space-y-4 pt-2">
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
              </TabsPanel>

              <TabsPanel value="price" className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="selling_price">ราคาขายต่อหน่วย (บาท)</Label>
                    <Input
                      id="selling_price"
                      name="selling_price"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={initialData?.sellingPrice}
                      placeholder="ยังไม่ระบุ"
                    />
                  </div>
                </div>

                {initialData?.unitCost && initialData?.quantityOnHand ? (
                  <p className="text-sm text-muted-foreground">
                    มูลค่าคงเหลือโดยประมาณ: {formatTHB(initialData.quantityOnHand * Number(initialData.unitCost))}
                  </p>
                ) : null}
              </TabsPanel>
            </Tabs>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending || resizing}>
              {pending ? "กำลังบันทึก..." : mode === "edit" ? "บันทึกการแก้ไข" : "สร้างสินค้า"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
