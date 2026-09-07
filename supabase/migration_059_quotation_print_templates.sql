-- Makes the quotation print view's boilerplate remark notes and the
-- installation prep-conditions checklist editable from the app itself
-- instead of hardcoded in source — one row per quotation_type (ค่าของ /
-- ค่าติดตั้ง). Seeded with exactly the text that was hardcoded before this
-- migration, so nothing changes visually until someone edits it.
create table quotation_print_templates (
  quotation_type text primary key check (quotation_type in ('ค่าของ', 'ค่าติดตั้ง')),
  -- [{ text, tone }], tone in ('normal','red','amber') — the standard
  -- disclaimer lines shown under "Remake : หมายเหตุ :".
  notes jsonb not null default '[]'::jsonb,
  -- The standalone "**สามารถหัก ณ ที่จ่ายได้**" line next to Price Validity.
  show_wht_note boolean not null default false,
  -- [{ heading, underline, items: [{ icon, text }] }], icon in
  -- ('check','person') — the wall/ceiling/materials prep checklist,
  -- printed only when this array is non-empty.
  conditions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table quotation_print_templates enable row level security;

create policy quotation_print_templates_select on quotation_print_templates
  for select using (auth.uid() is not null);
create policy quotation_print_templates_write on quotation_print_templates
  for all using (my_role() in ('owner','manager','support_sale','account'))
  with check (my_role() in ('owner','manager','support_sale','account'));

insert into quotation_print_templates (quotation_type, notes, show_wht_note, conditions) values
(
  'ค่าของ',
  '[
    {"text": "*** ราคาอาจมีการปรับเปลี่ยนตามหน้างานจริง อาจมีการเพิ่มสินค้าให้ครบตามใบสั่งซื้อ **ไม่สามารถหัก ณ ที่จ่ายได้**", "tone": "red"},
    {"text": "*** สินค้าแผ่นเปล่าในเบอร์สีตรงตามผลผลิต อาจมีความคลาดเคลื่อนสีในแต่ละล็อตการผลิต กรุณายืนยันสีในสต็อกปัจจุบันก่อนสั่งซื้อ ***", "tone": "red"},
    {"text": "1-2 สัปดาห์ ทำการหลังจากได้รับการยืนยันการสั่งซื้อและชำระเงินค่ามัดจำ (กรณีมีสีในสต็อก)", "tone": "normal"},
    {"text": "4-5 สัปดาห์ ทำการหลังจากได้รับการยืนยันการสั่งซื้อและชำระเงินค่ามัดจำ (กรณีไม่มีสีในสต็อก)", "tone": "normal"}
  ]'::jsonb,
  false,
  '[]'::jsonb
),
(
  'ค่าติดตั้ง',
  '[
    {"text": "*** ราคาอาจมีการปรับเปลี่ยนตามขนาดหน้างานจริง ***", "tone": "red"},
    {"text": "*** ไม่รวมค่าเข้าอบรมก่อนเข้าทำงาน , ไม่รวมค่า Protection ***", "tone": "amber"},
    {"text": "1-2 สัปดาห์ ทำการหลังจากได้รับการยืนยันการสั่งซื้อและชำระเงินค่ามัดจำ (กรณีมีสีในสต็อก)", "tone": "normal"},
    {"text": "4-5 สัปดาห์ ทำการหลังจากได้รับการยืนยันการสั่งซื้อและชำระเงินค่ามัดจำ (กรณีไม่มีสีในสต็อก)", "tone": "normal"}
  ]'::jsonb,
  true,
  '[
    {
      "heading": "ผนัง การเตรียมพื้นที่ต้องมีมุมฉาก",
      "underline": true,
      "items": [
        {"icon": "check", "text": "ผนังต้องไม่เป็นแอ่ง และลักษณะเรียบพอประมาณ ไม่ถึงขั้นต้องสกิมผนัง"},
        {"icon": "check", "text": "มุมผนัง ผนังทั้ง 2 ด้านที่มาบรรจบกันมุมจะต้องได้ดิ่ง ไม่ได้ลง เพื่อให้รอยต่อแผ่นแนบสนิทตลอดแนว"},
        {"icon": "check", "text": "มุมฝาและผนัง ฝาและผนัง ทั้ง 2 ด้านที่มาบรรจบกันมุม จะต้องได้ระนาบตรง ผนังจะต้องได้ระนาบ เพื่อให้แผ่นต่อกันแนบสนิทตลอดแนว"}
      ]
    },
    {
      "heading": "ฝ้า ต้องเตรียมดังนี้",
      "underline": true,
      "items": [
        {"icon": "check", "text": "มุมฝาและผนัง ฝาและผนัง ทั้ง 2 ด้านที่มาบรรจบกันมุม จะต้องได้ระนาบตรง ไม่ตกท้องช้าง ไม่นูน เพื่อให้แผ่นที่ชนกันต่อแนบสนิทตลอดแนว"},
        {"icon": "check", "text": "หากมีงานระบบที่ฝ้า ควรจะต้องติดตั้งแผ่นซับเสียงก่อนที่จะทำการติดตั้งงานระบบ เพื่อความเรียบร้อยของขอบแผ่นที่ตัดเข้าอุปกรณ์ของงานระบบ"},
        {"icon": "check", "text": "ติดแบบแขวนต้อง มีการเตรียมพื้นที่ทำการติดตั้งโล่งและไม่มีสิ่งกีดขวาง เพื่อความสะดวกในการติดตั้ง"}
      ]
    },
    {
      "heading": "วัสดุที่ใช้ติดตั้ง มี 2 ประเภท คือ สติกเกอร์กาว หรือ การตอกฝา",
      "underline": false,
      "items": [
        {"icon": "person", "text": "ก่อนเข้าติดตั้งต้องมีการทำความสะอาดเก็บฝุ่นออก เช่น งานตัดไม้ งานเจาะหรือขัดปูน งานขัดฝ้า เป็นต้น"},
        {"icon": "check", "text": "พื้นที่ต้องเช็ดทำความสะอาดครบฝุ่นออก ก่อนติดตั้ง"}
      ]
    }
  ]'::jsonb
)
on conflict (quotation_type) do nothing;
