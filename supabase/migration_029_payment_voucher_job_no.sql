-- Adds a JOB NO. field to Payment Voucher, matching the same free-text
-- field (with autocomplete against real project job numbers) already used
-- on Stock Requisition and Petty Cash — lets a voucher for, say, contractor
-- install costs be tied back to the job it belongs to.
alter table payment_vouchers add column job_no text;
