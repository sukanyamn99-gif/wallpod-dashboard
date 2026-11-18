import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFullProjectReport } from "@/lib/data/project-sales";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage, canSeeProjectCosts } from "@/lib/permissions";
import { PrintProjectSalesView } from "./print-project-sales-view";

type PrintSearchParams = { q?: string; customer?: string; months?: string; reps?: string };

function splitList(value: string | undefined): Set<string> {
  return new Set((value ?? "").split("|").map((v) => v.trim()).filter(Boolean));
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PrintSearchParams>;
}): Promise<Metadata> {
  const { customer } = await searchParams;
  return { title: customer ? `รายงานงานขาย ${customer}` : "รายงานงานขาย" };
}

// Prints exactly what the Project Sales list is showing: the same search /
// customer / month / sales-rep filters arrive as query params and are applied
// here the same way the list applies them, so paper matches the screen.
export default async function PrintProjectSalesPage({
  searchParams,
}: {
  searchParams: Promise<PrintSearchParams>;
}) {
  const { q, customer, months, reps } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!canAccessPage(profile.role, "/dashboard/project-sales")) redirect("/dashboard/sales");

  const { rows: projects } = await getFullProjectReport();

  const query = (q ?? "").trim().toLowerCase();
  const customerQuery = (customer ?? "").trim().toLowerCase();
  const monthKeys = splitList(months);
  const repNames = splitList(reps);

  const rows = projects.filter((p) => {
    if (query) {
      const hit =
        (p.jobNo ?? "").toLowerCase().includes(query) ||
        p.customerName.toLowerCase().includes(query) ||
        p.projectName.toLowerCase().includes(query) ||
        p.salesRepName.toLowerCase().includes(query);
      if (!hit) return false;
    }
    if (customerQuery && !p.customerName.toLowerCase().includes(customerQuery)) return false;
    if (monthKeys.size > 0) {
      const d = new Date(p.projectDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthKeys.has(key)) return false;
    }
    if (repNames.size > 0 && !repNames.has(p.salesRepName)) return false;
    return true;
  });

  const filterLabels = [
    customer ? `ลูกค้า: ${customer}` : null,
    q ? `ค้นหา: ${q}` : null,
    repNames.size > 0 ? `เซลล์: ${Array.from(repNames).join(", ")}` : null,
  ].filter((v): v is string => !!v);

  return (
    <PrintProjectSalesView
      rows={rows}
      canSeeCosts={canSeeProjectCosts(profile.role)}
      filterLabels={filterLabels}
      preparerName={profile.full_name}
    />
  );
}
