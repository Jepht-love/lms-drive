-- Migration 029 — Compléments fiche technique véhicule
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Trois champs présents dans le cahier des charges mais absents du schéma :
--   - engine_power      : puissance moteur (ch), distincte de fiscal_power (CV fiscaux)
--   - rental_start_date : date de mise en location commerciale
--   - current_fuel_range_km : niveau carburant actuel, même unité que les EDL
--     (inspections.fuel_range_km — km d'autonomie restante, pas un % ou une jauge
--     0-8) afin de rester cohérent avec la convention déjà en place depuis la
--     migration 021 ; mis à jour automatiquement à chaque état des lieux.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_power INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rental_start_date DATE;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_fuel_range_km INTEGER;
