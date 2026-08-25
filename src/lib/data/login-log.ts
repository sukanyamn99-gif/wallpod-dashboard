import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { LoginLogEntry } from "@/lib/types";

export async function getLoginLog(): Promise<LoginLogEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("login_log")
    .select("id, profile_id, full_name_snapshot, email, logged_in_at")
    .order("logged_in_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    fullNameSnapshot: row.full_name_snapshot,
    email: row.email,
    loggedInAt: row.logged_in_at,
  }));
}
