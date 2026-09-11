import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mockCustomers, mockSalesReps } from "@/lib/mock-data";
import type { Customer, CustomerWithQuotationStatus, Department, SalesRep } from "@/lib/types";

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

// Customers page's own listing — same rows as getCustomers, plus whether
// each customer has at least one ใบเสนอราคา with status ลูกค้าตอบตกลง, for
// its accepted/not-accepted filter. Matched by name (case-insensitive,
// trimmed) since quotations has no customer_id FK — same matching rule
// syncCustomerContactInfo already uses to sync a quotation's customer back
// onto this table.
export async function getCustomersWithQuotationStatus(): Promise<CustomerWithQuotationStatus[]> {
  if (!isSupabaseConfigured()) return mockCustomers.map((c) => ({ ...c, hasAcceptedQuotation: false }));
  const supabase = await createClient();
  const [{ data: customerRows, error: customerErr }, { data: quotationRows, error: quotationErr }] = await Promise.all([
    supabase.from("customers").select("id, name, customer_type, contact_person, address, phone, tax_id, customer_code"),
    supabase.from("quotations").select("customer_name, status"),
  ]);
  if (customerErr) throw customerErr;
  if (quotationErr) throw quotationErr;

  const acceptedNames = new Set(
    (quotationRows ?? [])
      .filter((q) => q.status === "ลูกค้าตอบตกลง")
      .map((q) => q.customer_name.trim().toLowerCase()),
  );

  return (customerRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    customer_type: row.customer_type,
    contactPerson: row.contact_person,
    address: row.address,
    phone: row.phone,
    taxId: row.tax_id,
    customerCode: row.customer_code,
    hasAcceptedQuotation: acceptedNames.has(row.name.trim().toLowerCase()),
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

// Also reads quotations.job_number, not just projects.job_no — a JOB NO. is
// assigned as soon as a quotation is put into production (ใบลงผลิต), which
// happens well before that job is ever recorded as a WALLPOD Project Sales
// row. Every other form that offers a JOB NO. picker (Stock Requisition,
// billing documents, Payment Voucher, Purchase Request, ...) needs to see a
// freshly-assigned job immediately, not only once it reaches projects —
// matches the same two-source union getNextJobNo() already uses.
export async function getDistinctProjectJobNos(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const [{ data: projects, error: pErr }, { data: quotes, error: qErr }] = await Promise.all([
    supabase.from("projects").select("job_no").not("job_no", "is", null),
    supabase.from("quotations").select("job_number").not("job_number", "is", null),
  ]);
  if (pErr) throw pErr;
  if (qErr) throw qErr;
  const jobNos = new Set(
    [
      ...(projects ?? []).map((row) => row.job_no as string),
      ...(quotes ?? []).map((row) => row.job_number as string),
    ].filter((j) => j.trim().length > 0),
  );
  return Array.from(jobNos).sort();
}

// Real job numbers (JB + 2-digit year + 2-digit month + 3-digit sequence,
// see src/lib/job-no.ts) keep incrementing the same 3-digit sequence across
// month boundaries rather than resetting each month (confirmed against live
// data: .../JB2608186 was immediately followed by .../JB2609187, not a reset
// to 001) — so "next" means the highest existing sequence digit group + 1,
// read from both projects.job_no and quotations.job_number since either can
// hold the most recently assigned one. Shared by WALLPOD Project Sales'
// create form and quotation acceptance (updateQuotationStatus), the two
// places that assign a brand-new JOB NO. automatically.
export async function getNextJobNo(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  if (!isSupabaseConfigured()) return `JB${yy}${mm}`;

  const supabase = await createClient();
  const [{ data: projects, error: pErr }, { data: quotes, error: qErr }] = await Promise.all([
    supabase.from("projects").select("job_no").not("job_no", "is", null),
    supabase.from("quotations").select("job_number").not("job_number", "is", null),
  ]);
  if (pErr) throw pErr;
  if (qErr) throw qErr;

  let max = 0;
  const values = [...(projects ?? []).map((r) => r.job_no), ...(quotes ?? []).map((r) => r.job_number)];
  for (const value of values) {
    const match = /^JB\d{4}(\d{3})$/.exec(value ?? "");
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  const seq = String(max + 1).padStart(3, "0");
  return `JB${yy}${mm}${seq}`;
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
//
// A quotation-sourced fallback fills in a JOB NO. that's been assigned via
// ใบลงผลิต but not yet recorded as a projects row (see
// getDistinctProjectJobNos) — projects data wins when both exist, since
// it's the accounting-grade record; quotations has no customer_id FK, so
// that fallback entry's customerId is always null.
export async function getJobNoLookup(): Promise<Record<string, JobLookupEntry>> {
  if (!isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const [{ data: projects, error: pErr }, { data: quotes, error: qErr }] = await Promise.all([
    supabase
      .from("projects")
      .select("job_no, project_name, customer_id, sales_rep_id, customers(name)")
      .not("job_no", "is", null),
    supabase
      .from("quotations")
      .select("job_number, project_name, customer_name, sales_rep_id")
      .not("job_number", "is", null),
  ]);
  if (pErr) throw pErr;
  if (qErr) throw qErr;

  const lookup: Record<string, JobLookupEntry> = {};
  for (const row of quotes ?? []) {
    const jobNo = row.job_number as string | null;
    if (!jobNo || !jobNo.trim()) continue;
    lookup[jobNo] = {
      projectName: row.project_name ?? "",
      customerId: null,
      customerName: row.customer_name ?? "",
      salesRepId: row.sales_rep_id ?? null,
    };
  }
  for (const row of projects ?? []) {
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
