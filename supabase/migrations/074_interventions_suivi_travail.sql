-- 074 — Le suivi du TRAVAIL d'une intervention
--
-- À quoi sert cette migration : jusqu'ici une intervention ne portait que le
-- suivi de l'ARGENT (devis, montant, règlement, ventilation comptable, livrés le
-- 01/08/2026 par la migration 073). Rien ne disait qui s'en occupe, pour quand,
-- ni où en est le travail. Le gérant l'a demandé le 02/08/2026 : degré d'urgence,
-- date limite, personne assignée, prise en charge volontaire et six statuts de
-- suivi. Cadrage complet dans docs/PLAN-A2-INTERVENTIONS.md.
--
-- Elle est purement additive : aucune colonne supprimée, aucune donnée effacée.
-- Les lignes existantes restent valides, avec les valeurs par défaut ci-dessous.
--
-- Ce qu'il ne faut pas casser : le suivi du travail est INDÉPENDANT du suivi de
-- l'argent. `work_status` dit où en est la réparation, `paid_at` dit si le garage
-- a été payé. Une intervention peut être terminée sans être réglée, et l'inverse
-- est vrai aussi. Ne jamais déduire l'un de l'autre en dehors du seul cas prévu :
-- régler une intervention clôt son travail s'il ne l'était pas déjà.

ALTER TABLE maintenance_records
  -- Trois niveaux saisis à la main (Jeff, 02/08/2026). C'est l'urgence qui décide
  -- de l'entrée dans les alertes : critique = urgent, haute = important,
  -- normale = n'alerte pas.
  ADD COLUMN IF NOT EXISTS urgency     text NOT NULL DEFAULT 'normale',
  -- Facultative. Une fois dépassée, l'intervention monte en urgent quelle que
  -- soit son urgence d'origine.
  ADD COLUMN IF NOT EXISTS due_date    date,
  -- La personne désignée par un gérant. Distincte de `taken_by` : on peut être
  -- désigné sans s'être encore mis dessus, et se saisir d'une intervention que
  -- personne n'avait désignée.
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS taken_by    uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS taken_at    timestamptz,
  -- Les six statuts du gérant, dans l'ordre du parcours réel.
  ADD COLUMN IF NOT EXISTS work_status text NOT NULL DEFAULT 'a_traiter',
  ADD COLUMN IF NOT EXISTS closed_at   timestamptz;

ALTER TABLE maintenance_records
  DROP CONSTRAINT IF EXISTS maintenance_urgency_check;
ALTER TABLE maintenance_records
  ADD CONSTRAINT maintenance_urgency_check
  CHECK (urgency IN ('normale', 'haute', 'critique'));

ALTER TABLE maintenance_records
  DROP CONSTRAINT IF EXISTS maintenance_work_status_check;
ALTER TABLE maintenance_records
  ADD CONSTRAINT maintenance_work_status_check
  CHECK (work_status IN ('a_traiter', 'prise_en_charge', 'rdv_programme', 'en_cours', 'terminee', 'annulee'));

-- L'historique déjà réglé est du travail fini : sans cette ligne, toutes les
-- interventions passées repartiraient en « à traiter » et remonteraient en
-- alerte le jour même de la migration.
UPDATE maintenance_records
   SET work_status = 'terminee',
       closed_at   = COALESCE(closed_at, (paid_at::timestamptz))
 WHERE paid_at IS NOT NULL
   AND work_status = 'a_traiter';

-- Les alertes lisent « ce qui n'est ni terminé ni annulé », et le tableau de bord
-- filtre par personne assignée.
CREATE INDEX IF NOT EXISTS idx_maintenance_work_status ON maintenance_records(work_status);
CREATE INDEX IF NOT EXISTS idx_maintenance_assigned    ON maintenance_records(assigned_to);
