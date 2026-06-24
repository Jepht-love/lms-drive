-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 018 : RLS sur campaigns
-- La table campaigns (014) n'avait aucune RLS → lecture/écriture
-- ouverte à tout utilisateur authentifié. On la restreint aux
-- gérants/associés, cohérent avec clients/reservations/contracts.
-- À exécuter dans le SQL Editor du projet Supabase vtxoqybfqdauhblavvza.
-- ═══════════════════════════════════════════════════════

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_managers" ON campaigns;
CREATE POLICY "campaigns_managers" ON campaigns FOR ALL
  USING (get_user_role() IN ('gerant', 'associe'));
