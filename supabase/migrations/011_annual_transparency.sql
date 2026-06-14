-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 011 (SESSION 7)
-- Clôture annuelle
-- (is_transparent existe déjà sur financial_transactions — migration 010)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS annual_closings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year           INTEGER NOT NULL UNIQUE,
  total_revenue  NUMERIC DEFAULT 0,
  total_expenses NUMERIC DEFAULT 0,
  net_profit     NUMERIC GENERATED ALWAYS AS (total_revenue - total_expenses) STORED,
  is_closed      BOOLEAN DEFAULT false,
  closed_at      TIMESTAMPTZ,
  closed_by      UUID,
  snapshot       JSONB DEFAULT '{}'
);

ALTER TABLE annual_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annual_managers" ON annual_closings FOR ALL USING (get_user_role() IN ('gerant','associe'));
