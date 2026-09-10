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
loadEnv(path.resolve(process.cwd(), ".env.local"));

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: receipts } = await admin.from("goods_receipts").select("id, doc_no").in("doc_no", ["RI6908001","RI6908002","RI6908003"]);
console.log("goods_receipts still present:", receipts);

const { data: product } = await admin.from("stock_products").select("id, sku, name, quantity_on_hand, unit_cost").ilike("sku", "%002-BONE%").maybeSingle();
console.log("\nproduct 002-BONE:", product);

if (product) {
  const { data: lots } = await admin.from("stock_product_lots").select("*").eq("stock_product_id", product.id).order("received_at");
  console.log("\nall lots for this product (incl. zeroed):");
  console.log(lots);
}
