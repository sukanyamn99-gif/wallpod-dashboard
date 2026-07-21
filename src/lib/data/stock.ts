import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ProductCategory, StockDashboardData, StockProduct } from "@/lib/types";

const STOCK_PRODUCT_COLUMNS =
  "id, sku, name, category, color, size, thickness, location, note, unit, quantity_on_hand, reorder_point, unit_cost, created_at, updated_at";

function mapRow(row: {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  color: string | null;
  size: string | null;
  thickness: string | null;
  location: string | null;
  note: string | null;
  unit: string;
  quantity_on_hand: string | number;
  reorder_point: string | number;
  unit_cost: string | number;
  created_at: string;
  updated_at: string;
}): StockProduct {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category as ProductCategory | null,
    color: row.color,
    size: row.size,
    thickness: row.thickness,
    location: row.location,
    note: row.note,
    unit: row.unit,
    quantityOnHand: Number(row.quantity_on_hand),
    reorderPoint: Number(row.reorder_point),
    unitCost: Number(row.unit_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getStockProducts(): Promise<StockProduct[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_products")
    .select(STOCK_PRODUCT_COLUMNS)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getStockProductById(id: string): Promise<StockProduct | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_products")
    .select(STOCK_PRODUCT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function getStockDashboardData(): Promise<StockDashboardData> {
  const products = await getStockProducts();

  const lowStockItems = products
    .filter((p) => p.quantityOnHand <= p.reorderPoint)
    .sort((a, b) => a.quantityOnHand - a.reorderPoint - (b.quantityOnHand - b.reorderPoint));

  const byCategory = new Map<string, { value: number; count: number }>();
  for (const p of products) {
    const key = p.category ?? "OTHER";
    const entry = byCategory.get(key) ?? { value: 0, count: 0 };
    entry.value += p.quantityOnHand * p.unitCost;
    entry.count += 1;
    byCategory.set(key, entry);
  }

  return {
    skuCount: products.length,
    totalStockValue: products.reduce((sum, p) => sum + p.quantityOnHand * p.unitCost, 0),
    lowStockCount: lowStockItems.length,
    categoryBreakdown: Array.from(byCategory.entries()).map(([category, { value, count }]) => ({
      category,
      value,
      count,
    })),
    lowStockItems,
  };
}
