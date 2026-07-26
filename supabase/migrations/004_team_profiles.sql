-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 004 : enrichissement profiles
-- ═══════════════════════════════════════════════════════

-- Ajouter le rôle prestataire
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('gerant', 'associe', 'employe', 'prestataire'));

-- Nouvelles colonnes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS color     TEXT    DEFAULT '#6366f1';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Trigger updated_at pour profiles
-- NB : `CREATE TRIGGER IF NOT EXISTS` n'existe dans aucune version de PostgreSQL.
-- La ligne d'origine échouait donc systématiquement (SQLSTATE 42601) et ce trigger
-- n'a jamais été créé, y compris en production. Idiome idempotent : voir 024_calendar.sql.
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
