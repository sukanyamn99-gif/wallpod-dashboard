"use server";

import { revalidatePath } from "next/cache";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getQuotationById } from "@/lib/data/quotations";
import { logActivity } from "@/lib/activity-log";
import type { QuotationPaymentTerm } from "@/lib/types";

const IMAGE_BUCKET = "quotation-item-images";

function num(v: FormDataEntryValue | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

async function generateDocNo(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear() + 543 - 2500).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `QT${yy}${mm}`;

  const { count, error } = await supabase
    .from("quotations")
    .select("id", { count: "exact", head: true })
    .like("doc_no", `${prefix}%`);
  if (error) throw error;

  const seq = String((count ?? 0) + 1).padStart(3, "0");
  return `${prefix}-${seq}`;
}

type ParsedItem = {
  productCode: string | null;
  productName: string;
  thickness: string | null;
  size: string | null;
  color: string | null;
  unitPrice: number;
  discountPercent: number;
  qty: number;
  unit: string;
  netPrice: number;
  totalPrice: number;
  image: File | null;
  removeImage: boolean;
  existingImagePath: string | null;
};

function parseItems(formData: FormData): ParsedItem[] {
  const codes = formData.getAll("item_product_code");
  const productNames = formData.getAll("item_product_name");
  const thicknesses = formData.getAll("item_thickness");
  const sizes = formData.getAll("item_size");
  const colors = formData.getAll("item_color");
  const unitPrices = formData.getAll("item_unit_price");
  const discountPercents = formData.getAll("item_discount_percent");
  const qtys = formData.getAll("item_qty");
  const units = formData.getAll("item_unit");
  const images = formData.getAll("item_image");
  const removeImageFlags = formData.getAll("item_remove_image");
  const existingImagePaths = formData.getAll("item_existing_image_path");

  return productNames
    .map((productName, i) => {
      const unitPrice = num(unitPrices[i]);
      const discountPercent = num(discountPercents[i]);
      const qty = num(qtys[i]) || 1;
      const netPrice = Math.round(unitPrice * (1 - discountPercent / 100) * 100) / 100;
      const image = images[i];
      return {
        productCode: str(codes[i] ?? null),
        productName: String(productName ?? "").trim(),
        thickness: str(thicknesses[i] ?? null),
        size: str(sizes[i] ?? null),
        color: str(colors[i] ?? null),
        unitPrice,
        discountPercent,
        qty,
        unit: str(units[i] ?? null) ?? "Pcs.",
        netPrice,
        totalPrice: Math.round(netPrice * qty * 100) / 100,
        image: image instanceof File && image.size > 0 ? image : null,
        removeImage: String(removeImageFlags[i] ?? "") === "true",
        existingImagePath: str(existingImagePaths[i] ?? null),
      };
    })
    .filter((it) => it.productName);
}

function parsePaymentTerms(formData: FormData, grandTotal: number): QuotationPaymentTerm[] {
  const labels = formData.getAll("term_label");
  const percents = formData.getAll("term_percent");
  return labels
    .map((label, i) => {
      const percent = num(percents[i]);
      return {
        label: String(label ?? "").trim(),
        percent,
        amount: Math.round(((grandTotal * percent) / 100) * 100) / 100,
      };
    })
    .filter((t) => t.label && t.percent > 0);
}

function parseHeader(formData: FormData) {
  return {
    quoteDate: str(formData.get("quote_date")) ?? new Date().toISOString().slice(0, 10),
    projectName: str(formData.get("project_name")),
    attn: str(formData.get("attn")),
    customerName: str(formData.get("customer_name")),
    customerAddress: str(formData.get("customer_address")),
    customerTel: str(formData.get("customer_tel")),
    customerTaxId: str(formData.get("customer_tax_id")),
    jobNumber: str(formData.get("job_number")),
    poNumber: str(formData.get("po_number")),
    deliveryDate: str(formData.get("delivery_date")),
    priceValidity: str(formData.get("price_validity")),
    remark: str(formData.get("remark")),
    salesRepId: str(formData.get("sales_rep_id")),
  };
}

