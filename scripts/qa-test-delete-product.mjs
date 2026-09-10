import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
const ANON_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a disposable test product + a movement against it, then a disposable owner
// account, then try deleting it exactly like deleteStockProduct() does.
const { data: product, error: prodErr } = await admin
  .from("stock_products")
  .insert({ name: "QA DELETE TEST PRODUCT", category: "OTHER", unit: "ชิ้น" })
  .select("id")
  .single();
if (prodErr) throw prodErr;
console.log("created test product:", product.id);

await admin.rpc("record_stock_movement", { p_product_id: product.id, p_type: "in", p_qty: 5, p_note: "seed" });

const email = `qa-delete-test-${Date.now()}@example.com`;
const password = crypto.randomBytes(12).toString("hex");
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA Delete Test", role: "owner" });
const ownerClient = createClient(ANON_URL, ANON_KEY);
await ownerClient.auth.signInWithPassword({ email, password });

try {
  // Mirror deleteStockProduct() exactly
  const { data: files } = await ownerClient.storage.from("stock-product-images").list(product.id);
  console.log("storage list result:", files);
  if (files && files.length > 0) {
    const { error: rmErr } = await ownerClient.storage.from("stock-product-images").remove(files.map((f) => `${product.id}/${f.name}`));
    if (rmErr) console.log("storage remove error:", rmErr);
  }

  const { error: delErr, data: delData, count } = await ownerClient.from("stock_products").delete().eq("id", product.id).select();
  console.log("delete error:", delErr);
  console.log("delete result:", delData);

  const { data: check } = await admin.from("stock_products").select("id").eq("id", product.id).maybeSingle();
  console.log("still exists after delete:", !!check);
} finally {
  await admin.from("stock_products").delete().eq("id", product.id);
  await admin.from("profiles").delete().eq("id", created.user.id);
  await admin.auth.admin.deleteUser(created.user.id);
  console.log("cleanup done");
}
