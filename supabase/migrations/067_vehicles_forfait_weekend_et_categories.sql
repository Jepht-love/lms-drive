-- 066 : rétablit le forfait « week-end complet » et fixe les catégories manquantes.
--
-- Contexte : la migration 064 a appliqué la nouvelle grille tarifaire mais a mis
-- price_weekend_full à NULL sur les 10 véhicules, en lisant à tort le forfait
-- week-end comme supprimé. La grille confirmée par le gérant le 26/07/2026 le
-- contient bien, avec un prix par véhicule.
--
-- Deux catégories sont fixées au passage, tranchées par le gérant le même jour :
--   - DS 3 Crossback : était classé « suv », catégorie pour laquelle il n'existe
--     aucun barème de frais ni aucun contrat type. Il relève du contrat citadine.
--   - BMW M135i bleue : catégorie vide, donc barème citadine appliqué par défaut
--     à un véhicule sportif (retard facturé 50 €/h au lieu de 150, pare-brise
--     1 000 € au lieu de 5 000). Elle relève du tarif sportif.

UPDATE vehicles v SET
  price_weekend_full = t.forfait,
  category           = t.cat
FROM (VALUES
  ('HK-347-GV', 2000, 'sportif'),   -- BMW i8
  ('GW-026-JD',  800, 'sportif'),   -- BMW M135i noire
  ('BD-122-RLS', 800, 'sportif'),   -- BMW M135i bleue  (catégorie était vide)
  ('GE-226-EZ',  350, 'citadine'),  -- BMW Série 1 blanche
  ('HK-294-MD',  250, 'citadine'),  -- Peugeot 208
  ('GP-977-KZ',  250, 'citadine'),  -- DS 3 Crossback   (était classé « suv »)
  ('HF-760-LS',  250, 'citadine'),  -- Renault Captur
  ('HA-974-JV',  250, 'citadine'),  -- Clio V Alpine
  ('FN-215-VR',  200, 'citadine'),  -- Citroën C3
  ('DQ-314-CV',  200, 'citadine')   -- Smart Fortwo
) AS t(plate, forfait, cat)
WHERE v.plate = t.plate;

-- Vérification : doit renvoyer 10 lignes, aucun forfait vide, aucune catégorie vide
SELECT plate, brand, model, category, price_weekend_full
FROM vehicles ORDER BY price_weekend_full DESC;
