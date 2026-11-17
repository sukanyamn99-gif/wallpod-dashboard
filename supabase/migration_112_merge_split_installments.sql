-- ใบกำกับภาษี / ใบเสร็จ เคยไปลงเป็นงวดที่ 2 แทนที่จะต่อจากงวดที่ 1 ที่ใบวางบิลเปิดไว้
-- (แก้ที่โค้ดแล้วใน billing-documents/actions.ts — ไฟล์นี้แก้ข้อมูลเก่าที่เกิดไปแล้ว)
--
-- รวมงวด "ใบวางบิลอย่างเดียว" เข้ากับงวดถัดไปที่ถือใบกำกับภาษี/ใบเสร็จของใบเสนอราคาเดียวกัน
-- ยอดใกล้เคียงกัน (±15%) แล้วลบงวดที่ซ้ำทิ้ง — โปรเจกต์ที่มีหลายรอบ (เช่น แบ่ง 50/50)
-- ที่ไม่เข้าเงื่อนไขนี้จะไม่ถูกแตะ
--
-- งานที่เข้าเงื่อนไขตอนตรวจ: JB2610211, JB2611246, JB2611247, JB2611248, JB2611249
-- รันซ้ำได้ปลอดภัย (รอบสองจะไม่พบคู่ที่ต้องรวมแล้ว)

do $$
declare
  pair record;
  merged int := 0;
begin
  for pair in
    select distinct on (a.id)
           a.id as keep_id,
           b.id as drop_id,
           pr.job_no
    from payments a
    join payments b
      on b.project_id = a.project_id
     and b.source_quotation_id = a.source_quotation_id
     and b.installment_no > a.installment_no
    join projects pr on pr.id = a.project_id
    where a.billing_note_no is not null
      and a.tax_invoice_no is null
      and a.receipt_no is null
      and b.tax_invoice_no is not null
      and abs(b.amount / nullif(a.amount, 0) - 1) <= 0.15
    order by a.id, b.installment_no
  loop
    -- งวดที่ 1 (keep) รับค่าของใบกำกับภาษี/ใบเสร็จมาจากงวดที่ 2 (drop)
    update payments k set
      tax_invoice_no        = d.tax_invoice_no,
      tax_invoice_date      = d.tax_invoice_date,
      receipt_no            = d.receipt_no,
      received_date         = d.received_date,
      invoice_no            = coalesce(k.invoice_no, d.invoice_no),
      paid_date             = coalesce(k.paid_date, d.paid_date),
      amount                = d.amount,
      wht_amount            = d.wht_amount,
      status                = d.status,
      outstanding_amount    = d.outstanding_amount,
      source_tax_invoice_id = d.source_tax_invoice_id
    from payments d
    where k.id = pair.keep_id
      and d.id = pair.drop_id;

    -- รายการเอกสารที่เคยชี้งวดที่ซ้ำ ให้ชี้งวดที่เก็บไว้แทน
    update billing_note_items set payment_id = pair.keep_id where payment_id = pair.drop_id;

    delete from payments where id = pair.drop_id;

    merged := merged + 1;
    raise notice 'รวมงวดแล้ว: %', pair.job_no;
  end loop;

  raise notice 'รวมงวดทั้งหมด % งาน', merged;
end $$;
