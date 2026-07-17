"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { STAGE_PERCENT_BY_STAGE, type Stage } from "@/lib/types";

export async function createSaleReport(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const salesRepId = String(formData.get("sales_rep_id") ?? "");
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const projectName = String(formData.get("project_name") ?? "").trim() || null;
  const customerType = String(formData.get("customer_type") ?? "");
  const projectType = String(formData.get("project_type") ?? "");
  const stage = String(formData.get("stage") ?? "") as Stage;
  const estValue = Number(formData.get("est_value") ?? 0);
  const locationText = String(formData.get("location_text") ?? "").trim() || null;
  const nextAction = String(formData.get("next_action") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!salesRepId) return { error: "กรุณาเลือกเซลล์" };
  if (!customerName) return { error: "กรุณากรอกชื่อลูกค้า" };
  if (!customerType) return { error: "กรุณาเลือกกลุ่มลูกค้า" };
  if (!projectType) return { error: "กรุณาเลือกประเภทสถานที่" };
  if (!stage || !(stage in STAGE_PERCENT_BY_STAGE)) return { error: "กรุณาเลือก stage" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("sales_leads").insert({
    sales_rep_id: salesRepId,
    customer_name: customerName,
    project_name: projectName,
    customer_type: customerType,
    project_type: projectType,
    stage,
    stage_percent: STAGE_PERCENT_BY_STAGE[stage],
    est_value: Number.isFinite(estValue) ? estValue : 0,
    location_text: locationText,
    next_action: nextAction,
    note,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sale-report");
  revalidatePath("/dashboard/sales");
  return { error: null };
}
