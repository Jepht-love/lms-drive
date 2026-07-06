-- Migration 051 — Planification des déplacements internes
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Objectif : passer d'un modèle 100 % "temps réel" (Démarrer maintenant → Terminer)
-- à un modèle qui autorise aussi la PLANIFICATION :
--   • planifier un déplacement pour une date future,
--   • le laisser NON ASSIGNÉ ou l'affecter à un collaborateur,
--   • suivre un statut explicite (planifié / en cours / terminé / annulé).
--
-- Le gérant et les associés peuvent planifier/assigner pour n'importe qui
-- (eux-mêmes ET les salariés) ; un employé ne gère que ses propres déplacements.

-- 1) Un déplacement planifié n'a pas encore de conducteur ni de km de départ.
ALTER TABLE internal_trips ALTER COLUMN user_id  DROP NOT NULL;
ALTER TABLE internal_trips ALTER COLUMN km_start DROP NOT NULL;

-- 2) Statut explicite du cycle de vie du déplacement.
ALTER TABLE internal_trips
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planifie'
  CHECK (status IN ('planifie', 'en_cours', 'termine', 'annule'));

-- 3) Backfill : toutes les lignes existantes ont été créées via "Démarrer"
--    (donc jamais planifiées). On déduit leur statut de end_datetime.
UPDATE internal_trips
SET status = CASE WHEN end_datetime IS NOT NULL THEN 'termine' ELSE 'en_cours' END;

CREATE INDEX IF NOT EXISTS idx_internal_trips_status ON internal_trips(status);

-- 4) RLS : le gérant ET les associés gèrent tous les déplacements (planifier /
--    assigner / laisser non assigné) ; l'employé reste limité aux siens.
--    (WITH CHECK explicite pour couvrir les INSERT de déplacements non assignés,
--     dont user_id IS NULL, réservés aux managers.)
DROP POLICY IF EXISTS "trips_own" ON internal_trips;
CREATE POLICY "trips_own" ON internal_trips FOR ALL
  USING      (user_id = auth.uid() OR get_user_role() IN ('gerant', 'associe'))
  WITH CHECK (user_id = auth.uid() OR get_user_role() IN ('gerant', 'associe'));
