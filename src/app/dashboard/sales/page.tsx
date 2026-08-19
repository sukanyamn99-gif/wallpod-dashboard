import { getSalesDashboardRawData } from "@/lib/data/sales";
import { SalesDashboardView } from "./sales-dashboard-view";

export default async function SalesDashboardPage() {
  const { projects, saleReports } = await getSalesDashboardRawData();

  return <SalesDashboardView projects={projects} saleReports={saleReports} />;
}
