-- Lets a payments row remember which quotation it was auto-created from,
-- so a second/third document (tax invoice -> billing note -> receipt) that
-- bundles the SAME quotation-sourced item can find and update that SAME
-- installment instead of scattering across separate installment slots.
alter table payments add column source_quotation_id uuid references quotations(id) on delete set null;
