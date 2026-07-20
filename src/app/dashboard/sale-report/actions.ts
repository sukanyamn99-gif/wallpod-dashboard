"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { STAGE_PERCENT_BY_STAGE, type Stage } from "@/lib/types";

const IMAGE_BUCKET = "sale-report-images";
const MAX_IMAGES = 10;

type ParsedSaleReport = {
  ok: true;
  salesRepId: string;
  customerName: string;
  projectName: string | null;
  customerType: string;
  projectType: string;
  stage: Stage;
  estValue: number;
  locationText: string | null;
  nextAction: string | null;
  note: string | null;
  phone: string | null;
};

function parseSaleReportForm(formData: FormData): { ok: false; error: string } | ParsedSaleReport {
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

  if (!salesRepId) return { ok: false, error: "กรุณาเลือกเซลล์" };
  if (!customerName) return { ok: false, error: "กรุณากรอกชื่อลูกค้า" };
  if (!customerType) return { ok: false, error: "กรุณาเลือกกลุ่มลูกค้า" };
  if (!projectType) return { ok: false, error: "กรุณาเลือกประเภทสถานที่" };
  if (!stage || !(stage in STAGE_PERCENT_BY_STAGE)) return { ok: false, error: "กรุณาเลือก stage" };

  return {
    ok: true,
    salesRepId,
    customerName,
    projectName,
    customerType,
    projectType,
    stage,
    estValue: Number.isFinite(estValue) ? estValue : 0,
    locationText,
    nextAction,
    note,
    phone,
  };
}

async function uploadImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  salesRepId: string,
  leadId: string,
  files: File[],
): Promise<string[]> {
  const paths: string[] = [];
  for (const [i, file] of files.entries()) {
    const path = `${salesRepId}/${leadId}/${Date.now()}-${i}-${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
      contentType: "image/jpeg",
    });
    if (!error) paths.push(path);
  }
  return paths;
}

export async function createSaleReport(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseSaleReportForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: lead, error } = await supabase
    .from("sales_leads")
    .insert({
      sales_rep_id: parsed.salesRepId,
      customer_name: parsed.customerName,
      project_name: parsed.projectName,
      customer_type: parsed.customerType,
      project_type: parsed.projectType,
      stage: parsed.stage,
      stage_percent: STAGE_PERCENT_BY_STAGE[parsed.stage],
      est_value: parsed.estValue,
      location_text: parsed.locationText,
      next_action: parsed.nextAction,
      note: parsed.note,
      phone: parsed.phone,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (images.length > 0) {
    const paths = await uploadImages(supabase, parsed.salesRepId, lead.id, images.slice(0, MAX_IMAGES));
    if (paths.length > 0) {
      const { error: updateErr } = await supabase
        .from("sales_leads")
        .update({ image_paths: paths })
        .eq("id", lead.id);
      if (updateErr) return { error: `บันทึกข้อมูลสำเร็จ แต่บันทึกรูปภาพไม่สำเร็จ: ${updateErr.message}` };
    }
  }

  revalidatePath("/dashboard/sale-report");
  revalidatePath("/dashboard/sales");
  return { error: null };
}

export async function updateSaleReport(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const parsed = parseSaleReportForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  // Fresh read right before mutating — both the source of truth for the audit
  // snapshot and the basis for diffing which images were removed. Reading
  // the client's copy back instead would let someone tamper with the log.
  const { data: before, error: fetchErr } = await supabase
    .from("sales_leads")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr) return { error: fetchErr.message };

  const { error: updateErr } = await supabase
    .from("sales_leads")
    .update({
      sales_rep_id: parsed.salesRepId,
      customer_name: parsed.customerName,
      project_name: parsed.projectName,
      customer_type: parsed.customerType,
      project_type: parsed.projectType,
      stage: parsed.stage,
      stage_percent: STAGE_PERCENT_BY_STAGE[parsed.stage],
      est_value: parsed.estValue,
      location_text: parsed.locationText,
      next_action: parsed.nextAction,
      note: parsed.note,
      phone: parsed.phone,
    })
    .eq("id", id);
  if (updateErr) return { error: updateErr.message };

  const keptPaths = new Set(formData.getAll("existing_image_paths").map(String));
  const originalPaths: string[] = before.image_paths ?? [];
  const survivors = originalPaths.filter((p) => keptPaths.has(p));
  const removed = originalPaths.filter((p) => !keptPaths.has(p));

  if (removed.length > 0) {
    await supabase.storage.from(IMAGE_BUCKET).remove(removed);
  }

  const newFiles = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const room = Math.max(0, MAX_IMAGES - survivors.length);
  const newPaths = await uploadImages(supabase, parsed.salesRepId, id, newFiles.slice(0, room));

  const finalPaths = [...survivors, ...newPaths];
  const { error: pathsErr } = await supabase.from("sales_leads").update({ image_paths: finalPaths }).eq("id", id);
  if (pathsErr) return { error: `บันทึกข้อมูลสำเร็จ แต่บันทึกรูปภาพไม่สำเร็จ: ${pathsErr.message}` };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Best-effort — a logging hiccup must never block the save the user asked for.
  await supabase.from("sales_lead_change_log").insert({
    sale_lead_id: id,
    action: "update",
    sales_rep_id: before.sales_rep_id,
    customer_name: before.customer_name,
    changed_by: user?.id ?? null,
    before_snapshot: before,
  });

  revalidatePath(`/dashboard/sale-report/edit/${id}`);
  revalidatePath("/dashboard/sale-report");
  revalidatePath("/dashboard/sales");
  return { error: null };
}

export async function deleteSaleReport(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();

  const { data: before, error: fetchErr } = await supabase
    .from("sales_leads")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr) return { error: fetchErr.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Log first, while the row (and its FK target) still exists — deleting first
  // would make the log insert fail its foreign key check against a gone row.
  // The FK's "on delete set null" then nulls sale_lead_id once we delete below,
  // which is exactly what lets this log entry outlive the record it describes.
  await supabase.from("sales_lead_change_log").insert({
    sale_lead_id: id,
    action: "delete",
    sales_rep_id: before.sales_rep_id,
    customer_name: before.customer_name,
    changed_by: user?.id ?? null,
    before_snapshot: before,
  });

  const imagePaths: string[] = before.image_paths ?? [];
  if (imagePaths.length > 0) {
    await supabase.storage.from(IMAGE_BUCKET).remove(imagePaths);
  }

  const { error } = await supabase.from("sales_leads").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/sale-report");
  revalidatePath("/dashboard/sales");
  return { error: null };
}
