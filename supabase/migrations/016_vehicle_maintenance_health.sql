-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 016
-- Suivi maintenance & dégradations
--   · maintenance_flags : dégradations actives par véhicule (badge "Dégradé")
--   · statut "a_reparer" : catégorie manuelle "À réparer" (non auto)
--   · index "dernier entretien par type" pour le moteur d'échéances
-- À exécuter dans le SQL Editor du projet Supabase vtxoqybfqdauhblavvza.
-- ═══════════════════════════════════════════════════════

-- A. Drapeaux de dégradations actives (array JSONB)
--    [{ id, category, label, severity, source, source_id, created_at }]
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS maintenance_flags JSONB DEFAULT '[]'::jsonb;

-- B. Catégorie manuelle "À réparer" — on réétend la contrainte de statut
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check
  CHECK (status IN ('disponible','loue','reserve','maintenance','hors_service',
                    'en_verification','immobilise','mis_a_disposition','a_reparer'));

-- C. Index pour récupérer le dernier entretien par type (vidange / pneus …)
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_type_date
  ON maintenance_records(vehicle_id, type, date DESC);
