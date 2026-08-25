"use client";

import { useMemo, useState } from "react";
import { FilterX, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StockProduct } from "@/lib/types";

export function StockCatalogReport({
  products,
  imageUrls,
  categories,
}: {
  products: StockProduct[];
  imageUrls: Record<string, string>;
  categories: string[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const categoryOptions = [{ value: "all", label: "ทุกหมวดหมู่" }, ...categories.map((c) => ({ value: c, label: c }))];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.color ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, category]);

  function clearFilters() {
    setSearch("");
    setCategory("all");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="ค้นหาชื่อสินค้า, รหัส, สี..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[220px]"
        />
        <Select value={category} onValueChange={(v) => setCategory((v as string) ?? "all")} items={categoryOptions}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="ทุกหมวดหมู่" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={clearFilters}>
          <FilterX className="h-4 w-4" />
          เคลียร์ตัวกรอง
        </Button>
        <p className="ml-auto text-sm text-muted-foreground">
          แสดง {filtered.length} จาก {products.length} รายการ
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border py-12 text-center text-sm text-muted-foreground">ไม่พบสินค้า</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
          {filtered.map((p) => {
            const imageUrl = p.imagePath ? imageUrls[p.imagePath] : null;
            const lowStock = p.quantityOnHand <= p.reorderPoint;
            return (
              <div key={p.id} className="rounded-lg border bg-white p-2 shadow-sm">
                <div className="relative aspect-square overflow-hidden rounded-md bg-neutral-100">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URLs, not a static/local asset next/image can optimize
                    <img src={imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-neutral-400">
                      <ImageOff className="h-5 w-5" />
                      <span className="text-[10px]">ไม่มีรูป</span>
                    </div>
                  )}
                  <span
                    className={`absolute right-1 top-1 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold shadow-sm ${
                      lowStock ? "border-destructive/40 bg-destructive/90 text-white" : "border-neutral-300 bg-white text-neutral-900"
                    }`}
                    title="จำนวนคงเหลือ"
                  >
                    {p.quantityOnHand}
                  </span>
                </div>
                <div className="mt-1.5 text-center">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-800" title={p.name}>
                    {p.name}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
