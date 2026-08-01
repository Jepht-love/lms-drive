-- 073 — Relier les interventions aux dégâts, et ventiler les réparations
--
-- À quoi sert cette migration : jusqu'ici l'état des lieux créait un dégât sur le
-- véhicule et l'entretien créait une intervention chez le garage, sans qu'aucun
-- lien n'existe entre les deux. Impossible donc de dire ce qu'une réparation a
-- coûté par rapport à ce qui avait été facturé au client. Ces colonnes établissent
-- ce lien et permettent la rubrique « Dégâts et réparations » de la comptabilité.
-- Cadré avec Jeff le 01/08/2026 (docs/PLAN-INTERVENTIONS-COMPTA.md).
--
-- Elle est purement additive : aucune donnée existante n'est touchée, aucune
-- colonne supprimée, aucune valeur réécrite. Les lignes déjà en base restent
-- valides avec ces colonnes à NULL.
--
-- Ce qu'il ne faut pas casser : `financial_transactions` est la table de la
-- comptabilité. Les deux colonnes ajoutées ici ne servent qu'à ventiler un
-- affichage ; aucun calcul de solde ne doit en dépendre, sans quoi les écritures
-- antérieures au 01/08/2026 (damage_origin à NULL) fausseraient les totaux.

-- ───────────────────────────────────────────────────────
-- INTERVENTIONS — le devis du garage, et la location d'origine
-- ───────────────────────────────────────────────────────
-- Le garage donne un devis AVANT de réparer et ne facture qu'après. Les deux temps
-- doivent être distincts : un devis validé ne crée aucune dépense en comptabilité,
-- il annonce seulement ce qui va tomber. `quote_status` porte les trois états, et
-- reste modifiable ou annulable tant que la réparation n'est pas faite.

ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS quote_amount   numeric,
  ADD COLUMN IF NOT EXISTS quote_status   text,
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES reservations(id);

ALTER TABLE maintenance_records DROP CONSTRAINT IF EXISTS maintenance_quote_status_check;
ALTER TABLE maintenance_records ADD CONSTRAINT maintenance_quote_status_check
  CHECK (quote_status IS NULL OR quote_status IN ('brouillon', 'valide', 'annule'));

CREATE INDEX IF NOT EXISTS idx_maintenance_reservation
  ON maintenance_records(reservation_id) WHERE reservation_id IS NOT NULL;

-- ───────────────────────────────────────────────────────
-- COMPTABILITÉ — d'où vient le dégât, et de quel type il est
-- ───────────────────────────────────────────────────────
-- Une même intervention peut réparer une rayure due à une location ET une usure du
-- temps : chaque dégât produit donc SA propre écriture, porteuse de son origine.
-- Sans cette colonne, il faudrait rouvrir le véhicule et parcourir ses dégâts à
-- chaque affichage du tableau.
--
-- `non_facture` n'est pas une origine au sens du catalogue : c'est un dégât survenu
-- pendant une location mais non facturé au client (geste commercial, prise en charge
-- par l'assurance, client non responsable). Il sort de « location » pour ne pas
-- dégrader son taux d'amortissement, tout en restant visible avec son motif.
-- Décision de Jeff du 01/08/2026.
--
-- `damage_type` reprend les identifiants du catalogue (lib/vehicles/damage-catalog.ts)
-- et sert au regroupement par type demandé par Jeff : savoir si ce sont les jantes
-- ou la carrosserie qui coûtent le plus cher sur l'ensemble du parc.

ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS damage_origin text,
  ADD COLUMN IF NOT EXISTS damage_type   text;

ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS ft_damage_origin_check;
ALTER TABLE financial_transactions ADD CONSTRAINT ft_damage_origin_check
  CHECK (damage_origin IS NULL OR damage_origin IN (
    'location', 'usure', 'usage_interne', 'non_communiquee', 'non_facture'
  ));

CREATE INDEX IF NOT EXISTS idx_ft_damage_origin
  ON financial_transactions(damage_origin, date) WHERE damage_origin IS NOT NULL;

COMMENT ON COLUMN maintenance_records.quote_amount   IS 'Devis du garage, avant réparation. N''écrit rien en comptabilité.';
COMMENT ON COLUMN maintenance_records.quote_status   IS 'brouillon | valide | annule. NULL = pas de devis.';
COMMENT ON COLUMN maintenance_records.reservation_id IS 'Location à l''origine des dégâts réparés, quand ils viennent tous de la même.';
COMMENT ON COLUMN financial_transactions.damage_origin IS 'Ventilation du tableau « Dégâts et réparations ». NULL pour tout ce qui n''est pas une réparation de dégât.';
COMMENT ON COLUMN financial_transactions.damage_type   IS 'Identifiant du catalogue des dégâts (lib/vehicles/damage-catalog.ts).';
