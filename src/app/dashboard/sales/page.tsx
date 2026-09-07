import { getSalesDashboardRawData } from "@/lib/data/sales";
import { getCurrentProfile } from "@/lib/data/profile";
import { canDrillDownSalesDashboard } from "@/lib/permissions";
import { SalesDashboardView } from "./sales-dashboard-view";

export default async function SalesDashboardPage() {
  const [{ projects, saleReports, cancelledProjects, quotations }, profile] = await Promise.all([
    getSalesDashboardRawData(),
    getCurrentProfile(),
  ]);

  return (
    <SalesDashboardView
      projects={projects}
      saleReports={saleReports}
      cancelledProjects={cancelledProjects}
      quotations={quotations}
      canDrillDown={profile ? canDrillDownSalesDashboard(profile.role) : false}
    />
  );
}
