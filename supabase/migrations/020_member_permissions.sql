-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 020 : Permissions fines par membre
-- Le gérant définit, à la création/édition d'une fiche membre :
--   · allowed_doc_categories : catégories de documents visibles
--       (NULL = toutes les catégories — rétro-compatible)
--   · can_view_fleet : voir le bloc « Flotte » du tableau de bord
--       (défaut true — accessible, le gérant peut le retirer par membre)
-- S'applique aux rôles restreints (employé/prestataire) ; gérant/associé
-- conservent l'accès complet.
-- À exécuter dans le SQL Editor du projet Supabase vtxoqybfqdauhblavvza.
-- ═══════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS allowed_doc_categories text[],
  ADD COLUMN IF NOT EXISTS can_view_fleet boolean DEFAULT true;

COMMENT ON COLUMN profiles.allowed_doc_categories IS
  'Catégories de documents visibles (entreprise, vehicule, client, partenaire). NULL = toutes.';
COMMENT ON COLUMN profiles.can_view_fleet IS
  'Affiche le bloc Flotte du tableau de bord pour ce membre. Défaut true.';
