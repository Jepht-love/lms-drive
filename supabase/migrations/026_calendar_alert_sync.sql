-- Migration 026 — Lien générique alerte → calendrier
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Les événements "tache" issus d'une alerte (CT, assurance, révision,
-- infraction, sinistre, contrat à signer, tâche en retard, lavage stale...)
-- ne sont pas liés à une réservation comme depart_vehicule/retour_vehicule
-- (reservation_id + event_type). On a donc besoin d'une clé d'idempotence
-- générique : source_key reprend l'id d'alerte applicatif (ex. "ct-<vehicle_id>").

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS source_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_source_key
  ON calendar_events(source_key) WHERE source_key IS NOT NULL;
