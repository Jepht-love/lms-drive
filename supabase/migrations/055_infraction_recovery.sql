-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 055
-- Infractions : suivi du recouvrement / refacturation client
--
-- Contexte gérant : quand l'agence règle elle-même une amende à la place
-- du client (paid_by = 'agence'), elle avance l'argent. Il faut pouvoir
-- suivre si l'amende a été REFACTURÉE au client et quel montant a été
-- réellement RÉCUPÉRÉ auprès de lui. Le recouvrement encaissé est
-- comptabilisé en recette (catégorie « amendes ») pour neutraliser la
-- dépense d'avance créée par markInfractionPaid('agence').
-- ═══════════════════════════════════════════════════════

ALTER TABLE infractions
  ADD COLUMN IF NOT EXISTS rebilled_to_client BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovered_amount   NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovered_at       DATE;

COMMENT ON COLUMN infractions.rebilled_to_client IS 'Amende avancée par l''agence refacturée au client';
COMMENT ON COLUMN infractions.recovered_amount   IS 'Montant cumulé réellement récupéré auprès du client';
COMMENT ON COLUMN infractions.recovered_at       IS 'Date du dernier encaissement de recouvrement';
