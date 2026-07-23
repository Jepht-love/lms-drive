-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 060 : indicateur super-utilisateur
-- ═══════════════════════════════════════════════════════
-- Un admin conserve role='gerant' (tous les contrôles d'accès existants
-- s'appliquent sans modification) ; is_admin le distingue pour l'affichage
-- (badge « Admin »), la protection contre la suppression, et les futures
-- fonctions d'édition live de l'application.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.is_admin IS
  'Super-utilisateur : badge Admin, non supprimable, fonctions d''administration avancées.';
