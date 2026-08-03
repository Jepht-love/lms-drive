-- ─── Le kilométrage illimité sur une réservation ──────────────────────────────
--
-- Ce que ça règle (demande de Jeff, remarque G) : le gérant vend une option
-- « kilométrage illimité » à certains clients. Rien ne l'enregistrait, et la
-- facture de restitution continuait de compter les kilomètres en trop : le
-- client payait l'option ET son dépassement.
--
-- Le prix de l'option est porté par le véhicule (`vehicles.unlimited_km_price`,
-- migration 076) et se règle dans les grilles tarifaires. Une case vide veut
-- dire « option non proposée sur cette voiture » ; 0 € veut dire « proposée et
-- offerte ». Les deux ne se confondent pas.
--
-- Pourquoi le montant est RECOPIÉ ici et pas seulement lu sur le véhicule : le
-- prix de l'option peut changer demain, et une réservation signée hier doit
-- garder le montant qu'elle a facturé. Même raison que `daily_price`, déjà figé
-- sur la réservation.
--
-- ⚠️ Purement additif. Une réservation existante a `unlimited_km` à false : la
-- facturation du dépassement continue exactement comme avant.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS unlimited_km BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlimited_km_price NUMERIC;

COMMENT ON COLUMN reservations.unlimited_km IS
  'Option kilométrage illimité vendue sur cette location. Éteint la facturation du dépassement à l''état des lieux de retour, JAMAIS le relevé du compteur (03/08/2026).';
COMMENT ON COLUMN reservations.unlimited_km_price IS
  'Montant facturé pour l''option, figé à la réservation. 0 = option offerte, NULL = option non vendue.';
