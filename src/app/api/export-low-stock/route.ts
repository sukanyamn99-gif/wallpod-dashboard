import * as XLSX from "xlsx";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getStockDashboardData } from "@/lib/data/stock";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return new Response("ยังไม่ได้ตั้งค่า Supabase", { status: 503 });
  }

  const { lowStockItems } = await getStockDashboardData();
  const rows = lowStockItems.map((p) => ({
    "สถานะ": p.quantityOnHand <= 0 ? "OUT OF STOCK" : "สินค้าใกล้หมด",
    "รหัส": p.sku ?? "",
    "ชื่อสินค้า": p.name,
    "หมวดหมู่": p.category ?? "",
    "ปัจจุบัน": p.quantityOnHand,
    "ขั้นต่ำ": p.reorderPoint,
    "ขาด": Math.max(0, p.reorderPoint - p.quantityOnHand),
    "หน่วย": p.unit,
    "ตำแหน่งจัดเก็บ": p.location ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Low Stock Alert");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const filename = `WALLPOD_Low_Stock_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
