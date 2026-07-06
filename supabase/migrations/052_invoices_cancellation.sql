-- Migration 052 — Annulation des factures
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Une facture ne se supprime pas (traçabilité légale) : on l'annule. On garde la
-- ligne mais on marque cancelled_at/cancelled_by. L'échéance (créance) liée en
-- comptabilité (financial_due_dates.invoice_id) est retirée par l'action serveur
-- cancelInvoice pour désactiver l'impact comptable.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
