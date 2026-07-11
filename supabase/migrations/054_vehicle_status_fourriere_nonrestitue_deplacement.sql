-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 054
-- Trois nouvelles raisons d'immobilisation, posées manuellement :
--   · fourriere        : véhicule en fourrière
--   · non_restitue     : véhicule non restitué par le client
--   · deplacement_pro  : véhicule utilisé pour un déplacement professionnel
-- Elles rejoignent le compteur « Immobilisés » du tableau de bord et la page
-- /vehicles/immobilises. Aucune n'est pilotée par les réservations (comme
-- immobilise / hors_service) → recomputeVehicleStatus ne les écrase pas.
-- À exécuter dans le SQL Editor du projet Supabase vtxoqybfqdauhblavvza.
-- ═══════════════════════════════════════════════════════

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check
  CHECK (status IN ('disponible','loue','reserve','maintenance','hors_service',
                    'en_verification','immobilise','mis_a_disposition','a_reparer',
                    'fourriere','non_restitue','deplacement_pro'));
