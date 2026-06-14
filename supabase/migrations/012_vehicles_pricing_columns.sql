-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 012 : Colonnes pricing granulaire + is_smart_fortwo
-- À exécuter dans Supabase SQL Editor (vtxoqybfqdauhblavvza)
-- ═══════════════════════════════════════════════════════

-- 1. Corriger le CHECK de category pour inclure 'sportif'
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_category_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_category_check
  CHECK (category IN ('citadine', 'berline', 'suv', 'utilitaire', 'sportif'));

-- 2. Ajouter les colonnes de pricing granulaire
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS price_day_week      NUMERIC,
  ADD COLUMN IF NOT EXISTS price_day_weekend   NUMERIC,
  ADD COLUMN IF NOT EXISTS price_weekend_full  NUMERIC,
  ADD COLUMN IF NOT EXISTS price_week          NUMERIC,
  ADD COLUMN IF NOT EXISTS km_included_day     INTEGER DEFAULT 200,
  ADD COLUMN IF NOT EXISTS km_included_weekend INTEGER DEFAULT 600,
  ADD COLUMN IF NOT EXISTS km_included_week    INTEGER DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS km_extra_price      NUMERIC DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS is_smart_fortwo     BOOLEAN DEFAULT false;
