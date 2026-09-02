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

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log("  PASS " + label); }
  else { fail++; console.error("  FAIL " + label + (extra ? " — " + extra : "")); }
}

async function makeUser(role) {
  const email = "qa-reqedit-" + role + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "@example.com";
  const password = crypto.randomBytes(12).toString("hex");
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ id: created.user.id, full_name: "QA ReqEdit " + role, role });
  const client = createClient(ANON_URL, ANON_KEY);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { client, userId: created.user.id };
}

async function cleanupUser(u) {
  await admin.from("profiles").delete().eq("id", u.userId);
  await admin.auth.admin.deleteUser(u.userId);
}

console.log("Setting up disposable test product + department + users...");
const { data: product, error: productErr } = await admin
  .from("stock_products")
  .insert({ name: "QA REQEDIT PRODUCT", category: "OTHER", unit: "ชิ้น" })
  .select("id")
  .single();
if (productErr) throw productErr;

const { data: dept, error: deptErr } = await admin
  .from("departments")
  .insert({ name: "QA ReqEdit Dept " + Date.now() })
  .select("id")
  .single();
if (deptErr) throw deptErr;

const requester = await makeUser("support_sale"); // can insert requisitions + call record_stock_movement
const otherStaff = await makeUser("support_sale"); // same role, NOT the requester -> should be denied edit
const owner = await makeUser("owner");

let requisitionId = null;

