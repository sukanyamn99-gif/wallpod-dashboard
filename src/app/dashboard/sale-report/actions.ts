"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { STAGE_PERCENT_BY_STAGE, type Stage } from "@/lib/types";

const IMAGE_BUCKET = "sale-report-images";
const MAX_IMAGES = 10;

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
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  if (!salesRepId) return { error: "กรุณาเลือกเซลล์" };
  if (!customerName) return { error: "กรุณากรอกชื่อลูกค้า" };
  if (!customerType) return { error: "กรุณาเลือกกลุ่มลูกค้า" };
  if (!projectType) return { error: "กรุณาเลือกประเภทสถานที่" };
  if (!stage || !(stage in STAGE_PERCENT_BY_STAGE)) return { error: "กรุณาเลือก stage" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lead, error } = await supabase
    .from("sales_leads")
    .insert({
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
      phone,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (images.length > 0) {
    const paths: string[] = [];
    for (const [i, file] of images.slice(0, MAX_IMAGES).entries()) {
      const path = `${salesRepId}/${lead.id}/${i}-${crypto.randomUUID()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
        contentType: "image/jpeg",
      });
      if (!uploadErr) paths.push(path);
    }

    if (paths.length > 0) {
      const { error: updateErr } = await supabase
        .from("sales_leads")
        .update({ image_paths: paths })
        .eq("id", lead.id);
      if (updateErr) return { error: `บันทึกข้อมูลสำเร็จ แต่บันทึกรูปภาพไม่สำเร็จ: ${updateErr.message}` };
    }
  }

  revalidatePath("/dashboard/sale-report");
  revalidatePath("/dashboard/sale-report/report");
  revalidatePath("/dashboard/sales");
  return { error: null };
}
