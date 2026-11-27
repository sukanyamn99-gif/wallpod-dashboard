import { redirect } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChartGradientDefs } from "@/components/dashboard/chart-gradient-defs";
import { getCurrentProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    // Distinguish "not logged in" (normal, silent redirect) from "logged in
    // but no matching profiles row" (a real account-setup gap — has happened
    // for accounts created outside the app's own flow — needs a clear message
    // rather than a confusing silent bounce back to a blank-looking login).
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect(`/login?error=${encodeURIComponent("ไม่พบข้อมูลผู้ใช้งานนี้ในระบบ กรุณาติดต่อผู้ดูแลระบบ")}`);
    }
    redirect("/login");
  }
  if (!profile.active) {
    redirect(`/login?error=${encodeURIComponent("บัญชีนี้ถูกระงับการใช้งาน")}`);
  }

  return (
    <SidebarProvider>
      <ChartGradientDefs />
      <AppSidebar profile={profile} />
      <main className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b p-3 print:hidden">
          <SidebarTrigger />
          {profile.readOnly && (
            <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
              โหมดอ่านอย่างเดียว — ดูข้อมูลได้ แต่เพิ่ม แก้ไข หรือลบไม่ได้
            </span>
          )}
        </div>
        {profile.readOnly && (
          // The database refuses every write for this account; this only tidies
          // away the buttons that would open a create / edit / import screen.
          <style>{`a[href$="/new"],a[href*="/new?"],a[href*="/edit/"],a[href$="/import"],a[href*="/import?"]{display:none!important}`}</style>
        )}
        <div className="p-6 print:p-0">{children}</div>
      </main>
    </SidebarProvider>
  );
}
