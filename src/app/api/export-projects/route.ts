import * as XLSX from "xlsx";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getFullProjectReport } from "@/lib/data/project-sales";
import { getCurrentProfile } from "@/lib/data/profile";
import { canAccessPage } from "@/lib/permissions";

// This route contains the same cost/profit/payment data as the WALLPOD
// Project Sales page — RLS on `projects`/`project_costs` already filters
// what each role can read, but that's not a substitute for checking access
// at the entry point too: an explicit check here means a future RLS
// mistake on those tables can't silently turn into a data leak through
// this download link.
export async function GET() {
  if (!isSupabaseConfigured()) {
    return new Response("ยังไม่ได้ตั้งค่า Supabase", { status: 503 });
  }

  const profile = await getCurrentProfile();
  if (!profile || !profile.active || !canAccessPage(profile.role, "/dashboard/project-sales")) {
    return new Response("ไม่มีสิทธิ์เข้าถึงข้อมูลนี้", { status: 403 });
  }

  const { categories, rows: allRows } = await getFullProjectReport();
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
      for (const cat of categories) {
        row[cat] = p.itemsByCategory[cat] || "";
      }
      row["PRE.VAT"] = p.preVat;
      row["VAT"] = p.vat;
      row["รวมทั้งสิ้น"] = p.total;
      row["ค่าวัสดุ"] = p.costs?.material ?? "";
      row["ค่ากาว"] = p.costs?.glue ?? "";
      row["ค่าตัด"] = p.costs?.cutting ?? "";
      row["ค่าติดตั้งผู้รับเหมา"] = p.costs?.install ?? "";
      row["ค่าเดินทาง+ค่าที่จอดรถ"] = p.costs?.parking ?? "";
      row["ค่าขนส่ง"] = p.costs?.shipping ?? "";
      row["รวมต้นทุน"] = p.costs?.totalCost ?? "";
      row["กำไร"] = p.profit ?? "";
      row["เลขที่เอกสาร (งวด 1)"] = p.invoiceNo1 ?? "";
      row["งวดที่ 1 จำนวนเงิน"] = p.amount1 ?? "";
      row["วันที่ออกเอกสาร (งวด 1)"] = p.paidDate1 ?? "";
      row["เลขที่ใบเสร็จ (งวด 1)"] = p.receiptNo1 ?? "";
      row["วันที่รับชำระเงิน (งวด 1)"] = p.receivedDate1 ?? "";
      row["เลขที่เอกสาร (งวด 2)"] = p.invoiceNo2 ?? "";
      row["งวดที่ 2 จำนวนเงิน"] = p.amount2 ?? "";
      row["วันที่ออกเอกสาร (งวด 2)"] = p.paidDate2 ?? "";
      row["เลขที่ใบเสร็จ (งวด 2)"] = p.receiptNo2 ?? "";
      row["วันที่รับชำระเงิน (งวด 2)"] = p.receivedDate2 ?? "";
      row["เลขที่เอกสาร (งวด 3)"] = p.invoiceNo3 ?? "";
      row["งวดที่ 3 จำนวนเงิน"] = p.amount3 ?? "";
      row["วันที่ออกเอกสาร (งวด 3)"] = p.paidDate3 ?? "";
      row["เลขที่ใบเสร็จ (งวด 3)"] = p.receiptNo3 ?? "";
      row["วันที่รับชำระเงิน (งวด 3)"] = p.receivedDate3 ?? "";
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
