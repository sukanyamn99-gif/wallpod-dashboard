"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { recordStockMovement } from "../../stock-product/actions";
import type { StockProduct } from "@/lib/types";

const initialState = { error: null as string | null };

export function RecordInDialog({
  product,
  onOpenChange,
}: {
  product: StockProduct | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [formKey, setFormKey] = useState(0);

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    if (!product) return initialState;
    formData.set("movement_type", "in");
    const result = await recordStockMovement(product.id, formData);
    if (!result.error) {
      setFormKey((k) => k + 1);
      onOpenChange(false);
    }
    return result;
  }, initialState);

  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {product && (
          <form key={formKey} action={formAction}>
            <DialogHeader>
              <DialogTitle>รับเข้าสินค้า</DialogTitle>
              <DialogDescription>
                {product.name} — คงเหลือ {product.quantityOnHand} {product.unit}
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4 py-4">
              {state.error && (
                <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="quantity">จำนวนที่รับเข้า ({product.unit})</Label>
                <Input id="quantity" name="quantity" type="number" min="0" step="1" required placeholder="0" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">หมายเหตุ</Label>
                <Input id="note" name="note" placeholder="เช่น รับของจากซัพพลายเออร์" />
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
        )}
      </DialogContent>
    </Dialog>
  );
}
