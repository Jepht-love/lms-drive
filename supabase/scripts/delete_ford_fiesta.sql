-- ═══════════════════════════════════════════════════════════════════════════
-- LMS DRIVE — Suppression DÉFINITIVE d'un véhicule de test (Ford Fiesta) #18
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️  DESTRUCTIF ET IRRÉVERSIBLE. À exécuter À LA MAIN dans le SQL Editor de
--     Supabase (projet vtxoqybfqdauhblavvza), après avoir lu STEP 0 et STEP 1.
--
-- Ce script supprime le véhicule ET toute sa traîne : réservations, contrats,
-- états des lieux (+ photos), incidents/infractions/sinistres, entretiens,
-- déplacements internes, mises à disposition inter-agences, transactions et
-- échéances comptables, factures, documents et événements calendrier liés.
--
-- MÉTHODE : on travaille par plaque (unique). Faites d'abord STEP 1 pour
-- vérifier qu'on cible bien LE bon véhicule et voir le volume de données
-- impactées. Ne lancez STEP 2 que si tout est cohérent.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 0 — Renseigner la plaque du véhicule à supprimer (UNE seule ligne)
-- ───────────────────────────────────────────────────────────────────────────
-- Remplacez la valeur ci-dessous PARTOUT (STEP 1 et STEP 2) par la plaque exacte
-- de la Ford Fiesta de test. Astuce : retrouvez-la avec la requête juste après.

SELECT id, plate, brand, model, status, is_active
FROM vehicles
WHERE lower(brand) = 'ford' AND lower(model) LIKE 'fiesta%';
-- → notez la plaque exacte (ex. 'XX-123-YY') et vérifiez que c'est BIEN le test.


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1 — CONTRÔLE : combien de lignes seront supprimées ? (lecture seule)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Remplacez 'XX-123-YY' par la plaque réelle dans les deux blocs (STEP 1 & 2).

WITH v AS (SELECT id FROM vehicles WHERE plate = 'XX-123-YY'),
     r AS (SELECT id FROM reservations WHERE vehicle_id IN (SELECT id FROM v)),
     c AS (SELECT id FROM contracts WHERE reservation_id IN (SELECT id FROM r)),
     i AS (SELECT id FROM inspections
            WHERE contract_id IN (SELECT id FROM c)
               OR vehicle_id  IN (SELECT id FROM v))
SELECT
  (SELECT count(*) FROM v)                                                        AS vehicules,
  (SELECT count(*) FROM r)                                                        AS reservations,
  (SELECT count(*) FROM c)                                                        AS contrats,
  (SELECT count(*) FROM i)                                                        AS etats_des_lieux,
  (SELECT count(*) FROM inspection_photos WHERE inspection_id IN (SELECT id FROM i)) AS edl_photos,
  (SELECT count(*) FROM invoices  WHERE contract_id IN (SELECT id FROM c)
                                     OR reservation_id IN (SELECT id FROM r)
                                     OR vehicle_id IN (SELECT id FROM v))          AS factures,
  (SELECT count(*) FROM incidents WHERE vehicle_id IN (SELECT id FROM v)
                                     OR contract_id IN (SELECT id FROM c))         AS incidents,
  (SELECT count(*) FROM infractions WHERE vehicle_id IN (SELECT id FROM v)
                                       OR reservation_id IN (SELECT id FROM r))    AS infractions,
  (SELECT count(*) FROM accidents WHERE vehicle_id IN (SELECT id FROM v)
                                     OR reservation_id IN (SELECT id FROM r))      AS sinistres,
  (SELECT count(*) FROM maintenance_records WHERE vehicle_id IN (SELECT id FROM v)) AS entretiens,
  (SELECT count(*) FROM internal_trips WHERE vehicle_id IN (SELECT id FROM v))     AS deplacements_internes,
  (SELECT count(*) FROM inter_agency_rentals WHERE vehicle_id IN (SELECT id FROM v)
                                                OR client_reservation_id IN (SELECT id FROM r)) AS inter_agences,
  (SELECT count(*) FROM financial_transactions WHERE vehicle_id IN (SELECT id FROM v)
                                                  OR reservation_id IN (SELECT id FROM r)) AS transactions,
  (SELECT count(*) FROM financial_due_dates WHERE vehicle_id IN (SELECT id FROM v)) AS echeances,
  (SELECT count(*) FROM tasks WHERE vehicle_id IN (SELECT id FROM v)
                                 OR reservation_id IN (SELECT id FROM r))          AS taches_legacy,
  (SELECT count(*) FROM calendar_events
            WHERE reservation_id IN (SELECT id FROM r)
               OR vehicle_id IN (SELECT id FROM v)
               OR vehicle_ids && (SELECT array_agg(id) FROM v))                    AS evenements_calendrier,
  (SELECT count(*) FROM documents WHERE reservation_id IN (SELECT id FROM r)
                                     OR entity_id IN (SELECT id FROM v))           AS documents;


