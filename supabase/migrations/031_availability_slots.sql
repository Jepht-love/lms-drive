-- Migration 031 — Disponibilités récurrentes des employés/associés
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Distinct de calendar_events.disponibilite (un événement ponctuel) : un
-- créneau hebdomadaire récurrent ("Jean : Lun-Ven 8h-18h"), pas une date
-- précise. day_of_week suit la convention JS Date.getDay() (0=dimanche).

CREATE TABLE IF NOT EXISTS availability_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL CHECK (end_time > start_time),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_availability_user ON availability_slots(user_id);

ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- Visible de tous les authentifiés (pour la vue "qui est dispo") ; modifiable
-- par son titulaire ou un manager (ex. configuration initiale pour un employé).
CREATE POLICY "availability_select" ON availability_slots FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "availability_write" ON availability_slots FOR ALL
  USING (user_id = auth.uid() OR get_user_role() IN ('gerant', 'associe'));
