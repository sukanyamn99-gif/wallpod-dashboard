import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { ActivityLogEntry } from "@/lib/types";

export async function getActivityLog(): Promise<ActivityLogEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, actor_id, actor_name_snapshot, action, entity_label, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorNameSnapshot: row.actor_name_snapshot,
    action: row.action,
    entityLabel: row.entity_label,
    createdAt: row.created_at,
  }));
}
