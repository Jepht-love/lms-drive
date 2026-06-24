-- Migration 024 — Calendrier opérationnel multi-ressources
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Distinct de la table `tasks` existante (migration 003, vue Kanban simple sur
-- /calendar/tasks) : calendar_events porte un intervalle start_at/end_at et
-- alimente la vue grille multi-ressources /calendrier. Les deux coexistent.
-- Adapté au schéma réel (pas celui d'un prompt générique) :
--   - reservation_id → reservations(id)  (il n'existe pas de table "rentals")
--   - assigned_to/created_by → profiles(id), jamais auth.users(id) directement
--   - statuts/types en TEXT CHECK, pas d'ENUM Postgres (convention du projet)
--   - rôles via get_user_role() existant (gerant/associe), pas 'admin'/'manager'

-- Équipes/groupes assignables (en plus des collaborateurs individuels) —
-- ajouté après retour visuel de l'utilisateur sur un exemple de référence.
CREATE TABLE IF NOT EXISTS calendar_teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'reservation', 'depart_vehicule', 'retour_vehicule',
    'rdv_client', 'rdv_garage', 'livraison', 'recuperation',
    'tache', 'disponibilite'
  )),
  status          TEXT NOT NULL DEFAULT 'a_faire' CHECK (status IN (
    'a_faire', 'en_cours', 'termine', 'reporte', 'annule'
  )),
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  all_day         BOOLEAN DEFAULT FALSE,
  -- Liaisons optionnelles vers données métier
  reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
  vehicle_id      UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
  -- Assignation : à une personne OU à une équipe
  assigned_to     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_team_id UUID REFERENCES calendar_teams(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Options
  color_override  TEXT,    -- hex optionnel pour surcharge couleur
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Alertes automatiques (génération câblée en CalB)
CREATE TABLE IF NOT EXISTS calendar_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  alert_type   TEXT NOT NULL,
  trigger_at   TIMESTAMPTZ NOT NULL,
  sent         BOOLEAN DEFAULT FALSE,
  dismissed    BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Préférences vue par utilisateur
CREATE TABLE IF NOT EXISTS calendar_user_preferences (
  user_id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  default_view         TEXT DEFAULT 'week_5d' CHECK (default_view IN ('day', 'week_5d', 'week_7d', 'month')),
  visible_resource_ids UUID[],
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_calendar_events_start    ON calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned ON calendar_events(assigned_to);
CREATE INDEX IF NOT EXISTS idx_calendar_events_team     ON calendar_events(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type     ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_alerts_trigger  ON calendar_alerts(trigger_at) WHERE NOT dismissed;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_calendar_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trigger_calendar_events_updated ON calendar_events;
CREATE TRIGGER trigger_calendar_events_updated
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

DROP TRIGGER IF EXISTS trigger_calendar_teams_updated ON calendar_teams;
CREATE TRIGGER trigger_calendar_teams_updated
  BEFORE UPDATE ON calendar_teams
  FOR EACH ROW EXECUTE FUNCTION update_calendar_updated_at();

-- RLS
ALTER TABLE calendar_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_user_preferences ENABLE ROW LEVEL SECURITY;

-- calendar_teams : visible de tous les authentifiés, écriture réservée aux managers
CREATE POLICY "calendar_teams_select" ON calendar_teams FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "calendar_teams_write" ON calendar_teams FOR ALL
  USING (get_user_role() IN ('gerant', 'associe'));

-- calendar_events : même structure que la table tasks existante (003)
CREATE POLICY "calendar_events_select" ON calendar_events FOR SELECT
  USING (assigned_to = auth.uid() OR get_user_role() IN ('gerant', 'associe'));

CREATE POLICY "calendar_events_insert" ON calendar_events FOR INSERT
  WITH CHECK (get_user_role() IN ('gerant', 'associe'));

CREATE POLICY "calendar_events_update" ON calendar_events FOR UPDATE
  USING (assigned_to = auth.uid() OR get_user_role() IN ('gerant', 'associe'));

CREATE POLICY "calendar_events_delete" ON calendar_events FOR DELETE
  USING (get_user_role() IN ('gerant', 'associe'));

-- calendar_alerts : visibles/modifiables par le destinataire de l'événement ou un manager
CREATE POLICY "calendar_alerts_select" ON calendar_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events e
      WHERE e.id = event_id
      AND (e.assigned_to = auth.uid() OR get_user_role() IN ('gerant', 'associe'))
    )
  );

CREATE POLICY "calendar_alerts_update" ON calendar_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events e
      WHERE e.id = event_id
      AND (e.assigned_to = auth.uid() OR get_user_role() IN ('gerant', 'associe'))
    )
  );

-- calendar_user_preferences : chaque utilisateur gère les siennes
CREATE POLICY "calendar_prefs_own" ON calendar_user_preferences FOR ALL
  USING (user_id = auth.uid());
