import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { DATA_DOCUMENTS_BUCKET } from "@/lib/data-documents-constants";
import type { DataDocument } from "@/lib/types";

export { DATA_DOCUMENTS_BUCKET };

const COLUMNS = "id, title, category, file_path, file_type, file_size_bytes, thumbnail_path, created_at";

function mapRow(row: {
  id: string;
  title: string;
  category: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number;
  thumbnail_path: string | null;
  created_at: string;
}): DataDocument {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    filePath: row.file_path,
    fileType: row.file_type,
    fileSizeBytes: Number(row.file_size_bytes),
    thumbnailPath: row.thumbnail_path,
    createdAt: row.created_at,
  };
}

export async function getDataDocuments(): Promise<DataDocument[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("data_documents").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getDataDocumentById(id: string): Promise<DataDocument | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("data_documents").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

// One batched call for every thumbnail + file path a page needs signed URLs
// for, rather than one call per document — same convention as Sale Report's
// getSignedImageUrls.
export async function getSignedDataDocumentUrls(paths: string[]): Promise<Record<string, string>> {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  if (!isSupabaseConfigured() || uniquePaths.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(DATA_DOCUMENTS_BUCKET).createSignedUrls(uniquePaths, 3600);
  if (error || !data) return {};

  const urls: Record<string, string> = {};
  for (const entry of data) {
    if (entry.signedUrl && entry.path) urls[entry.path] = entry.signedUrl;
  }
  return urls;
}
