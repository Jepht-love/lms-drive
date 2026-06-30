-- Migration 041 — Montant des dommages constatés à l'état des lieux de retour
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Même pattern que late_fee_amount / extra_km_amount (migration 005) : calculé
-- et figé à la validation de l'EDL retour (InspectionFlow), puis repris tel
-- quel dans le contrat et le brouillon de facture — pas recalculé à la volée.

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS damage_fee_amount NUMERIC DEFAULT 0;
