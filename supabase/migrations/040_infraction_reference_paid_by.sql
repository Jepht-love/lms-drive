-- Migration 040 — Référence de la contravention + qui règle (client/agence)
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- reference : numéro de l'avis de contravention (texte libre, formats variables
-- selon l'autorité émettrice — pas de contrainte de format).
-- paid_by : distingue qui règle l'amende, posé seulement au moment du règlement
-- (NULL avant). Sert aussi à l'enregistrement comptable (lib/actions/incidents.ts
-- markInfractionPaid) : seule une amende réglée par l'agence est une dépense
-- réelle pour elle — si le client règle directement, pas d'écriture de dépense.

ALTER TABLE infractions ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE infractions ADD COLUMN IF NOT EXISTS paid_by TEXT CHECK (paid_by IN ('client', 'agence'));
