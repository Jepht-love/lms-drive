-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 049 : Avantages commerciaux ciblés
-- Champ texte libre pour les avantages NON chiffrables en % (distinct de
-- discount_percent, migration 019) : « 1 jour offert tous les 10 jours »,
-- « surclassement gratuit », « lavage inclus », etc. Appliqués manuellement
-- au cas par cas, pas automatiquement sur le tarif.
-- À exécuter dans le SQL Editor du projet Supabase vtxoqybfqdauhblavvza.
-- ═══════════════════════════════════════════════════════

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS commercial_perks TEXT;

COMMENT ON COLUMN clients.commercial_perks IS
  'Avantages commerciaux qualitatifs accordés au client (non chiffrables en %). '
  'Complète discount_percent. Appliqués manuellement, pas automatiquement au tarif.';
