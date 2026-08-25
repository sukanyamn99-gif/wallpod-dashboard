import { createClient } from "@/lib/supabase/server";

// Best-effort — logging a significant/risky action must never block the
// action itself (same convention as login_log's insert in the sign-in
// action). Call this after the action has already succeeded, or — for
// deletes — after fetching the entity's label but before the row is gone.
export async function logActivity(action: string, entityLabel?: string | null) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    await supabase.from("activity_log").insert({
      actor_id: user.id,
      actor_name_snapshot: profileRow?.full_name ?? "",
      action,
      entity_label: entityLabel ?? null,
    });
  } catch {
    // ignore — see comment above
  }
}
