import { redirect } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
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
      <AppSidebar profile={profile} />
      <main className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b p-3">
          <SidebarTrigger />
        </div>
        <div className="p-6">{children}</div>
      </main>
    </SidebarProvider>
  );
}
