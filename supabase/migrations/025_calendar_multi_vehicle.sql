-- Migration 025 — Multi-véhicules sur calendar_events
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Additive et tolérante : vehicle_id (singulier, migration 024) reste en place
-- pour compatibilité, vehicle_ids (pluriel) devient la colonne de référence côté
-- application. Backfill des lignes déjà créées.

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS vehicle_ids UUID[];

UPDATE calendar_events
SET vehicle_ids = ARRAY[vehicle_id]
WHERE vehicle_id IS NOT NULL AND vehicle_ids IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_vehicle_ids ON calendar_events USING GIN (vehicle_ids);
