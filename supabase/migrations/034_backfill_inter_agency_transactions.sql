-- Migration 034 — Rattrapage comptable des opérations inter-agences existantes
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- À partir de ce correctif, chaque opération inter-agences s'inscrit
-- automatiquement en compta dès sa création (lib/actions/partnerships.ts:
-- bookOperationTransaction). Ce script rattrape les opérations créées AVANT,
-- qui n'ont donc encore aucune ligne dans financial_transactions.
--
-- Idempotent : les gardes NOT EXISTS (sur la même clé `reference` que le code
-- applicatif) empêchent tout doublon, le script peut être relancé sans risque.
-- created_by laissé à NULL (la table inter_agency_rentals ne trace pas l'auteur).

-- Sortantes : recette = montant reçu du partenaire (rental_cost)
INSERT INTO financial_transactions (date, type, category, amount, vehicle_id, notes, reference, created_by)
SELECT iar.start_date::date, 'recette', 'mise_a_disposition_sortante', iar.rental_cost, iar.vehicle_id,
       'Inter-agences sortant — ' || COALESCE(pa.name, ''), iar.id::text, NULL
FROM inter_agency_rentals iar
LEFT JOIN partner_agencies pa ON pa.id = iar.partner_agency_id
WHERE iar.direction = 'out' AND COALESCE(iar.rental_cost, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.reference = iar.id::text);

-- Entrantes : dépense = coût payé au partenaire (rental_cost)
INSERT INTO financial_transactions (date, type, category, amount, vehicle_id, notes, reference, created_by)
SELECT iar.start_date::date, 'depense', 'location_vehicule_partenaire', iar.rental_cost, NULL,
       'Inter-agences entrant (coût partenaire) — ' || COALESCE(pa.name, ''), iar.id::text, NULL
FROM inter_agency_rentals iar
LEFT JOIN partner_agencies pa ON pa.id = iar.partner_agency_id
WHERE iar.direction = 'in' AND COALESCE(iar.rental_cost, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.reference = iar.id::text);

-- Entrantes : recette = prix facturé au client (client_price)
INSERT INTO financial_transactions (date, type, category, amount, vehicle_id, notes, reference, created_by)
SELECT iar.start_date::date, 'recette', 'location', iar.client_price, NULL,
       'Inter-agences entrant (facturé client) — ' || COALESCE(pa.name, ''), iar.id::text || ':client', NULL
FROM inter_agency_rentals iar
LEFT JOIN partner_agencies pa ON pa.id = iar.partner_agency_id
WHERE iar.direction = 'in' AND COALESCE(iar.client_price, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.reference = iar.id::text || ':client');
