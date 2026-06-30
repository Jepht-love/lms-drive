-- 045 — Règlement des interventions d'entretien / réparation
-- Choix gérant : la dépense comptable n'est créée qu'au RÈGLEMENT (pas à la
-- saisie de l'intervention). Ces deux colonnes tracent le paiement et, via le
-- garde anti-doublon `reference = maintenance:<id>` côté markMaintenancePaid,
-- évitent tout double-booking. Couvre aussi les réparations de sinistre, qui
-- sont déjà matérialisées dans maintenance_records (addAccidentToVehicle).

ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS paid_at     date,
  ADD COLUMN IF NOT EXISTS paid_method text;
