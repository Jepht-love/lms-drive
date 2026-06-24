-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 019 : Remise personnalisée client
-- Réduction commerciale accordée à un client (CDC Répertoire client :
-- « Réductions personnalisées / Offres ou avantages accordés »).
-- Appliquée automatiquement au prix des nouvelles réservations.
-- À exécuter dans le SQL Editor du projet Supabase vtxoqybfqdauhblavvza.
-- ═══════════════════════════════════════════════════════

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0
    CHECK (discount_percent >= 0 AND discount_percent <= 100);

COMMENT ON COLUMN clients.discount_percent IS
  'Remise commerciale en %, appliquée automatiquement au tarif des nouvelles réservations. 0 = aucune remise.';
