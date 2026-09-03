import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mockCustomers, mockSalesReps } from "@/lib/mock-data";
import type { Customer, Department, SalesRep } from "@/lib/types";

export async function getSalesReps({ requireLogin = false }: { requireLogin?: boolean } = {}): Promise<SalesRep[]> {
  if (!isSupabaseConfigured()) return mockSalesReps;
  const supabase = await createClient();
  let query = supabase.from("sales_reps").select("id, name, active").eq("active", true);
  // Sale Report is filled in by the rep themselves, so the picker should only
  // offer reps who actually have a login account (sales_reps.profile_id set) —
  // excludes team/customer-name entries that were never real accounts.
  if (requireLogin) query = query.not("profile_id", "is", null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getCustomers(): Promise<Customer[]> {
  if (!isSupabaseConfigured()) return mockCustomers;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, customer_type, contact_person, address, phone, tax_id, customer_code");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    customer_type: row.customer_type,
    contactPerson: row.contact_person,
    address: row.address,
    phone: row.phone,
    taxId: row.tax_id,
    customerCode: row.customer_code,
  }));
}

// Looks up a customer's current master-data record by exact (case-
// insensitive) name match — same matching rule already used by the
// quotation form's best-effort sync-back. Used to show live customer
// contact info on read-only views instead of a possibly-stale per-document
// snapshot (e.g. a quotation's own customer_address/customer_tel columns).
export async function getCustomerByName(name: string): Promise<Customer | null> {
  if (!name || !isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, customer_type, contact_person, address, phone, tax_id, customer_code")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    customer_type: data.customer_type,
    contactPerson: data.contact_person,
    address: data.address,
    phone: data.phone,
    taxId: data.tax_id,
    customerCode: data.customer_code,
  };
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

export interface JobLookupEntry {
  projectName: string;
  customerId: string | null;
  customerName: string;
  salesRepId: string | null;
}

// Lightweight job_no -> project name/customer/sales-rep lookup for
// auto-filling forms (e.g. Stock Requisition, Billing Documents) once a
// JOB NO. is picked — deliberately a plain select rather than reusing
// getFullProjectReport(), which also joins costs/payments/items this
// lookup has no use for.
export async function getJobNoLookup(): Promise<Record<string, JobLookupEntry>> {
  if (!isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("job_no, project_name, customer_id, sales_rep_id, customers(name)")
    .not("job_no", "is", null);
  if (error) throw error;
  const lookup: Record<string, JobLookupEntry> = {};
  for (const row of data ?? []) {
    const jobNo = row.job_no as string | null;
    if (!jobNo || !jobNo.trim()) continue;
    const customer = row.customers as { name: string } | { name: string }[] | null;
    const customerName = Array.isArray(customer) ? (customer[0]?.name ?? "") : (customer?.name ?? "");
    lookup[jobNo] = {
      projectName: row.project_name ?? "",
      customerId: row.customer_id ?? null,
      customerName,
      salesRepId: row.sales_rep_id ?? null,
    };
  }
  return lookup;
}
