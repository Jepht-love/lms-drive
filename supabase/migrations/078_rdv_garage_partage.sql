-- ─── Le rendez-vous garage devient le passage au garage lui-même ──────────────
--
-- Le problème réglé (remarque 43 de Jeff) : chaque intervention créait SON créneau
-- au calendrier. Deux réparations de types différents sur la même voiture le même
-- jour produisaient deux lignes « 08:00 RDV GARAGE Renault Captur », pour un seul
-- passage réel au garage.
--
-- Ce que ça change : une intervention retient désormais le créneau auquel elle
-- appartient. Plusieurs interventions, et plusieurs véhicules, partagent le même.
--
-- ⚠️ Purement additif. Les interventions déjà en base gardent `calendar_event_id`
-- à NULL : le code retombe alors sur l'ancienne recherche par date et par
-- véhicule, donc rien ne change pour l'historique de LMS Drive.
--
-- `ON DELETE SET NULL` : effacer un créneau au calendrier ne doit jamais effacer
-- l'intervention ni son montant. Le travail existe indépendamment du rendez-vous.

ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS calendar_event_id UUID
    REFERENCES calendar_events(id) ON DELETE SET NULL;

COMMENT ON COLUMN maintenance_records.calendar_event_id IS
  'Le passage au garage auquel appartient cette intervention. Plusieurs interventions et plusieurs véhicules partagent le même créneau (remarque 43, 03/08/2026). NULL sur l''historique d''avant.';

-- Sert à la suppression : « reste-t-il d''autres interventions sur ce créneau ? »
-- est la question posée à chaque fois qu''on en retire une.
CREATE INDEX IF NOT EXISTS idx_maintenance_records_calendar_event
  ON maintenance_records(calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;
