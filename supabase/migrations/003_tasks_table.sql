-- Migration 003 — Table des tâches internes LMS Drive
-- Exécuter dans : Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN (
    'lavage', 'preparation', 'rendez_vous_client', 'rendez_vous_garage',
    'livraison', 'recuperation', 'entretien', 'controle_etat_lieux',
    'paiement_caution', 'document_manquant', 'autre'
  )),
  status TEXT DEFAULT 'a_faire' CHECK (
    status IN ('a_faire', 'en_cours', 'termine', 'reporte', 'annule')
  ),
  assigned_to  UUID REFERENCES profiles(id),
  vehicle_id   UUID REFERENCES vehicles(id),
  client_id    UUID REFERENCES clients(id),
  reservation_id UUID REFERENCES reservations(id),
  due_datetime TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  notes        TEXT,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_datetime);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON tasks FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR get_user_role() IN ('gerant', 'associe')
  );

CREATE POLICY "tasks_insert" ON tasks FOR INSERT
  WITH CHECK (get_user_role() IN ('gerant', 'associe'));

CREATE POLICY "tasks_update" ON tasks FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR get_user_role() IN ('gerant', 'associe')
  );

CREATE POLICY "tasks_delete" ON tasks FOR DELETE
  USING (get_user_role() IN ('gerant', 'associe'));

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();
