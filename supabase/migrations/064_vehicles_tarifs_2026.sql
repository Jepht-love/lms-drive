-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 064 : Grille tarifaire 2026
-- À exécuter dans Supabase SQL Editor (vtxoqybfqdauhblavvza)
-- ═══════════════════════════════════════════════════════
--
-- CE QUE FAIT CETTE MIGRATION
--
-- 1. Aligne les tarifs des 10 véhicules du parc sur la grille validée par
--    le gérant (prix jour semaine / prix jour week-end / semaine 7 jours /
--    caution), ainsi que les kilométrages inclus et le supplément au km.
--
-- 2. Supprime le forfait « week-end complet » (price_weekend_full = NULL).
--    Il n'existe plus : le week-end n'est pas un forfait, c'est simplement
--    un tarif journalier plus élevé. Les anciens montants (2000 / 800 /
--    350 / 250 / 200 €) sont donc caducs et ne doivent plus être affichés
--    ni facturés. La colonne est conservée pour ne rien casser, mais vidée.
--
-- 3. Garde les colonnes historiques daily_price / weekly_price synchronisées :
--    c'est encore ce que lit le calcul des réservations aujourd'hui.
--    daily_price = tarif SEMAINE (tarif de base) ; le supplément week-end
--    est appliqué par le calcul, pas stocké ici.
--
-- AUCUNE STRUCTURE N'EST MODIFIÉE — uniquement des données.
-- Les colonnes utilisées existent déjà (migrations 001 et 012).
--
-- ═══════════════════════════════════════════════════════

-- 1. Sauvegarde des tarifs actuels avant écrasement (traçabilité / rollback)
CREATE TABLE IF NOT EXISTS vehicles_pricing_backup_064 AS
SELECT id, plate, brand, model,
       price_day_week, price_day_weekend, price_weekend_full, price_week,
       daily_price, weekly_price, deposit_amount,
       km_included_day, km_included_weekend, km_included_week, km_extra_price,
       km_included_daily, extra_km_price,
       now() AS backed_up_at
FROM vehicles;

-- 2. Application de la grille
UPDATE vehicles v SET
  price_day_week      = t.day_week,
  price_day_weekend   = t.day_weekend,
  price_week          = t.week,
  price_weekend_full  = NULL,          -- forfait week-end supprimé
  deposit_amount      = t.deposit,
  daily_price         = t.day_week,    -- tarif de base = tarif semaine
  weekly_price        = t.week,
  km_included_day     = 200,
  km_included_weekend = 600,
  km_included_week    = 1200,
  km_extra_price      = 2,
  km_included_daily   = 200,
  extra_km_price      = 2
FROM (VALUES
  -- plaque,        jour semaine, jour week-end, semaine 7j,      caution
  ('HK-347-GV',              650,           700, NULL::numeric,    10000),  -- BMW i8
  ('BD-122-RLS',             250,           300, 1500,              5000),  -- BMW M135i bleue
  ('GW-026-JD',              250,           300, 1500,              5000),  -- BMW M135i noire
  ('GE-226-EZ',              100,           150,  550,              2000),  -- BMW Série 1 blanche
  ('HK-294-MD',               80,            90,  450,              1500),  -- Peugeot 208
  ('GP-977-KZ',               80,            90,  450,              1500),  -- DS 3 Crossback
  ('HF-760-LS',               80,            90,  450,              1500),  -- Renault Captur
  ('HA-974-JV',               80,            90,  450,              1500),  -- Clio V Alpine
  ('FN-215-VR',               50,            70,  350,              1000),  -- Citroën C3
  ('DQ-314-CV',               50,            70,  350,               500)   -- Smart Fortwo
) AS t(plate, day_week, day_weekend, week, deposit)
WHERE v.plate = t.plate;

-- 3. Vérification — doit renvoyer les 10 lignes avec les nouveaux montants.
--    Toute ligne manquante = plaque absente de la base ou orthographiée
--    différemment : à corriger avant de considérer la migration terminée.
SELECT plate, brand, model, version,
       price_day_week   AS "jour semaine",
       price_day_weekend AS "jour week-end",
       price_week       AS "semaine 7j",
       deposit_amount   AS caution,
       price_weekend_full AS "forfait we (doit etre NULL)"
FROM vehicles
WHERE plate IN ('HK-347-GV','BD-122-RLS','GW-026-JD','GE-226-EZ','HK-294-MD',
                'GP-977-KZ','HF-760-LS','HA-974-JV','FN-215-VR','DQ-314-CV')
ORDER BY price_day_week DESC;
