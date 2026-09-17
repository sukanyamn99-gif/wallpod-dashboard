"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { DATA_DOCUMENTS_BUCKET, getDataDocumentById } from "@/lib/data/data-documents";

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

export async function createDataDocument(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const title = str(formData.get("title"));
  const category = str(formData.get("category")) ?? "เอกสาร";
  const file = formData.get("file");
  const thumbnail = formData.get("thumbnail");

  if (!title) return { error: "กรุณากรอกชื่อเอกสาร" };
  if (!(file instanceof File) || file.size === 0) return { error: "กรุณาเลือกไฟล์เอกสาร" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Generated up front (not left to the row's own default) so the same id
  // can double as the Storage folder name in one round trip, instead of
  // inserting an empty row first just to learn its id.
  const id = crypto.randomUUID();
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const filePath = `${id}/file.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(DATA_DOCUMENTS_BUCKET)
    .upload(filePath, file, { contentType: file.type || "application/octet-stream" });
  if (uploadErr) return { error: `อัปโหลดไฟล์ไม่สำเร็จ: ${uploadErr.message}` };

  // Best-effort — a thumbnail upload failure just falls back to a generic
  // file icon on the card, it never blocks saving the document itself.
  let thumbnailPath: string | null = null;
  if (thumbnail instanceof File && thumbnail.size > 0) {
    const candidatePath = `${id}/thumbnail.jpg`;
    const { error: thumbErr } = await supabase.storage
      .from(DATA_DOCUMENTS_BUCKET)
      .upload(candidatePath, thumbnail, { contentType: "image/jpeg" });
    if (!thumbErr) thumbnailPath = candidatePath;
  }

  const { error: insertErr } = await supabase.from("data_documents").insert({
    id,
    title,
    category,
    file_path: filePath,
    file_type: ext.toUpperCase(),
    file_size_bytes: file.size,
    thumbnail_path: thumbnailPath,
    created_by: user?.id ?? null,
  });
  if (insertErr) {
    await supabase.storage
      .from(DATA_DOCUMENTS_BUCKET)
      .remove([filePath, ...(thumbnailPath ? [thumbnailPath] : [])]);
    return { error: insertErr.message };
  }

  revalidatePath("/dashboard/data-documents");
  return { error: null };
}

export async function deleteDataDocument(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const existing = await getDataDocumentById(id);
  if (!existing) return { error: "ไม่พบเอกสารนี้ในระบบ" };

  const supabase = await createClient();
  const paths = [existing.filePath, ...(existing.thumbnailPath ? [existing.thumbnailPath] : [])];
  await supabase.storage.from(DATA_DOCUMENTS_BUCKET).remove(paths); // best-effort cleanup

  const { error } = await supabase.from("data_documents").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/data-documents");
  return { error: null };
}
