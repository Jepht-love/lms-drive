-- Préférences de notifications push par utilisateur
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id                       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  departure_alert               BOOLEAN   DEFAULT true,
  return_alert                  BOOLEAN   DEFAULT true,
  late_return_alert             BOOLEAN   DEFAULT true,
  new_reservation_alert         BOOLEAN   DEFAULT true,
  new_task_alert                BOOLEAN   DEFAULT true,
  alert_window_start            INTEGER   DEFAULT 7,   -- heure locale (0-23)
  alert_window_end              INTEGER   DEFAULT 22,  -- heure locale (0-23)
  late_return_threshold_minutes INTEGER   DEFAULT 30,
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_own" ON notification_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
