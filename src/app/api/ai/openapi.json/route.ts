import type { NextRequest } from "next/server";
import { AI_VIEWS } from "@/lib/ai-api";

export const dynamic = "force-dynamic";

// OpenAPI description of the read-only AI API, in the format ChatGPT "GPT
// Actions" imports ("Import from URL"). Deliberately public: it contains no
// data, only the endpoint shapes and view names — the endpoints it describes
// still require the API key, which is entered in the GPT's Authentication
// settings, never in this file.
export async function GET(request: NextRequest) {
  const viewNames = Object.keys(AI_VIEWS);

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Koonway OS — Read-only data API",
      description:
        "อ่านข้อมูลธุรกิจของ Koonway/WALLPOD แบบอ่านอย่างเดียว (ยอดขาย งาน กำไร ลูกหนี้ สต๊อก กิจกรรมการขาย) ไม่สามารถแก้ไขหรือลบข้อมูลได้",
      version: "1.0.0",
    },
    servers: [{ url: request.nextUrl.origin }],
    paths: {
      "/api/ai": {
        get: {
          operationId: "getCatalog",
          summary: "ดูรายการ view ทั้งหมด พร้อมความหมายและคอลัมน์ของแต่ละ view",
          description: "เรียกอันนี้ก่อนเสมอ เพื่อรู้ว่ามี view อะไร คอลัมน์ไหนหมายถึงอะไร และ view ไหนกรองวันที่ได้",
          responses: { "200": { description: "รายการ view และคอลัมน์" } },
        },
      },
      "/api/ai/{view}": {
        get: {
          operationId: "getView",
          summary: "อ่านข้อมูลจาก view ที่เลือก",
          description:
            "คืนข้อมูลเป็นแถวๆ เรียงจากใหม่ไปเก่า ถ้า hasMore เป็น true ให้เรียกซ้ำโดยเพิ่ม offset เพื่อดึงหน้าถัดไป",
          parameters: [
            { name: "view", in: "path", required: true, schema: { type: "string", enum: viewNames } },
            {
              name: "from",
              in: "query",
              required: false,
              description: "วันที่เริ่มต้น YYYY-MM-DD (ใช้ไม่ได้กับ inventory)",
              schema: { type: "string", format: "date" },
            },
            {
              name: "to",
              in: "query",
              required: false,
              description: "วันที่สิ้นสุด YYYY-MM-DD (ใช้ไม่ได้กับ inventory)",
              schema: { type: "string", format: "date" },
            },
            {
              name: "limit",
              in: "query",
              required: false,
              description: "จำนวนแถวสูงสุดต่อครั้ง (แนะนำไม่เกิน 100 เพื่อให้ตอบเร็ว)",
              schema: { type: "integer", minimum: 1, maximum: 5000, default: 100 },
            },
            {
              name: "offset",
              in: "query",
              required: false,
              description: "ข้ามกี่แถวแรก ใช้ดึงหน้าถัดไป",
              schema: { type: "integer", minimum: 0, default: 0 },
            },
          ],
          responses: { "200": { description: "ข้อมูลแถวของ view พร้อม total, hasMore" } },
        },
      },
    },
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
    },
    security: [{ bearerAuth: [] }],
  };

  return new Response(JSON.stringify(spec), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
