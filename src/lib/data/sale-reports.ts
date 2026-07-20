import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { mockSaleReports } from "@/lib/mock-data";
import type { SaleReport, SaleReportChangeLog } from "@/lib/types";

const IMAGE_BUCKET = "sale-report-images";

const SALE_REPORT_COLUMNS =
  "id, sales_rep_id, customer_name, project_name, customer_type, project_type, stage, stage_percent, est_value, location_text, next_action, note, phone, image_paths, created_at, sales_reps(name)";

function mapRow(row: {
  id: string;
  sales_rep_id: string;
  customer_name: string;
  project_name: string | null;
  customer_type: string;
  project_type: string;
  stage: string;
  stage_percent: number;
  est_value: string | number;
  location_text: string | null;
  next_action: string | null;
  note: string | null;
  phone: string | null;
  image_paths: string[] | null;
  created_at: string;
}): SaleReport {
  return {
    id: row.id,
    sales_rep_id: row.sales_rep_id,
    // @ts-expect-error -- Supabase types the joined relation loosely here
    sales_rep_name: row.sales_reps?.name ?? "",
    customer_name: row.customer_name,
    project_name: row.project_name,
    customer_type: row.customer_type as SaleReport["customer_type"],
    project_type: row.project_type as SaleReport["project_type"],
    stage: row.stage as SaleReport["stage"],
    stage_percent: row.stage_percent as SaleReport["stage_percent"],
    est_value: Number(row.est_value),
    location_text: row.location_text,
    next_action: row.next_action,
    note: row.note,
    phone: row.phone,
    image_paths: row.image_paths ?? [],
    created_at: row.created_at,
  };
}

/**
 * Batch-signs every given Storage path in one call so pages that render many
 * reports don't pay a signing round-trip per report. Degrades to an empty
 * map (no thumbnails) rather than failing the page if signing errors out.
 */
export async function getSignedImageUrls(paths: string[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured() || paths.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return {};

  const urls: Record<string, string> = {};
  for (const entry of data) {
    if (entry.signedUrl && entry.path) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}

export async function getTodaySaleReports(): Promise<SaleReport[]> {
  if (!isSupabaseConfigured()) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return mockSaleReports.filter((r) => new Date(r.created_at) >= todayStart);
  }

  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("sales_leads")
    .select(SALE_REPORT_COLUMNS)
    .gte("created_at", todayStart.toISOString())
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getAllSaleReports(): Promise<SaleReport[]> {
  if (!isSupabaseConfigured()) return mockSaleReports;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_leads")
    .select(SALE_REPORT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getSaleReportById(id: string): Promise<SaleReport | null> {
  if (!isSupabaseConfigured()) return mockSaleReports.find((r) => r.id === id) ?? null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_leads")
    .select(SALE_REPORT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function getSaleReportChangeLog(): Promise<SaleReportChangeLog[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_lead_change_log")
    .select("id, action, customer_name, before_snapshot, created_at, sales_reps(name), profiles(full_name)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const before = row.before_snapshot as { stage?: string; est_value?: number | string } | null;
    return {
      id: row.id,
      action: row.action as SaleReportChangeLog["action"],
      // @ts-expect-error -- Supabase types the joined relation loosely here
      salesRepName: row.sales_reps?.name ?? "",
      customerName: row.customer_name,
      // @ts-expect-error -- Supabase types the joined relation loosely here
      changedByName: row.profiles?.full_name ?? "—",
      stageBefore: (before?.stage as SaleReportChangeLog["stageBefore"]) ?? "—",
      estValueBefore: Number(before?.est_value ?? 0),
      createdAt: row.created_at,
    };
  });
}
