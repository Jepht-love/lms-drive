-- 076 — Les grilles tarifaires par catégorie de véhicule
--
-- À quoi sert cette migration : le gérant demande de créer plusieurs grilles
-- (Sportive, Citadine…) et de les modifier sans toucher au code. Elle règle en
-- même temps un défaut plus grave, constaté le 28/07/2026 : les six tarifs de
-- l'écran des paramètres étaient enregistrés mais **aucune facture ne les
-- lisait**. Le gérant pouvait changer ses prix en croyant les appliquer.
--
-- Les deux niveaux, tranchés par Jeff le 02/08/2026 :
--
--   · NIVEAU GRILLE, commun à toutes ses voitures : retard à l'heure, retard à
--     la journée, carburant, franchise. Ce sont les quatre valeurs que personne
--     ne portait, et c'est là que la grille règle le défaut de fond.
--   · NIVEAU VÉHICULE, propre à chacun : les prix de location, la caution, le
--     supplément au kilomètre, les kilomètres inclus. Ils existent déjà sur
--     `vehicles` et **le véhicule gagne toujours** : « chaque véhicule a son
--     prix, le prix au kilomètre n'est pas le même ».
--
-- ⚠️ Ce qu'il ne faut pas casser : la migration 064 a écrit les tarifs des dix
-- véhicules de LMS Drive plaque par plaque, supplément au kilomètre à 2 €
-- compris. **Ces valeurs sont la vérité de facturation actuelle.** La grille ne
-- les remplace jamais : elle ne sert que de valeur par défaut quand le véhicule
-- n'a rien, et de seule source pour les quatre tarifs communs.
--
-- Un véhicule n'appartient qu'à une grille, et il peut n'en avoir aucune : il
-- facture alors ses propres valeurs, exactement comme aujourd'hui. Rien ne
-- change le jour de la livraison.

CREATE TABLE IF NOT EXISTS pricing_grids (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  -- Les quatre valeurs communes à toutes les voitures de la grille.
  late_hourly_rate     numeric,
  late_daily_rate      numeric,
  fuel_rate_per_liter  numeric,
  insurance_deductible numeric,
  created_at           timestamptz DEFAULT NOW(),
  updated_at           timestamptz DEFAULT NOW()
);

-- Le rattachement. `ON DELETE SET NULL` : supprimer une grille ne doit jamais
-- faire disparaître une voiture, elle repart simplement sans grille.
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS pricing_grid_id uuid REFERENCES pricing_grids(id) ON DELETE SET NULL,
  -- Le prix du kilométrage illimité, porté par le VÉHICULE : le gérant le veut à
  -- 0 € sur une C3 et libre sur une BMW. Zéro est une valeur valable, elle veut
  -- dire « inclus, sans supplément », pas « non renseigné » — d'où le NULL
  -- distinct de 0.
  ADD COLUMN IF NOT EXISTS unlimited_km_price numeric;

CREATE INDEX IF NOT EXISTS idx_vehicles_pricing_grid ON vehicles(pricing_grid_id);

ALTER TABLE pricing_grids ENABLE ROW LEVEL SECURITY;

-- Lecture par tous : la facture d'une réservation doit pouvoir lire la grille du
-- véhicule quel que soit le rôle de celui qui la génère. L'écriture est filtrée
-- dans les Server Actions, qui vérifient le rôle avant d'enregistrer.
DROP POLICY IF EXISTS pricing_grids_all ON pricing_grids;
CREATE POLICY pricing_grids_all ON pricing_grids
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
