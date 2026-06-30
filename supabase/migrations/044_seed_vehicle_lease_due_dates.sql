-- Migration 044 — Échéances de loyer pour Smart, DS3 Crossback, Renault Captur
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Reprend l'échéancier restant (tableaux d'amortissement transmis par le
-- gérant) à partir de la prochaine mensualité non réglée. DS3 et Renault
-- Captur démarrent en juillet (pas juin) pour ne pas faire doublon avec
-- l'échéance "Loyer DS3" à 450€ déjà existante datée du 24/06/2026 — si
-- celle-ci correspond en fait au même loyer, la supprimer manuellement après
-- cette exécution pour éviter de compter le mois de juin deux fois.

-- Smart Fortwo — 620€/mois, 5 mensualités restantes à partir du 06/06/2026
INSERT INTO financial_due_dates (description, type, category, amount, due_date, vehicle_id)
SELECT
  'Loyer Smart (' || n || '/5)',
  'depense',
  'loyer_vehicule',
  620,
  (DATE '2026-06-06' + (n - 1) * INTERVAL '1 month')::date,
  'ce790bb6-dd5c-4a7a-a68d-0cc68b76fc5b'
FROM generate_series(1, 5) AS n;

-- DS3 Crossback — 530,72€/mois, 27 mensualités restantes à partir du 06/07/2026
INSERT INTO financial_due_dates (description, type, category, amount, due_date, vehicle_id)
SELECT
  'Loyer DS3 Crossback (' || n || '/27)',
  'depense',
  'loyer_vehicule',
  530.72,
  (DATE '2026-07-06' + (n - 1) * INTERVAL '1 month')::date,
  '58679ad6-06d1-489c-97ca-9bff5b9d9608'
FROM generate_series(1, 27) AS n;

-- Renault Captur — 560,07€/mois, 32 mensualités restantes à partir du 06/07/2026
INSERT INTO financial_due_dates (description, type, category, amount, due_date, vehicle_id)
SELECT
  'Loyer Renault Captur (' || n || '/32)',
  'depense',
  'loyer_vehicule',
  560.07,
  (DATE '2026-07-06' + (n - 1) * INTERVAL '1 month')::date,
  '791674cd-eddd-4f20-8012-f9599827f8d9'
FROM generate_series(1, 32) AS n;
