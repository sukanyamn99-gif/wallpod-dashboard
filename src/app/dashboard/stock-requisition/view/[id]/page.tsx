import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getStockRequisitionById } from "@/lib/data/stock-requisitions";
import { REQUISITION_PURPOSE_LABELS } from "@/lib/types";

export default async function StockRequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requisition = await getStockRequisitionById(id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {requisition ? `ใบเบิกสินค้า ${requisition.docNo}` : "ไม่พบข้อมูล"}
        </h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/stock-requisition" className="underline underline-offset-2">
            ← กลับไปหน้าใบเบิกสินค้า
          </Link>
        </p>
      </div>

      {requisition ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลใบเบิก</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">แผนก</p>
                <p className="font-medium">{requisition.departmentName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ผู้เบิก</p>
                <p className="font-medium">{requisition.requestedByName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เลข JOB</p>
                <p className="font-medium">{requisition.jobNo ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ชื่องาน / โครงการ</p>
                <p className="font-medium">{requisition.projectName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วัตถุประสงค์</p>
                <p className="font-medium">{REQUISITION_PURPOSE_LABELS[requisition.purpose]}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ลูกค้า</p>
                <p className="font-medium">{requisition.customerName ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สถานะ</p>
                <Badge variant="secondary">{requisition.status}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">วันที่</p>
                <p className="font-medium">{new Date(requisition.createdAt).toLocaleString("th-TH")}</p>
              </div>
              {requisition.note && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">หมายเหตุ</p>
                  <p className="font-medium">{requisition.note}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รายการสินค้า ({requisition.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัสสินค้า</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requisition.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.productSku ?? "—"}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">ไม่พบใบเบิกนี้ในระบบ</p>
      )}
    </div>
  );
}
