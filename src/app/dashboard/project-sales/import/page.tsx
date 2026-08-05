import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { ImportForm } from "../import-form";

export default async function ImportProjectSalesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner") redirect("/dashboard/project-sales");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import Excel — WALLPOD Project Sales</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/project-sales" className="underline underline-offset-2">
            ← กลับไปหน้า WALLPOD Project Sales
          </Link>
        </p>
      </div>

      <ImportForm />
    </div>
  );
}
