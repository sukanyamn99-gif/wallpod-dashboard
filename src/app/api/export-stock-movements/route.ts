import * as XLSX from "xlsx";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getStockMovements } from "@/lib/data/stock";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return new Response("ยังไม่ได้ตั้งค่า Supabase", { status: 503 });
  }

  const movements = await getStockMovements();
  const rows = movements.map((m) => ({
    "วันที่/เวลา": new Date(m.createdAt).toLocaleString("th-TH"),
    "ประเภท": m.movementType.toUpperCase(),
    "รหัส": m.productSku ?? "",
    "ชื่อสินค้า": m.productName,
    "จำนวน": m.quantity,
    "หน่วย": m.unit,
    "ก่อน": m.balanceBefore ?? "",
    "หลัง": m.balanceAfter ?? "",
    "เอกสารอ้างอิง": m.referenceNo ?? "",
    "ดำเนินการโดย": m.createdByName,
    "หมายเหตุ": m.note ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Movements");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const filename = `WALLPOD_Stock_Movements_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
