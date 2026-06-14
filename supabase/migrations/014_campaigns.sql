-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 014 : Campagnes marketing
-- À exécuter dans Supabase SQL Editor (vtxoqybfqdauhblavvza)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaigns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  objective            TEXT,
  start_date           DATE NOT NULL,
  end_date             DATE,
  budget               NUMERIC DEFAULT 0,
  channel              TEXT NOT NULL,
  responsible          TEXT,
  prospects_count      INTEGER DEFAULT 0,
  reservations_count   INTEGER DEFAULT 0,
  revenue_generated    NUMERIC DEFAULT 0,
  observations         TEXT,
  status               TEXT NOT NULL DEFAULT 'planifiee'
                         CHECK (status IN ('planifiee', 'en_cours', 'terminee', 'suspendue')),
  created_at           TIMESTAMPTZ DEFAULT now()
);
