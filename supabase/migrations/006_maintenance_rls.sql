-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 006
-- RLS pour maintenance_records (créée en 005 sans policy)
-- Modèle calqué sur la table `incidents` (002_rls_policies.sql)
-- ═══════════════════════════════════════════════════════

ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié
CREATE POLICY "maintenance_read_all" ON maintenance_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Création : tout utilisateur authentifié (un employé peut logguer un lavage)
CREATE POLICY "maintenance_create_all" ON maintenance_records FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Modification / suppression : managers uniquement
CREATE POLICY "maintenance_update_managers" ON maintenance_records FOR UPDATE
  USING (get_user_role() IN ('gerant', 'associe'));
CREATE POLICY "maintenance_delete_managers" ON maintenance_records FOR DELETE
  USING (get_user_role() IN ('gerant', 'associe'));
