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
CREATE TRIGGER IF NOT EXISTS set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
