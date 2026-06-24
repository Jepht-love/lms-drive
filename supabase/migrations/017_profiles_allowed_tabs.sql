-- 017 — Permissions par onglet (inviter un membre par onglet)
-- Restreint les sections visibles dans le menu pour un membre employé/prestataire.
-- NULL = accès complet (rétro-compatible). Ignoré pour gérant/associé (toujours tout).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allowed_tabs text[];

COMMENT ON COLUMN profiles.allowed_tabs IS
  'Clés des sections accessibles (cf. lib/navigation/tabs.ts : dashboard, calendar, reservations, clients, vehicles, maintenance, contracts, incidents, internal-trips, partnerships). NULL = accès complet.';
