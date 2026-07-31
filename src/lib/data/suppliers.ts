import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Supplier } from "@/lib/types";

export async function getSuppliers(): Promise<Supplier[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, address, tax_id, branch, created_at")
    .order("name");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    taxId: row.tax_id,
    branch: row.branch,
    createdAt: row.created_at,
  }));
}
