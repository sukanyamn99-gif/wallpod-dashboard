import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { FinishedGood, FinishedGoodMovement } from "@/lib/types";

const FINISHED_GOOD_COLUMNS =
  "id, sku, job_no, name, thickness, size, color, quantity_on_hand, unit_cost, created_at, updated_at";

function mapRow(row: {
  id: string;
  sku: string;
  job_no: string | null;
  name: string;
  thickness: string | null;
  size: string | null;
  color: string | null;
  quantity_on_hand: string | number;
  unit_cost: string | number;
  created_at: string;
  updated_at: string;
}): FinishedGood {
  return {
    id: row.id,
    sku: row.sku,
    jobNo: row.job_no,
    name: row.name,
    thickness: row.thickness,
    size: row.size,
    color: row.color,
    quantityOnHand: Number(row.quantity_on_hand),
    unitCost: Number(row.unit_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getFinishedGoods(): Promise<FinishedGood[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finished_goods")
    .select(FINISHED_GOOD_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getFinishedGoodById(id: string): Promise<FinishedGood | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("finished_goods").select(FINISHED_GOOD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function getFinishedGoodMovements(id: string): Promise<FinishedGoodMovement[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finished_goods_movements")
    .select("id, finished_good_id, movement_type, quantity, balance_before, balance_after, reference_no, note, created_at")
    .eq("finished_good_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    finishedGoodId: row.finished_good_id,
    movementType: row.movement_type as "in" | "out",
    quantity: Number(row.quantity),
    balanceBefore: row.balance_before === null ? null : Number(row.balance_before),
    balanceAfter: row.balance_after === null ? null : Number(row.balance_after),
    referenceNo: row.reference_no,
    note: row.note,
    createdAt: row.created_at,
  }));
}
