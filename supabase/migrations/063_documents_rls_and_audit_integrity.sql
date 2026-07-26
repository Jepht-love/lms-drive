-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 063 : RLS manquante sur `documents`
--                             + intégrité du journal d'audit
-- À exécuter dans le SQL Editor du projet Supabase vtxoqybfqdauhblavvza.
-- ═══════════════════════════════════════════════════════
--
-- 1) `documents` (créée en 013) n'a JAMAIS eu de Row Level Security. C'est la
--    seule table du schéma dans ce cas (les 34 autres sont couvertes, souvent
--    par une migration ultérieure comme 018 pour campaigns). Sans RLS, la clé
--    anon — publiée dans le bundle du navigateur — donne un accès complet en
--    lecture ET en écriture à toute la table : noms de clients, chemins des
--    pièces d'identité, contrats, factures. Même précédent, même remède que 018.
--
--    Périmètre volontairement identique au comportement actuel de l'app
--    (« tout utilisateur authentifié »), pour ne rien casser : /documents est
--    ouvert aux employés (filtrage par `allowed_doc_categories` côté serveur et
--    par `SENSITIVE_SUBCATEGORIES` côté client), les états des lieux et les
--    incidents insèrent des documents, et la suppression est câblée dans
--    DocumentsClient sans distinction de rôle. Un affinage par rôle au niveau
--    base est possible ensuite — c'est une décision de permissions, pas un
--    correctif de bug.
--
-- 2) `audit_logs` acceptait n'importe quel `user_id` (policy 002 :
--    `WITH CHECK (auth.uid() IS NOT NULL)`), donc un utilisateur authentifié
--    pouvait attribuer une action à un collègue. On force l'auteur à être
--    l'appelant. Aucun impact applicatif : les 48 insertions du code passent
--    toutes `user.id` issu de la session, et les écritures via clé service-role
--    contournent la RLS.
--
-- 3) `sav_tickets` (056) autorisait `WITH CHECK (true)`, donc un `reporter_id`
--    ou `reporter_role` falsifiable. Aucun impact non plus : l'app lit, écrit
--    et met à jour les tickets exclusivement via la clé service-role.

-- ── 1. documents ──────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_read_auth"   ON documents;
DROP POLICY IF EXISTS "documents_insert_auth" ON documents;
DROP POLICY IF EXISTS "documents_update_auth" ON documents;
DROP POLICY IF EXISTS "documents_delete_auth" ON documents;

CREATE POLICY "documents_read_auth" ON documents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "documents_insert_auth" ON documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "documents_update_auth" ON documents FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "documents_delete_auth" ON documents FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ── 2. audit_logs : auteur non falsifiable ────────────────
DROP POLICY IF EXISTS "audit_insert_all" ON audit_logs;
CREATE POLICY "audit_insert_self" ON audit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ── 3. sav_tickets : rapporteur non falsifiable ───────────
DROP POLICY IF EXISTS "sav_insert_any_auth" ON sav_tickets;
CREATE POLICY "sav_insert_self" ON sav_tickets
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