-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2 — SUPPRESSION (transaction). NE LANCER QU'APRÈS CONTRÔLE STEP 1.
-- ───────────────────────────────────────────────────────────────────────────
-- Tout est dans une transaction : en cas de doute, remplacez le COMMIT final
-- par ROLLBACK pour tout annuler. ⚠️ Mettez la MÊME plaque qu'au STEP 1.

BEGIN;

-- Jeux d'ids figés le temps de la transaction (ON COMMIT DROP = auto-nettoyés)
CREATE TEMP TABLE _del_vehicle    ON COMMIT DROP AS
  SELECT id FROM vehicles WHERE plate = 'XX-123-YY';
CREATE TEMP TABLE _del_resa       ON COMMIT DROP AS
  SELECT id FROM reservations WHERE vehicle_id IN (SELECT id FROM _del_vehicle);
CREATE TEMP TABLE _del_contract   ON COMMIT DROP AS
  SELECT id FROM contracts WHERE reservation_id IN (SELECT id FROM _del_resa);
CREATE TEMP TABLE _del_inspection ON COMMIT DROP AS
  SELECT id FROM inspections WHERE contract_id IN (SELECT id FROM _del_contract)
                                OR vehicle_id  IN (SELECT id FROM _del_vehicle);

-- Enfants des états des lieux
DELETE FROM inspection_photos WHERE inspection_id IN (SELECT id FROM _del_inspection);

-- Incidents (réfèrent véhicule, contrat et/ou EDL d'arrivée via incidents.arrival_inspection_id)
DELETE FROM incidents
  WHERE vehicle_id           IN (SELECT id FROM _del_vehicle)
     OR contract_id          IN (SELECT id FROM _del_contract)
     OR arrival_inspection_id IN (SELECT id FROM _del_inspection);

-- Factures (sinon bloquées par contracts ; ON DELETE CASCADE existe mais on est explicite)
DELETE FROM invoices
  WHERE contract_id    IN (SELECT id FROM _del_contract)
     OR reservation_id IN (SELECT id FROM _del_resa)
     OR vehicle_id     IN (SELECT id FROM _del_vehicle);

-- États des lieux, puis contrats
DELETE FROM inspections WHERE id IN (SELECT id FROM _del_inspection);
DELETE FROM contracts   WHERE id IN (SELECT id FROM _del_contract);

-- Tout ce qui pointe vers le véhicule et/ou ses réservations
DELETE FROM tasks
  WHERE vehicle_id IN (SELECT id FROM _del_vehicle)
     OR reservation_id IN (SELECT id FROM _del_resa);
DELETE FROM infractions
  WHERE vehicle_id IN (SELECT id FROM _del_vehicle)
     OR reservation_id IN (SELECT id FROM _del_resa);
DELETE FROM accidents
  WHERE vehicle_id IN (SELECT id FROM _del_vehicle)
     OR reservation_id IN (SELECT id FROM _del_resa);
DELETE FROM financial_transactions
  WHERE vehicle_id IN (SELECT id FROM _del_vehicle)
     OR reservation_id IN (SELECT id FROM _del_resa);
DELETE FROM inter_agency_rentals
  WHERE vehicle_id IN (SELECT id FROM _del_vehicle)
     OR client_reservation_id IN (SELECT id FROM _del_resa);
DELETE FROM internal_trips      WHERE vehicle_id IN (SELECT id FROM _del_vehicle);
DELETE FROM financial_due_dates WHERE vehicle_id IN (SELECT id FROM _del_vehicle);
DELETE FROM maintenance_records WHERE vehicle_id IN (SELECT id FROM _del_vehicle);

-- Événements calendrier (mono- ou multi-véhicule) + ceux liés aux réservations
DELETE FROM calendar_events
  WHERE reservation_id IN (SELECT id FROM _del_resa)
     OR vehicle_id     IN (SELECT id FROM _del_vehicle)
     OR vehicle_ids && (SELECT array_agg(id) FROM _del_vehicle);

-- Documents (véhicule via entity_id, ou rattachés à une réservation supprimée)
DELETE FROM documents
  WHERE reservation_id IN (SELECT id FROM _del_resa)
     OR entity_id      IN (SELECT id FROM _del_vehicle);

-- Réservations, puis enfin le véhicule
DELETE FROM reservations WHERE id IN (SELECT id FROM _del_resa);
DELETE FROM vehicles     WHERE id IN (SELECT id FROM _del_vehicle);

-- Contrôle final : doit renvoyer 0 partout.
SELECT
  (SELECT count(*) FROM vehicles WHERE plate = 'XX-123-YY') AS vehicule_restant,
  (SELECT count(*) FROM reservations r
     WHERE NOT EXISTS (SELECT 1 FROM vehicles v WHERE v.id = r.vehicle_id)) AS reservations_orphelines;

-- ✅ Si tout est cohérent : COMMIT;   —   ❌ Sinon : ROLLBACK;
COMMIT;
