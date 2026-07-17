-- Migration 003: allow cancelling (soft, reversible) a project sale.
-- Deletion needs no schema change — project_items/project_costs/payments already
-- have "on delete cascade" on project_id, so deleting the projects row is enough.
-- Run this once in Supabase Studio > SQL Editor on the existing WALLPOD project.

alter table projects add column is_cancelled boolean not null default false;
