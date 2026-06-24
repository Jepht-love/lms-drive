-- Migration 033 — Historique des emails envoyés
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Jusqu'ici les envois (contrat, facture de restitution, avis d'infraction)
-- n'étaient tracés que dans audit_logs (générique, pas pensé pour une vue
-- "tous les emails envoyés"). Cette table dédiée centralise type/destinataire/
-- sujet/statut pour l'onglet Emails, sans dupliquer la logique métier de
-- chaque type d'envoi.

CREATE TABLE IF NOT EXISTS email_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type           TEXT NOT NULL CHECK (type IN (
                   'contrat_location', 'contrat_restitution',
                   'facture_restitution', 'avis_infraction', 'autre'
                 )),
  recipient      TEXT NOT NULL,
  subject        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'envoye' CHECK (status IN ('envoye', 'echec')),
  error          TEXT,
  reference_type TEXT,
  reference_id   UUID,
  client_id      UUID REFERENCES clients(id) ON DELETE SET NULL,
  sent_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_type    ON email_logs(type);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_managers" ON email_logs FOR ALL
  USING (get_user_role() IN ('gerant', 'associe'));
