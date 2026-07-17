alter table projects add column production_status text check (production_status in (
  'รอเงินมัดจำ',
  'รออนุมัติแบบ',
  'ทำแบบผลิต (Cutting)',
  'เบิกแผ่น',
  'กำลังผลิต',
  'ผลิตเสร็จ',
  'ส่งของแล้ว',
  'ติดตั้งเสร็จ',
  'รอใบส่งมอบ',
  'จบงาน',
  'เก็บเงินงวดสุดท้าย'
));
