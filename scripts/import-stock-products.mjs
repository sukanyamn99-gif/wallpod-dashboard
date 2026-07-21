import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnv(file) {
  const content = fs.readFileSync(file, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv(path.resolve(process.cwd(), ".env.import.local"));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.import.local");
}

const EXCEL_PATH = process.argv[2];
if (!EXCEL_PATH) throw new Error("Usage: node scripts/import-stock-products.mjs <path-to-xlsx>");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Maps the source system's free-text categories onto this app's fixed enum.
const CATEGORY_MAP = {
  "acoustic felt": "ACOUSHEET",
  "acubox": "ACUBOX",
  "glue": "OTHER",
};

function mapCategory(raw) {
  const key = String(raw ?? "").trim().toLowerCase();
  return CATEGORY_MAP[key] ?? "OTHER";
}

// "แผ่นซับเสียง 1200x2400x9 มม." -> { size: "1200x2400", thickness: "9 มม." }
// Most Description values are delivery notes, not dimensions — only pulls
// size/thickness out when the text actually matches this pattern.
function parseSizeThickness(description) {
  const m = String(description ?? "").match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\s*มม\.?/i);
  if (!m) return { size: null, thickness: null };
  return { size: `${m[1]}x${m[2]}`, thickness: `${m[3]} มม.` };
}

// "18 May 2026" -> ISO timestamp
function parseCreatedDate(raw) {
  const d = new Date(String(raw ?? "").trim());
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const wb = XLSX.readFile(EXCEL_PATH);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
console.log(`Read ${rows.length} rows from ${EXCEL_PATH}`);

let created = 0;
let skipped = 0;

for (const row of rows) {
  const sku = String(row["Product Code"] ?? "").trim() || null;
  const name = String(row["Product Name"] ?? "").trim();
  if (!name) {
    console.warn("Skipping row with no Product Name:", JSON.stringify(row));
    skipped++;
    continue;
  }

  const category = mapCategory(row["Category"]);
  const { size, thickness } = parseSizeThickness(row["Description"]);
  const location = String(row["Storage Location"] ?? "").trim() || null;
  const note = String(row["Description"] ?? "").trim() || null;
  const unit = String(row["Unit"] ?? "").trim() || "ชิ้น";
  const quantity = num(row["Quantity"]);
  const unitCost = num(row["Cost Price"]);
  const reorderPoint = num(row["Min Stock Level"]);
  const createdAt = parseCreatedDate(row["Created"]);

  const { data: product, error: insertErr } = await supabase
    .from("stock_products")
    .insert({
      sku,
      name,
      category,
      size,
      thickness,
      location,
      note,
      unit,
      quantity_on_hand: quantity,
      reorder_point: reorderPoint,
      unit_cost: unitCost,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error(`FAILED to insert "${name}" (${sku}):`, insertErr.message);
    skipped++;
    continue;
  }

  if (quantity > 0) {
    const { error: movementErr } = await supabase.from("stock_movements").insert({
      stock_product_id: product.id,
      movement_type: "in",
      quantity,
      note: "นำเข้าจากระบบเดิม (KOONWAY)",
      created_at: createdAt,
    });
    if (movementErr) {
      console.error(`  (product saved, but movement log failed for "${name}"):`, movementErr.message);
    }
  }

  created++;
}

console.log(`\nDone. Created ${created} products, skipped ${skipped}.`);
