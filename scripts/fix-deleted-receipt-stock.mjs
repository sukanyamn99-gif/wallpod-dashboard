import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// One-time manual correction: goods receipt RI6908002 was deleted by the
// user, but per this app's established "delete never reverses stock"
// convention (Phase 19), its 159-unit contribution to 002-BONE's
// quantity_on_hand and its stock_product_lots row were left in place. User
// explicitly confirmed they want that 159 removed now. This is a direct,
// audited correction — not exercising the RPC's permission check (which,
// under a service-role call with no auth.uid(), has the same NULL-bypass
// gap already flagged elsewhere in this app and not something to lean on).

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

const PRODUCT_ID = "4d596fc5-3eb8-4ab6-8052-1222d9eb3df0"; // 002-BONE (GP-07)
const LOT_REFERENCE = "RI6908002";
const CORRECTION_QTY = 159;

const { data: before } = await admin.from("stock_products").select("quantity_on_hand").eq("id", PRODUCT_ID).single();
console.log("before:", before);

const { data: lotBefore } = await admin
  .from("stock_product_lots")
  .select("*")
  .eq("stock_product_id", PRODUCT_ID)
  .eq("reference_no", LOT_REFERENCE)
  .single();
console.log("lot before:", lotBefore);

if (Number(lotBefore.quantity_remaining) !== CORRECTION_QTY) {
  throw new Error(`Safety check failed: expected lot remaining ${CORRECTION_QTY}, got ${lotBefore.quantity_remaining}. Aborting.`);
}

const newQuantityOnHand = Number(before.quantity_on_hand) - CORRECTION_QTY;

const { error: movementErr } = await admin.from("stock_movements").insert({
  stock_product_id: PRODUCT_ID,
  movement_type: "out",
  quantity: CORRECTION_QTY,
  note: `แก้ไขข้อมูล: ลบสต็อกที่ค้างจากใบรับสินค้า ${LOT_REFERENCE} ซึ่งถูกลบไปแล้ว`,
  balance_before: Number(before.quantity_on_hand),
  balance_after: newQuantityOnHand,
  reference_no: null,
});
if (movementErr) throw movementErr;
console.log("movement record inserted.");

const { error: prodErr } = await admin
  .from("stock_products")
  .update({ quantity_on_hand: newQuantityOnHand, updated_at: new Date().toISOString() })
  .eq("id", PRODUCT_ID);
if (prodErr) throw prodErr;
console.log("stock_products.quantity_on_hand updated:", before.quantity_on_hand, "->", newQuantityOnHand);

const { error: lotErr } = await admin
  .from("stock_product_lots")
  .update({ quantity_remaining: 0 })
  .eq("id", lotBefore.id);
if (lotErr) throw lotErr;
console.log("lot", LOT_REFERENCE, "quantity_remaining set to 0");

const { data: after } = await admin.from("stock_products").select("quantity_on_hand").eq("id", PRODUCT_ID).single();
const { data: lotsAfter } = await admin.from("stock_product_lots").select("*").eq("stock_product_id", PRODUCT_ID).gt("quantity_remaining", 0);
console.log("\nafter: quantity_on_hand =", after.quantity_on_hand);
console.log("remaining visible lots:", lotsAfter);
