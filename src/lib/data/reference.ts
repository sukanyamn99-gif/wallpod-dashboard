import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mockCustomers, mockSalesReps } from "@/lib/mock-data";
import type { Customer, Department, SalesRep } from "@/lib/types";

export async function getSalesReps(): Promise<SalesRep[]> {
  if (!isSupabaseConfigured()) return mockSalesReps;
  const supabase = await createClient();
  const { data, error } = await supabase.from("sales_reps").select("id, name, active").eq("active", true);
  if (error) throw error;
  return data ?? [];
}

export async function getCustomers(): Promise<Customer[]> {
  if (!isSupabaseConfigured()) return mockCustomers;
  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").select("id, name, customer_type");
  if (error) throw error;
  return data ?? [];
}

export async function getProductCategories(): Promise<
  { id: string; name: string; description: string | null; created_at: string }[]
> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, description, created_at")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getDepartments(): Promise<Department[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").select("id, name, created_at").order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at }));
}

export async function getDistinctProjectJobNos(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("job_no").not("job_no", "is", null);
  if (error) throw error;
  const jobNos = new Set((data ?? []).map((row) => row.job_no as string).filter((j) => j.trim().length > 0));
  return Array.from(jobNos).sort();
}
