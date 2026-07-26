-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 065 : activer réellement la RLS sur `documents`
-- ═══════════════════════════════════════════════════════
--
-- POURQUOI CETTE MIGRATION EXISTE
--
-- La migration 063 a bien créé les politiques sur `documents`, mais le
-- contrôle en base a montré `relrowsecurity = false` : la RLS n'était PAS
-- activée sur la table. Tant qu'elle ne l'est pas, Postgres ignore
-- totalement les politiques — elles existent mais ne s'appliquent jamais.
-- La table restait donc lisible et modifiable avec la clé anon, qui est
-- publique (elle est embarquée dans le bundle navigateur).
--
-- IMPACT DE L'ACTIVATION : nul pour les utilisateurs connectés.
-- Les 8 politiques présentes autorisent tout utilisateur authentifié
-- (auth.uid() IS NOT NULL) en lecture/insertion, et les managers en plus
-- en modification/suppression. Seul l'accès anonyme est coupé.
--
-- ═══════════════════════════════════════════════════════

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Vérification — doit renvoyer rls_activee = true
SELECT c.relname AS "table", c.relrowsecurity AS rls_activee
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'documents';
