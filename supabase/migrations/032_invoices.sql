-- Migration 032 — Facture de restitution normalisée (Phase D)
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Distincte du contrat (qui couvre la location elle-même) : cette facture ne
-- porte que sur les frais complémentaires constatés au retour (retard, km,
-- dommages, frais annexes) — générée en brouillon à la clôture du contrat,
-- éditable, puis envoyée explicitement par email (lib/actions/invoices.ts).
-- line_items JSONB : [{ description, quantity, unit_price, total }]

CREATE TABLE IF NOT EXISTS invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   TEXT NOT NULL UNIQUE,
  contract_id      UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  reservation_id   UUID REFERENCES reservations(id) ON DELETE SET NULL,
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  vehicle_id       UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  line_items       JSONB NOT NULL DEFAULT '[]',
  total_amount     NUMERIC NOT NULL DEFAULT 0,
  pdf_storage_path TEXT,
  sent_at          TIMESTAMPTZ,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_all" ON invoices FOR ALL
  USING (get_user_role() IN ('gerant', 'associe'));
