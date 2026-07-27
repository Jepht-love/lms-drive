-- 069 — Figer la ventilation du prix au moment de la réservation
--
-- Pourquoi : le prix d'une location se calcule à partir des tarifs COURANTS du
-- véhicule (jour semaine, jour week-end, forfait week-end, forfait 7 jours). Si
-- le gérant change sa grille, tout l'historique se recalcule et l'analyse des
-- offres devient fausse rétroactivement. Aujourd'hui la base ne garde que
-- `total_price` : on ne sait pas QUELLE formule a produit ce montant.
--
-- Cette colonne enregistre la décomposition telle qu'elle a été appliquée, avec
-- les tarifs en vigueur ce jour-là. Elle n'est affichée nulle part et ne change
-- aucun prix : elle rend possible, plus tard, l'analyse des offres les plus
-- rentables par véhicule et par période (décision du 27/07/2026 : mettre en
-- place l'enregistrement maintenant, construire l'écran quand il y aura de
-- vraies locations).
--
-- Forme :
-- {
--   "rates":  { "daily": 100, "weekend": 150, "weekendFull": 350, "weekly": 550 },
--   "lines":  [ { "kind": "day", "date": "2026-07-31", "weekend": true, "amount": 150 },
--               { "kind": "weekendFull", "from": "...", "to": "...", "amount": 350, "instead": 450 } ],
--   "total":  300,
--   "days":   2,
--   "computedAt": "2026-07-27T12:00:00.000Z"
-- }
--
-- Pas d'index pour l'instant : le volume ne le justifie pas, et un index GIN se
-- ajoute sans douleur le jour où l'écran d'analyse existera.

alter table reservations
  add column if not exists price_breakdown jsonb;

comment on column reservations.price_breakdown is
  'Ventilation du prix figée à la réservation (tarifs en vigueur + lignes appliquées). Historique d''analyse ; n''intervient dans aucun calcul.';
