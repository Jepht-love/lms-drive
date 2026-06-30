-- Migration 042 — Répartition des encaissements par type de paiement à la clôture
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- financial_transactions.payment_method existe déjà (migration 010) et est
-- déjà saisi sur chaque mouvement — il manquait juste un calcul agrégé figé
-- à la clôture (comme total_revenue/total_expenses) pour le faire apparaître
-- sur les pages de clôture jour/mois sans le recalculer après coup.

ALTER TABLE daily_closings   ADD COLUMN IF NOT EXISTS revenue_by_payment_method JSONB DEFAULT '{}'::jsonb;
ALTER TABLE monthly_closings ADD COLUMN IF NOT EXISTS revenue_by_payment_method JSONB DEFAULT '{}'::jsonb;
