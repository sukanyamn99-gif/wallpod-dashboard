"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { DATA_DOCUMENTS_BUCKET, getDataDocumentById } from "@/lib/data/data-documents";

// The actual file (and optional thumbnail) upload happens client-side,
// straight from the browser to Supabase Storage — not through this action.
// Both Next.js Server Actions and this app's Route Handlers proved unable
// to reliably read a large (20MB+) multipart body in this environment
// (confirmed via real testing: "Unexpected end of form" / "expected
// boundary after body"), a known class of Next.js dev-server body-parsing
// bug. Uploading directly to Storage sidesteps the Next.js server
// entirely for the large binary; this action only ever receives small,
// plain (non-file) fields, so it can't hit that bug.
export async function recordDataDocument(fields: {
  title: string;
  category: string;
  filePath: string;
  fileType: string;
  fileSizeBytes: number;
  thumbnailPath: string | null;
}) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }
  if (!fields.title.trim()) return { error: "กรุณากรอกชื่อเอกสาร" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("data_documents").insert({
    title: fields.title.trim(),
    category: fields.category.trim() || "เอกสาร",
    file_path: fields.filePath,
    file_type: fields.fileType,
    file_size_bytes: fields.fileSizeBytes,
    thumbnail_path: fields.thumbnailPath,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };

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
