"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { QuotationConditionSection, QuotationPrintNote, QuotationType } from "@/lib/types";

const QUOTATION_TYPES: QuotationType[] = ["ค่าของ", "ค่าติดตั้ง"];

// The editor form serializes its whole (nested, variable-length) notes/
// conditions state as JSON rather than flattening it into repeated
// FormData fields — much simpler than reconstructing a hierarchy of
// sections-with-items from flat arrays, and this is the only writer of
// this shape.
export async function updateQuotationPrintTemplate(quotationType: QuotationType, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }
  if (!QUOTATION_TYPES.includes(quotationType)) return { error: "ประเภทใบเสนอราคาไม่ถูกต้อง" };

  let rawNotes: unknown;
  let rawConditions: unknown;
  try {
    rawNotes = JSON.parse(String(formData.get("notes_json") ?? "[]"));
    rawConditions = JSON.parse(String(formData.get("conditions_json") ?? "[]"));
  } catch {
    return { error: "ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาลองใหม่" };
  }
  const showWhtNote = String(formData.get("show_wht_note") ?? "") === "true";

  // Never trust the client's shape as final — re-validate every field so a
  // stale tab or bug can't write garbage into what every future print job
  // reads.
  const notes: QuotationPrintNote[] = Array.isArray(rawNotes)
    ? rawNotes
        .map((n) => {
          const tone = n?.tone === "red" || n?.tone === "amber" ? n.tone : "normal";
          return { text: String(n?.text ?? "").trim(), tone };
        })
        .filter((n) => n.text)
    : [];

  const conditions: QuotationConditionSection[] = Array.isArray(rawConditions)
    ? rawConditions
        .map((s) => ({
          heading: String(s?.heading ?? "").trim(),
          underline: !!s?.underline,
          items: Array.isArray(s?.items)
            ? s.items
                .map((it: { icon?: string; text?: string }) => ({
                  icon: (it?.icon === "person" ? "person" : "check") as "check" | "person",
                  text: String(it?.text ?? "").trim(),
                }))
                .filter((it: { text: string }) => it.text)
            : [],
        }))
        .filter((s) => s.heading || s.items.length > 0)
    : [];

  const supabase = await createClient();
  const { error } = await supabase
    .from("quotation_print_templates")
    .update({ notes, show_wht_note: showWhtNote, conditions, updated_at: new Date().toISOString() })
    .eq("quotation_type", quotationType);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings/documents");
  return { error: null };
}
