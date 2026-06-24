-- Migration 035 — Documents des opérations inter-agences (contrats + EDL)
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Permet de produire un contrat + état des lieux pour les opérations inter-agences :
--  - ENTRANT : le véhicule du partenaire est créé comme véhicule temporaire
--    (is_external) afin de réutiliser tout le flux réservation → contrat → EDL.
--    Archivé (is_active=false) à la clôture, identifié par partner_agency_id.
--  - SORTANT : une convention de mise à disposition est un `contract` détaché de
--    toute réservation (reservation_id devient nullable), rattaché à l'opération
--    via inter_agency_rental_id, distingué du contrat de location par doc_type.

-- Véhicule partenaire temporaire (entrant) — visible dans la flotte mais identifié
ALTER TABLE vehicles  ADD COLUMN IF NOT EXISTS is_external       BOOLEAN DEFAULT FALSE;
ALTER TABLE vehicles  ADD COLUMN IF NOT EXISTS partner_agency_id UUID REFERENCES partner_agencies(id) ON DELETE SET NULL;

-- Contrat détachable d'une réservation (convention sortante) + lien opération + type
ALTER TABLE contracts ALTER COLUMN reservation_id DROP NOT NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS inter_agency_rental_id UUID REFERENCES inter_agency_rentals(id) ON DELETE CASCADE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'location'; -- 'location' | 'convention_ia'

CREATE INDEX IF NOT EXISTS idx_contracts_iar      ON contracts(inter_agency_rental_id) WHERE inter_agency_rental_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_external  ON vehicles(is_external)             WHERE is_external;
