import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Role, UserAccount } from "@/lib/types";

export async function getUserAccounts(): Promise<UserAccount[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();

  const [{ data: profiles, error: profilesErr }, { data: emails, error: emailsErr }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, department, active, created_at")
      .order("created_at", { ascending: true }),
    supabase.rpc("get_user_emails"),
  ]);
  if (profilesErr) throw profilesErr;

  // Non-owner callers are denied by the RPC's internal role check; degrade to
  // "no email shown" rather than failing the whole page (the page itself is
  // already gated to owner, so this only matters as a defense-in-depth fallback).
  const emailMap = new Map<string, string | null>(
    emailsErr ? [] : (emails ?? []).map((e: { id: string; email: string | null }) => [e.id, e.email]),
  );

  return (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: emailMap.get(p.id) ?? null,
    role: p.role as Role,
    department: p.department,
    active: p.active,
    createdAt: p.created_at,
  }));
}
