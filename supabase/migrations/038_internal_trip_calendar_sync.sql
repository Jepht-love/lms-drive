-- Migration 038 — Sync Déplacements internes ↔ Calendrier
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- 1) Nouveau event_type pour qu'un déplacement interne (lib/calendar/syncInternalTrip.ts)
--    apparaisse dans le calendrier au nom de l'utilisateur qui l'effectue.
-- 2) Lien retour calendar_events → internal_trips : quand un événement
--    "déplacement_interne" est créé directement depuis le calendrier (et pas
--    depuis la page Déplacements), on crée le trip correspondant et on garde
--    son id ici pour ne jamais le recréer en double.

ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IN (
    'reservation', 'depart_vehicule', 'retour_vehicule',
    'rdv_client', 'rdv_garage', 'livraison', 'recuperation',
    'tache', 'disponibilite', 'deplacement_interne'
  ));

ALTER TABLE internal_trips ADD COLUMN IF NOT EXISTS calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL;
