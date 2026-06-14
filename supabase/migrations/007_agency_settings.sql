-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 007
-- Réglages agence (singleton) — en-tête contrats + tarifs par défaut
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agency_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name        TEXT NOT NULL DEFAULT 'LMS Agency',
  siret               TEXT DEFAULT '99160973600012',
  address             TEXT,
  phone               TEXT,
  email               TEXT,
  extra_km_rate       NUMERIC DEFAULT 0.30,
  late_hourly_rate    NUMERIC DEFAULT 15,
  late_daily_rate     NUMERIC DEFAULT 80,
  fuel_rate_per_liter NUMERIC DEFAULT 2.20,
  default_deposit     NUMERIC DEFAULT 500,
  insurance_deductible NUMERIC DEFAULT 800,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Singleton : créer la ligne unique si absente
INSERT INTO agency_settings (company_name, siret)
SELECT 'LMS Agency', '99160973600012'
WHERE NOT EXISTS (SELECT 1 FROM agency_settings);

ALTER TABLE agency_settings ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié (le contrat/PDF en a besoin)
CREATE POLICY "agency_read_all" ON agency_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Écriture : gérant uniquement
CREATE POLICY "agency_write_gerant" ON agency_settings FOR ALL
  USING (get_user_role() = 'gerant');
