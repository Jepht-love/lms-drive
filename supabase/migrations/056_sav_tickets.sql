-- Migration 056 — Tickets SAV (signalement de bugs in-app)
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Un bouton « ? » présent sur toutes les pages permet à n'importe quel
-- utilisateur de signaler un bug avec une description, le contexte pré-rempli
-- (module + sous-vue + chemin) et une capture d'écran. Les tickets sont lus
-- uniquement par le super-admin (côté serveur via service-role) et une
-- notification Telegram est envoyée à l'éditeur.

CREATE TABLE IF NOT EXISTS sav_tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reporter_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reporter_name  TEXT,
  reporter_role  TEXT,
  module         TEXT,          -- module lisible : « Réservations », « Comptabilité »…
  section        TEXT,          -- sous-vue précise : « État des lieux départ », « Échéances »…
  page_path      TEXT,          -- chemin technique : « /reservations/123 »
  description    TEXT NOT NULL,
  screenshot_url TEXT,          -- chemin de l'objet dans le bucket sav-screenshots
  user_agent     TEXT,
  status         TEXT NOT NULL DEFAULT 'nouveau',  -- nouveau | en_cours | resolu
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sav_tickets_status  ON sav_tickets(status);
CREATE INDEX IF NOT EXISTS idx_sav_tickets_created ON sav_tickets(created_at DESC);

ALTER TABLE sav_tickets ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifié peut CRÉER un ticket.
DROP POLICY IF EXISTS "sav_insert_any_auth" ON sav_tickets;
CREATE POLICY "sav_insert_any_auth" ON sav_tickets
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Aucune policy SELECT/UPDATE : la lecture et la gestion des tickets se font
-- exclusivement côté serveur via la clé service-role (super-admin). Les clients
-- ne peuvent donc jamais lire les tickets des autres.

-- Bucket privé pour les captures d'écran.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('sav-screenshots', 'sav-screenshots', false)
  ON CONFLICT (id) DO NOTHING;
