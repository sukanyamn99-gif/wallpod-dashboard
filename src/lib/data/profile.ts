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
  if (!isSupabaseConfigured()) {
    // The demo/owner fallback below is only safe on a developer's own
    // machine, where there's no real data behind it. `VERCEL` is set on
    // every Vercel environment (production AND preview) — if Supabase's
    // env vars ever go missing there, this must fail loudly instead of
    // silently handing out unauthenticated owner access to whoever loads
    // the page. Throwing here surfaces as a 500 (visible, alertable),
    // which is the correct failure mode for a security-relevant misconfig.
    if (process.env.VERCEL) {
      throw new Error(
        "Supabase is not configured on this deployment (missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY). Refusing to fall back to demo/owner access — set the environment variables in Vercel and redeploy.",
      );
    }
    return DEMO_PROFILE;
  }

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
