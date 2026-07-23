-- Migration 062 — Créances client (paiements de réservation à recevoir)
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Une créance = une échéance de type 'recette' (financial_due_dates) rattachée
-- à une réservation et à un client. Le service est réputé rendu à la DATE DE
-- LA RÉSERVATION (service_date) ; la créance est soldée une fois l'argent reçu
-- (markDuePaid crée alors la transaction 'recette' réelle, comme aujourd'hui).
-- L'app reste en comptabilité de TRÉSORERIE : la créance est un « à recevoir »
-- suivi à part, elle n'entre au CA qu'à l'encaissement.

ALTER TABLE financial_due_dates
  ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL;

ALTER TABLE financial_due_dates
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Date à laquelle le service est comptablement rattaché (= date de départ de la
-- réservation). Distincte de due_date (échéance de paiement attendue).
ALTER TABLE financial_due_dates
  ADD COLUMN IF NOT EXISTS service_date DATE;

CREATE INDEX IF NOT EXISTS idx_financial_due_dates_reservation
  ON financial_due_dates(reservation_id) WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_due_dates_client
  ON financial_due_dates(client_id) WHERE client_id IS NOT NULL;
