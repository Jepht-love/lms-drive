-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 010 (SESSION 6)
-- Comptabilité : mouvements + clôtures journalières / mensuelles
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                 DATE NOT NULL,
  type                 TEXT NOT NULL CHECK (type IN ('recette','depense')),
  category             TEXT NOT NULL,
  subcategory          TEXT,
  amount               NUMERIC NOT NULL CHECK (amount > 0),
  vehicle_id           UUID REFERENCES vehicles(id),
  supplier_beneficiary TEXT,
  payment_method       TEXT CHECK (payment_method IN ('especes','virement','carte','cheque','prelevement','autre')),
  reference            TEXT,
  notes                TEXT,
  reservation_id       UUID REFERENCES reservations(id),
  infraction_id        UUID REFERENCES infractions(id),
  accident_id          UUID REFERENCES accidents(id),
  is_transparent       BOOLEAN DEFAULT false,
  created_by           UUID,
  created_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ft_date    ON financial_transactions(date);
CREATE INDEX IF NOT EXISTS idx_ft_type    ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_ft_vehicle ON financial_transactions(vehicle_id);

CREATE TABLE IF NOT EXISTS daily_closings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL UNIQUE,
  total_revenue  NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  net_result     NUMERIC GENERATED ALWAYS AS (total_revenue - total_expenses) STORED,
  is_closed      BOOLEAN DEFAULT false,
  closed_at      TIMESTAMPTZ,
  closed_by      UUID,
  snapshot       JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS monthly_closings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month          INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year           INTEGER NOT NULL,
  total_revenue  NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  net_profit     NUMERIC GENERATED ALWAYS AS (total_revenue - total_expenses) STORED,
  is_closed      BOOLEAN DEFAULT false,
  closed_at      TIMESTAMPTZ,
  closed_by      UUID,
  snapshot       JSONB DEFAULT '{}',
  UNIQUE(month, year)
);

-- RLS — managers (pas de rôle 'comptable' dans ce projet → gérant/associé)
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_closings        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ft_managers"      ON financial_transactions FOR ALL USING (get_user_role() IN ('gerant','associe'));
CREATE POLICY "daily_managers"   ON daily_closings          FOR ALL USING (get_user_role() IN ('gerant','associe'));
CREATE POLICY "monthly_managers" ON monthly_closings        FOR ALL USING (get_user_role() IN ('gerant','associe'));
