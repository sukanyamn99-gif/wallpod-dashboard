import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { QuotationConditionSection, QuotationPrintNote, QuotationPrintTemplate, QuotationType } from "@/lib/types";

const QUOTATION_TYPES: QuotationType[] = ["ค่าของ", "ค่าติดตั้ง"];

function emptyTemplate(quotationType: QuotationType): QuotationPrintTemplate {
  return { quotationType, notes: [], showWhtNote: false, conditions: [] };
}

type Row = {
  quotation_type: QuotationType;
  notes: QuotationPrintNote[];
  show_wht_note: boolean;
  conditions: QuotationConditionSection[];
};

function mapRow(row: Row): QuotationPrintTemplate {
  return {
    quotationType: row.quotation_type,
    notes: row.notes ?? [],
    showWhtNote: row.show_wht_note,
    conditions: row.conditions ?? [],
  };
}

// Keyed by QuotationType so the print view and the settings editor can both
// do a direct lookup. Falls back to an empty (blank) template for a type
// with no row yet — defensive only; the migration seeds both rows.
export async function getQuotationPrintTemplates(): Promise<Record<QuotationType, QuotationPrintTemplate>> {
  const fallback = {
    ค่าของ: emptyTemplate("ค่าของ"),
    ค่าติดตั้ง: emptyTemplate("ค่าติดตั้ง"),
  };
  if (!isSupabaseConfigured()) return fallback;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotation_print_templates")
    .select("quotation_type, notes, show_wht_note, conditions");
  if (error) throw error;

  const result = { ...fallback };
  for (const row of (data ?? []) as Row[]) {
    if (QUOTATION_TYPES.includes(row.quotation_type)) result[row.quotation_type] = mapRow(row);
  }
  return result;
}
