"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // Only the OAuth consent page (see middleware) may be returned to — a
  // relative path under /oauth/, never an arbitrary or external URL.
  const next = String(formData.get("next") ?? "");
  const safeNext = next.startsWith("/oauth/") && !next.includes("\\") && !next.startsWith("//") ? next : null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const nextParam = safeNext ? `&next=${encodeURIComponent(safeNext)}` : "";
    redirect(`/login?error=${encodeURIComponent(error.message)}${nextParam}`);
  }

  // Best-effort activity log — a failure here must never block a
  // successful login (same convention as this app's other secondary,
  // non-critical writes, e.g. Sale Report image uploads).
  if (data.user) {
    try {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user.id)
        .single();
      await supabase.from("login_log").insert({
        profile_id: data.user.id,
        full_name_snapshot: profileRow?.full_name ?? "",
        email: data.user.email ?? null,
      });
    } catch {
      // ignore — see comment above
    }
  }

  redirect(safeNext ?? "/dashboard/sales");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
