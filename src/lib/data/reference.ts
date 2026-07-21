import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mockCustomers, mockSalesReps } from "@/lib/mock-data";
import type { Customer, SalesRep } from "@/lib/types";

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

export async function getProductCategories(): Promise<{ id: string; name: string; created_at: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_categories").select("id, name, created_at").order("name");
  if (error) throw error;
  return data ?? [];
}
