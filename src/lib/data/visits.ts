import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mockVisits } from "@/lib/mock-data";
import type { Visit } from "@/lib/types";

export async function getTodayVisits(): Promise<Visit[]> {
  const today = new Date().toISOString().slice(0, 10);

  if (!isSupabaseConfigured()) {
    return mockVisits.filter((v) => v.visit_date === today);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select(
      "id, sales_rep_id, customer_id, project_id, visit_date, note, sales_reps(name), customers(name)",
    )
    .eq("visit_date", today)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    sales_rep_id: row.sales_rep_id,
    // @ts-expect-error -- Supabase types the joined relation loosely here
    sales_rep_name: row.sales_reps?.name ?? "",
    customer_id: row.customer_id,
    // @ts-expect-error -- Supabase types the joined relation loosely here
    customer_name: row.customers?.name ?? null,
    project_id: row.project_id,
    visit_date: row.visit_date,
    note: row.note,
  }));
}
