-- 046 — Clôtures fiables : réconciliation de caisse + gel
-- La clôture journalière sert à rapprocher l'encaissement RÉEL compté (caisse,
-- TPE…) des recettes SAISIES dans le logiciel, pour détecter les écarts de
-- saisie. On stocke le compté par mode + l'écart, figés avec le reste du
-- snapshot. Le gel (verrou des écritures + affichage du snapshot) est géré côté
-- application (assertPeriodOpen + lecture du snapshot quand is_closed).

ALTER TABLE daily_closings
  ADD COLUMN IF NOT EXISTS counted_by_method jsonb DEFAULT '{}'::jsonb,  -- réel compté par mode {especes: x, carte: y…}
  ADD COLUMN IF NOT EXISTS counted_total      numeric,                   -- total réel compté
  ADD COLUMN IF NOT EXISTS variance           numeric;                   -- réel − logiciel (écart de saisie)
