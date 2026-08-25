"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
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

  redirect("/dashboard/sales");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
