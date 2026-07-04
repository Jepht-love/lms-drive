-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 050 : Statut & historique de versions des documents
-- • status       : cycle de vie (valide / a_renouveler / expire / archive).
--                  Les 3 premiers sont surtout dérivés de expiry_date côté app ;
--                  « archive » est posé quand une version est remplacée.
-- • version      : numéro de version (1 = original).
-- • supersedes_id: pointe vers la version précédente qu'elle remplace.
-- • is_current   : true = version affichée dans la liste ; false = archivée
--                  (conservée dans l'historique).
-- À exécuter dans le SQL Editor du projet Supabase vtxoqybfqdauhblavvza.
-- ═══════════════════════════════════════════════════════

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'valide'
    CHECK (status IN ('valide', 'a_renouveler', 'expire', 'archive')),
  ADD COLUMN IF NOT EXISTS version       INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_current    BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS documents_current_idx    ON documents(is_current);
CREATE INDEX IF NOT EXISTS documents_supersedes_idx ON documents(supersedes_id);

COMMENT ON COLUMN documents.status        IS 'Cycle de vie : valide / a_renouveler / expire / archive.';
COMMENT ON COLUMN documents.version       IS 'Numéro de version (1 = document original).';
COMMENT ON COLUMN documents.supersedes_id IS 'Version précédente remplacée par ce document.';
COMMENT ON COLUMN documents.is_current    IS 'true = version courante affichée ; false = version archivée (historique).';