try {
  console.log("\nStep 1: seed product at quantity_on_hand=100 via record_stock_movement('in')...");
  const { error: seedErr } = await owner.client.rpc("record_stock_movement", {
    p_product_id: product.id, p_type: "in", p_qty: 100, p_note: "seed", p_reference: null,
  });
  check("seed succeeds", !seedErr, seedErr && seedErr.message);

  console.log("\nStep 2: requester creates a requisition (header+item) for 10 units, then withdraws via record_stock_movement('out')...");
  const { data: req, error: reqErr } = await requester.client
    .from("stock_requisitions")
    .insert({
      doc_no: "QA-REQEDIT-" + Date.now(),
      department_id: dept.id,
      requested_by: requester.userId,
      purpose: "production",
      note: "qa test",
    })
    .select("id")
    .single();
  check("requester can insert requisition header", !reqErr, reqErr && reqErr.message);
  requisitionId = req?.id ?? null;

  const { error: itemErr } = await requester.client.from("stock_requisition_items").insert({
    requisition_id: requisitionId,
    stock_product_id: product.id,
    product_name_snapshot: "QA REQEDIT PRODUCT",
    product_sku_snapshot: null,
    unit_snapshot: "ชิ้น",
    quantity: 10,
    unit_cost: 0,
  });
  check("requester can insert requisition item", !itemErr, itemErr && itemErr.message);

  const { error: outErr } = await requester.client.rpc("record_stock_movement", {
    p_product_id: product.id, p_type: "out", p_qty: 10, p_note: "withdraw", p_reference: null,
  });
  check("requester can withdraw stock via record_stock_movement", !outErr, outErr && outErr.message);

  let { data: p1 } = await admin.from("stock_products").select("quantity_on_hand").eq("id", product.id).single();
  check("quantity_on_hand is 90 after withdrawing 10", Number(p1.quantity_on_hand) === 90, p1.quantity_on_hand);

  console.log("\nStep 3: a DIFFERENT non-owner staff member is denied editing this requisition (RLS)...");
  const { error: deniedUpdateErr } = await otherStaff.client
    .from("stock_requisitions")
    .update({ note: "hacked" })
    .eq("id", requisitionId);
  const { data: afterDeniedUpdate } = await admin
    .from("stock_requisitions")
    .select("note")
    .eq("id", requisitionId)
    .single();
  check(
    "other staff's update is a no-op (RLS silently filters, note unchanged)",
    afterDeniedUpdate.note === "qa test",
    JSON.stringify({ deniedUpdateErr, afterDeniedUpdate }),
  );

  const { error: deniedDeleteItemsErr } = await otherStaff.client
    .from("stock_requisition_items")
    .delete()
    .eq("requisition_id", requisitionId);
  const { data: itemsAfterDeniedDelete } = await admin
    .from("stock_requisition_items")
    .select("id")
    .eq("requisition_id", requisitionId);
  check(
    "other staff cannot delete requisition items",
    (itemsAfterDeniedDelete ?? []).length === 1,
    JSON.stringify({ deniedDeleteItemsErr, count: itemsAfterDeniedDelete?.length }),
  );

  console.log("\nStep 4: the ORIGINAL requester edits their own requisition — increase quantity 10 -> 16 (delta +6, withdraw more)...");
  const { error: updateHeaderErr } = await requester.client
    .from("stock_requisitions")
    .update({ note: "edited by requester" })
    .eq("id", requisitionId);
  check("requester can update their own requisition header", !updateHeaderErr, updateHeaderErr && updateHeaderErr.message);

  const { error: deleteItemsErr } = await requester.client
    .from("stock_requisition_items")
    .delete()
    .eq("requisition_id", requisitionId);
  check("requester can delete-then-reinsert their own items", !deleteItemsErr, deleteItemsErr && deleteItemsErr.message);

  const { error: reinsertErr } = await requester.client.from("stock_requisition_items").insert({
    requisition_id: requisitionId,
    stock_product_id: product.id,
    product_name_snapshot: "QA REQEDIT PRODUCT",
    product_sku_snapshot: null,
    unit_snapshot: "ชิ้น",
    quantity: 16,
    unit_cost: 0,
  });
  check("requester can reinsert edited item", !reinsertErr, reinsertErr && reinsertErr.message);

  const { error: deltaOutErr } = await requester.client.rpc("record_stock_movement", {
    p_product_id: product.id, p_type: "out", p_qty: 6, p_note: "edit delta +6", p_reference: null,
  });
  check("delta withdrawal (+6) succeeds", !deltaOutErr, deltaOutErr && deltaOutErr.message);

  let { data: p2 } = await admin.from("stock_products").select("quantity_on_hand").eq("id", product.id).single();
  check("quantity_on_hand is 84 after increasing withdrawal by 6 (90-6)", Number(p2.quantity_on_hand) === 84, p2.quantity_on_hand);

  console.log("\nStep 5: edit again — decrease quantity 16 -> 4 (delta -12, give 12 back)...");
  await requester.client.from("stock_requisition_items").delete().eq("requisition_id", requisitionId);
  await requester.client.from("stock_requisition_items").insert({
    requisition_id: requisitionId,
    stock_product_id: product.id,
    product_name_snapshot: "QA REQEDIT PRODUCT",
    product_sku_snapshot: null,
    unit_snapshot: "ชิ้น",
    quantity: 4,
    unit_cost: 0,
  });
  const { error: deltaInErr } = await requester.client.rpc("record_stock_movement", {
    p_product_id: product.id, p_type: "in", p_qty: 12, p_note: "edit delta -12", p_reference: null,
  });
  check("delta return (-12 -> 'in' 12) succeeds", !deltaInErr, deltaInErr && deltaInErr.message);

  let { data: p3 } = await admin.from("stock_products").select("quantity_on_hand").eq("id", product.id).single();
  check("quantity_on_hand is 96 after decreasing withdrawal by 12 (84+12)", Number(p3.quantity_on_hand) === 96, p3.quantity_on_hand);

  console.log("\nStep 6: owner can edit/delete ANY requisition, including this one...");
  const { error: ownerUpdateErr } = await owner.client
    .from("stock_requisitions")
    .update({ note: "edited by owner" })
    .eq("id", requisitionId);
  check("owner can update someone else's requisition", !ownerUpdateErr, ownerUpdateErr && ownerUpdateErr.message);

  const { error: ownerDeleteErr } = await owner.client.from("stock_requisitions").delete().eq("id", requisitionId);
  check("owner can delete someone else's requisition", !ownerDeleteErr, ownerDeleteErr && ownerDeleteErr.message);
  requisitionId = null; // already deleted
} finally {
  console.log("\nCleaning up...");
  if (requisitionId) await admin.from("stock_requisitions").delete().eq("id", requisitionId);
  await admin.from("stock_products").delete().eq("id", product.id);
  await admin.from("departments").delete().eq("id", dept.id);
  await cleanupUser(requester);
  await cleanupUser(otherStaff);
  await cleanupUser(owner);
  console.log("Cleanup done.");
}

console.log("\n=== RESULTS: " + pass + " passed, " + fail + " failed ===");
process.exit(fail > 0 ? 1 : 0);
