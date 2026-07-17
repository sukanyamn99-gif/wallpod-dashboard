import * as XLSX from "xlsx";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getFullProjectReport } from "@/lib/data/project-sales";

const PRODUCT_CATEGORIES = [
  "WALLPOD", "ACOUSHEET", "ACOUSOFT", "ACUBOX", "CNC", "SERVICE", "WALLPAPER", "OTHER",
] as const;

export async function GET() {
  if (!isSupabaseConfigured()) {
    return new Response("ยังไม่ได้ตั้งค่า Supabase", { status: 503 });
  }

  const allRows = await getFullProjectReport();
  const rows = allRows
    .filter((p) => !p.isCancelled)
    .map((p) => {
      const row: Record<string, string | number> = {
        "JOB NO.": p.jobNo ?? "",
        "DATE": p.projectDate,
        "CUSTOMER NAMES": p.customerName,
        "PROJECT NAME": p.projectName,
        "SALE": p.salesRepName,
        "Customer Type": p.customerType,
        "สถานะของงาน": p.productionStatus ?? "",
      };
      for (const cat of PRODUCT_CATEGORIES) {
        row[cat] = p.itemsByCategory[cat] || "";
      }
      row["PRE.VAT"] = p.preVat;
      row["VAT"] = p.vat;
      row["รวมทั้งสิ้น"] = p.total;
      row["ค่าวัสดุ"] = p.costs?.material ?? "";
      row["ค่ากาว"] = p.costs?.glue ?? "";
      row["ค่าตัด"] = p.costs?.cutting ?? "";
      row["ค่าติดตั้งผู้รับเหมา"] = p.costs?.install ?? "";
      row["ค่าที่จอดรถ"] = p.costs?.parking ?? "";
      row["ค่าขนส่ง"] = p.costs?.shipping ?? "";
      row["รวมต้นทุน"] = p.costs?.totalCost ?? "";
      row["กำไร"] = p.profit ?? "";
      row["เลขที่เอกสาร (งวด 1)"] = p.invoiceNo1 ?? "";
      row["งวดที่ 1 จำนวนเงิน"] = p.amount1 ?? "";
      row["วันที่รับชำระ (งวด 1)"] = p.paidDate1 ?? "";
      row["เลขที่เอกสาร (งวด 2)"] = p.invoiceNo2 ?? "";
      row["งวดที่ 2 จำนวนเงิน"] = p.amount2 ?? "";
      row["วันที่รับชำระ (งวด 2)"] = p.paidDate2 ?? "";
      row["สถานะ"] = p.status ?? "";
      row["ยอดคงค้าง"] = p.outstanding ?? "";
      return row;
    });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Project Sales");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const filename = `WALLPOD_Project_Sales_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
