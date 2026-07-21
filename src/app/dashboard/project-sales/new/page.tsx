import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomers, getProductCategories, getSalesReps } from "@/lib/data/reference";
import { ProjectSaleForm } from "../project-sale-form";

export default async function NewProjectSalePage() {
  const [salesReps, customers, categories] = await Promise.all([
    getSalesReps(),
    getCustomers(),
    getProductCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">บันทึกงานขายใหม่</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/project-sales" className="underline underline-offset-2">
            ← กลับไปหน้า WALLPOD Project Sales
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลงานขาย</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectSaleForm salesReps={salesReps} customers={customers} categories={categories.map((c) => c.name)} />
        </CardContent>
      </Card>
    </div>
  );
}
