"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { recordStockMovement } from "../stock-product/actions";
import type { StockProduct } from "@/lib/types";

const initialState = { error: null as string | null };

export function RecordMovementDialog({
  open,
  onOpenChange,
  stockProducts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockProducts: StockProduct[];
}) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<StockProduct | null>(null);
  const [formKey, setFormKey] = useState(0);

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    if (!selected) return { error: "กรุณาเลือกสินค้า" };
    const result = await recordStockMovement(selected.id, formData);
    if (!result.error) {
      setSelected(null);
      setQuery("");
      setFormKey((k) => k + 1);
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form key={formKey} action={formAction}>
          <DialogHeader>
            <DialogTitle>บันทึกความเคลื่อนไหว</DialogTitle>
            <DialogDescription>รับเข้าหรือเบิกออกสินค้าคงคลัง</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 py-4">
            {state.error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="movement_product_search">สินค้า</Label>
              {selected ? (
                <div className="flex items-center justify-between rounded-lg border p-2">
                  <div>
                    <p className="text-sm font-medium">{selected.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selected.sku ?? "—"} — คงเหลือ {selected.quantityOnHand} {selected.unit}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelected(null)}>
                    เปลี่ยน
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="movement_product_search"
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
                              setSelected(p);
                              setQuery("");
                              setSearchOpen(false);
                            }}
                          >
                            {p.sku ?? "—"} — {p.name} (คงเหลือ {p.quantityOnHand} {p.unit})
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="movement_type">ประเภท</Label>
              <Select name="movement_type" required defaultValue="in">
                <SelectTrigger id="movement_type" className="w-full">
                  <SelectValue placeholder="เลือก" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">รับเข้า</SelectItem>
                  <SelectItem value="out">เบิกออก</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">จำนวน{selected ? ` (${selected.unit})` : ""}</Label>
              <Input id="quantity" name="quantity" type="number" min="0" step="1" required placeholder="0" />
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
      </DialogContent>
    </Dialog>
  );
}
