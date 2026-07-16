import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSalesReps, getCustomers } from "@/lib/data/reference";
import { getTodayVisits } from "@/lib/data/visits";
import { VisitForm } from "./visit-form";

export default async function VisitsPage() {
  const [salesReps, customers, todayVisits] = await Promise.all([
    getSalesReps(),
    getCustomers(),
    getTodayVisits(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">บันทึกนัดหมาย (Check-in)</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกการเข้าพบลูกค้าวันนี้ เพื่อใช้คำนวณ KPI &quot;เช็คอินวันนี้&quot; บน Sales Dashboard
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>บันทึกนัดหมายใหม่</CardTitle>
          </CardHeader>
          <CardContent>
            <VisitForm salesReps={salesReps} customers={customers} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>รายการวันนี้ ({todayVisits.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayVisits.length === 0 && (
              <p className="text-sm text-muted-foreground">ยังไม่มีนัดหมายวันนี้</p>
            )}
            {todayVisits.map((visit) => (
              <div key={visit.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{visit.sales_rep_name}</p>
                {visit.customer_name && (
                  <p className="text-muted-foreground">ลูกค้า: {visit.customer_name}</p>
                )}
                {visit.note && <p className="text-muted-foreground">{visit.note}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
