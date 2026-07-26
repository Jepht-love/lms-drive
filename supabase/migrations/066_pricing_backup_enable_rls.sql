-- ═══════════════════════════════════════════════════════
-- 066 — Verrouillage de la table de sauvegarde des tarifs
--
-- La migration 064 a créé `vehicles_pricing_backup_064` (copie des tarifs
-- avant application de la grille 2026) sans activer les règles d'accès.
-- Conséquence : la grille tarifaire complète — plaques, modèles, prix
-- jour/week-end/semaine et montants de caution — était lisible par
-- n'importe qui avec la clé publique, celle qui part dans le navigateur.
--
-- Aucun code applicatif ne lit cette table : c'est une pièce de rollback.
-- On active donc RLS SANS aucune policy → seule la clé serveur y accède.
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.vehicles_pricing_backup_064 ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.vehicles_pricing_backup_064 IS
  'Sauvegarde des tarifs avant la grille 2026 (migration 064). Lecture serveur uniquement (RLS active, aucune policy).';
