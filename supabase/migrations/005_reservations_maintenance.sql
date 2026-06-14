-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 005 (SESSION 2)
-- Frais retard / km sup · Paiement · Entretien
--
-- NOTE : le « Bloc 3 » du prompt SESSION 2 (clients) est
-- volontairement OMIS — les colonnes demandées existent déjà
-- sous d'autres noms dans 001_initial_schema.sql :
--   satisfaction_rating  → clients.rating
--   internal_flags[]     → clients.status (enum) + blacklist_reason
--   documents JSONB      → clients.*_path (id_doc/license front/back)
-- Les recréer ferait des doublons et casserait la cohérence.
-- ═══════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────
-- BLOC 1 — Frais de retard & kilomètres supplémentaires
-- ───────────────────────────────────────────────────────
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS late_minutes       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_amount    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_km_count     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_km_amount    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount       NUMERIC;

-- ───────────────────────────────────────────────────────
-- BLOC 2 — Paiement (la fiche client référence déjà payment_status)
-- ───────────────────────────────────────────────────────
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_ref    TEXT;

-- ───────────────────────────────────────────────────────
-- ENTRETIEN — Historique des interventions par véhicule (B2)
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_records (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id         UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  type               TEXT NOT NULL,
  description        TEXT,
  date               DATE NOT NULL,
  km_at_intervention INTEGER,
  amount             NUMERIC DEFAULT 0,
  provider           TEXT,
  invoice_url        TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_date    ON maintenance_records(date DESC);

-- ───────────────────────────────────────────────────────
-- VEHICLES — date du dernier lavage (alerte « lavage avant location », B1)
-- ───────────────────────────────────────────────────────
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS last_wash_date DATE;