async function uploadItemImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quotationId: string,
  file: File,
): Promise<string | null> {
  const path = `${quotationId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: "image/jpeg" });
  return error ? null : path;
}

export async function createQuotation(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const header = parseHeader(formData);
  if (!header.projectName) return { error: "กรุณากรอกชื่อโครงการ" };
  if (!header.customerName) return { error: "กรุณากรอกชื่อลูกค้า" };

  const items = parseItems(formData);
  if (items.length === 0) return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };

  const preVat = items.reduce((sum, it) => sum + it.totalPrice, 0);
  const vat = Math.round(preVat * 0.07 * 100) / 100;
  const grandTotal = Math.round((preVat + vat) * 100) / 100;
  const paymentTerms = parsePaymentTerms(formData, grandTotal);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const docNo = await generateDocNo(supabase);

  const { data: quotation, error: insertErr } = await supabase
    .from("quotations")
    .insert({
      doc_no: docNo,
      quote_date: header.quoteDate,
      project_name: header.projectName,
      attn: header.attn,
      customer_name: header.customerName,
      customer_address: header.customerAddress,
      customer_tel: header.customerTel,
      customer_tax_id: header.customerTaxId,
      job_number: header.jobNumber,
      po_number: header.poNumber,
      delivery_date: header.deliveryDate,
      price_validity: header.priceValidity,
      remark: header.remark,
      payment_terms: paymentTerms,
      pre_vat: Math.round(preVat * 100) / 100,
      vat,
      sales_rep_id: header.salesRepId,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let imagePath: string | null = null;
    if (it.image) imagePath = await uploadItemImage(supabase, quotation.id, it.image);

    const { error: itemErr } = await supabase.from("quotation_items").insert({
      quotation_id: quotation.id,
      sort_order: i,
      product_code: it.productCode,
      product_name: it.productName,
      thickness: it.thickness,
      size: it.size,
      color: it.color,
      image_path: imagePath,
      unit_price: it.unitPrice,
      discount_percent: it.discountPercent,
      net_price: it.netPrice,
      qty: it.qty,
      unit: it.unit,
      total_price: it.totalPrice,
    });
    if (itemErr) return { error: `บันทึกใบเสนอราคาสำเร็จ แต่บันทึกรายการสินค้าไม่สำเร็จ: ${itemErr.message}` };
  }

  revalidatePath("/dashboard/quotations");
  return { error: null };
}

export async function updateQuotation(id: string, formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const existing = await getQuotationById(id);
  if (!existing) return { error: "ไม่พบใบเสนอราคานี้ในระบบ" };

  const header = parseHeader(formData);
  if (!header.projectName) return { error: "กรุณากรอกชื่อโครงการ" };
  if (!header.customerName) return { error: "กรุณากรอกชื่อลูกค้า" };

  const items = parseItems(formData);
  if (items.length === 0) return { error: "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ" };

  const preVat = items.reduce((sum, it) => sum + it.totalPrice, 0);
  const vat = Math.round(preVat * 0.07 * 100) / 100;
  const grandTotal = Math.round((preVat + vat) * 100) / 100;
  const paymentTerms = parsePaymentTerms(formData, grandTotal);

  const supabase = await createClient();

  const { error: updateErr } = await supabase
    .from("quotations")
    .update({
      quote_date: header.quoteDate,
      project_name: header.projectName,
      attn: header.attn,
      customer_name: header.customerName,
      customer_address: header.customerAddress,
      customer_tel: header.customerTel,
      customer_tax_id: header.customerTaxId,
      job_number: header.jobNumber,
      po_number: header.poNumber,
      delivery_date: header.deliveryDate,
      price_validity: header.priceValidity,
      remark: header.remark,
      payment_terms: paymentTerms,
      pre_vat: Math.round(preVat * 100) / 100,
      vat,
      sales_rep_id: header.salesRepId,
    })
    .eq("id", id);
  if (updateErr) return { error: updateErr.message };

  // Best-effort: remove Storage objects for images the user explicitly
  // cleared or replaced, before the old item rows are deleted below.
  const survivingPaths = new Set(
    items.filter((it) => it.existingImagePath && !it.removeImage && !it.image).map((it) => it.existingImagePath as string),
  );
  const pathsToDelete = existing.items
    .map((it) => it.imagePath)
    .filter((p): p is string => !!p && !survivingPaths.has(p));
  if (pathsToDelete.length > 0) await supabase.storage.from(IMAGE_BUCKET).remove(pathsToDelete);

  const { error: deleteItemsErr } = await supabase.from("quotation_items").delete().eq("quotation_id", id);
  if (deleteItemsErr) {
    return { error: `แก้ไขข้อมูลทั่วไปสำเร็จ แต่แก้ไขรายการสินค้าไม่สำเร็จ: ${deleteItemsErr.message}` };
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let imagePath: string | null = it.removeImage ? null : it.existingImagePath;
    if (it.image) imagePath = await uploadItemImage(supabase, id, it.image);

    const { error: itemErr } = await supabase.from("quotation_items").insert({
      quotation_id: id,
      sort_order: i,
      product_code: it.productCode,
      product_name: it.productName,
      thickness: it.thickness,
      size: it.size,
      color: it.color,
      image_path: imagePath,
      unit_price: it.unitPrice,
      discount_percent: it.discountPercent,
      net_price: it.netPrice,
      qty: it.qty,
      unit: it.unit,
      total_price: it.totalPrice,
    });
    if (itemErr) return { error: `แก้ไขรายการสินค้าไม่สำเร็จ: ${itemErr.message}` };
  }

  revalidatePath("/dashboard/quotations");
  revalidatePath(`/dashboard/quotations/edit/${id}`);
  revalidatePath(`/dashboard/quotations/view/${id}`);
  return { error: null };
}

export async function updateQuotationStatus(id: string, status: "รอตอบรับ" | "ลูกค้าตอบตกลง" | "ปฏิเสธ") {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถบันทึกได้ในโหมดทดลอง" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/quotations");
  revalidatePath(`/dashboard/quotations/view/${id}`);
  return { error: null };
}

export async function deleteQuotation(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถลบได้ในโหมดทดลอง" };
  }

  const existing = await getQuotationById(id);
  if (!existing) return { error: "ไม่พบใบเสนอราคานี้ในระบบ" };

  const supabase = await createClient();

  const imagePaths = existing.items.map((it) => it.imagePath).filter((p): p is string => !!p);
  if (imagePaths.length > 0) await supabase.storage.from(IMAGE_BUCKET).remove(imagePaths);

  const { error } = await supabase.from("quotations").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity("ลบใบเสนอราคา", existing.docNo);
  revalidatePath("/dashboard/quotations");
  return { error: null };
}

// Marks the quote accepted; the caller then navigates to
// /dashboard/project-sales/new?fromQuotation={id}, which reads this
// quotation server-side and prefills the create form (customer/project
// name/items) via the same field shape edit mode already uses.
export async function convertQuotationToProjectSale(id: string) {
  if (!isSupabaseConfigured()) {
    return { error: "ยังไม่ได้ตั้งค่า Supabase — ไม่สามารถแปลงได้ในโหมดทดลอง" };
  }

  const quotation = await getQuotationById(id);
  if (!quotation) return { error: "ไม่พบใบเสนอราคานี้ในระบบ" };

  const result = await updateQuotationStatus(id, "ลูกค้าตอบตกลง");
  if (result.error) return { error: result.error };

  return { error: null };
}
