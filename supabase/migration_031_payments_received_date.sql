-- Splits "date" into two distinct concepts per installment: the existing
-- paid_date column is being relabeled in the UI from "วันที่รับชำระ" (date
-- received) to "วันที่ออกเอกสาร" (document/invoice issue date) — it keeps
-- its column name to avoid a disruptive rename, but its meaning is now
-- "when the invoice was issued", not "when money arrived". This new
-- column captures the latter, paired with receipt_no (added in
-- migration_030) the same way paid_date is paired with invoice_no.
alter table payments add column received_date date;
