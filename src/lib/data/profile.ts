import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const DEMO_PROFILE: Profile = {
  id: "demo",
  full_name: "โหมดทดลอง",
  role: "owner",
  sales_rep_id: null,
  department: null,
  active: true,
};

export async function getCurrentProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return DEMO_PROFILE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, sales_rep_id, department, active")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}
