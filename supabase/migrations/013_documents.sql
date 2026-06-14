-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 013 : Bibliothèque documentaire
-- À exécuter dans Supabase SQL Editor (vtxoqybfqdauhblavvza)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT NOT NULL CHECK (category IN ('entreprise', 'vehicule', 'client', 'partenaire')),
  subcategory      TEXT NOT NULL,
  name             TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  file_type        TEXT,
  file_size        INTEGER,
  entity_id        UUID,
  entity_type      TEXT,
  reservation_id   UUID REFERENCES reservations(id) ON DELETE SET NULL,
  is_auto_generated BOOLEAN DEFAULT false,
  tags             TEXT[] DEFAULT '{}',
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  expiry_date      DATE
);

CREATE INDEX IF NOT EXISTS documents_category_idx ON documents(category);
CREATE INDEX IF NOT EXISTS documents_entity_idx   ON documents(entity_id);
CREATE INDEX IF NOT EXISTS documents_name_search  ON documents USING gin(to_tsvector('french', name));
