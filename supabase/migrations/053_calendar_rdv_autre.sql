-- Migration 053 — Type d'événement calendrier « RDV autre »
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Ajoute le type « rdv_autre » : un rendez-vous générique dont le titre est
-- saisi librement à la création puis modifiable ensuite (tiroir calendrier).
-- Sans cette contrainte à jour, l'INSERT d'un événement « RDV autre » est
-- rejeté par le CHECK et la sauvegarde échoue.
--
-- La liste reprend à l'identique celle en vigueur (migration 038) + rdv_autre :
-- aucun type existant n'est retiré (on ne casse aucun événement déjà en base).

ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_type_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IN (
    'reservation', 'depart_vehicule', 'retour_vehicule',
    'rdv_client', 'rdv_garage', 'rdv_autre',
    'livraison', 'recuperation',
    'tache', 'disponibilite', 'deplacement_interne'
  ));
