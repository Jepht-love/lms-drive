-- Migration 030 — Échéances comptables (paiements à venir)
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Distinct de financial_transactions (mouvements déjà réalisés) : une échéance
-- est une obligation/attente FUTURE (facture fournisseur à régler, paiement
-- client attendu...). Marquer une échéance payée crée la transaction réelle
-- correspondante (lib/actions/dueDates.ts:markDuePaid) plutôt que de dupliquer
-- la logique de saisie comptable.

CREATE TABLE IF NOT EXISTS financial_due_dates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('recette', 'depense')),
  category    TEXT NOT NULL,
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  due_date    DATE NOT NULL,
  vehicle_id  UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  is_paid     BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at     TIMESTAMPTZ,
  transaction_id UUID REFERENCES financial_transactions(id) ON DELETE SET NULL,
  notes       TEXT,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_due_dates_due ON financial_due_dates(due_date) WHERE NOT is_paid;

ALTER TABLE financial_due_dates ENABLE ROW LEVEL SECURITY;

-- Même périmètre d'accès que financial_transactions : gérant/associé uniquement.
CREATE POLICY "financial_due_dates_all" ON financial_due_dates FOR ALL
  USING (get_user_role() IN ('gerant', 'associe'));
