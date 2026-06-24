-- Backfill 028 — Corrige les véhicules "loué"/"réservé" orphelins
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- Cause trouvée : validateContract (clôture de contrat) mettait la réservation
-- à 'terminee' sans jamais recalculer vehicles.status, et deleteReservation ne le
-- touchait pas non plus à la suppression — un véhicule pouvait donc rester
-- marqué loue/reserve indéfiniment alors qu'aucune réservation active ne le
-- justifie plus (symptôme : pas de date de retour affichée sur /vehicles).
-- Les deux causes sont corrigées dans le code (lib/vehicles/vehicleStatus.ts,
-- appelé désormais par updateReservationStatus, createReservation,
-- validateContract et deleteReservation). Ce script corrige les données déjà
-- en place. Ne touche jamais un statut de maintenance (a_reparer, hors_service,
-- en_verification, immobilise, mis_a_disposition).

-- 1) Diagnostic — à lancer d'abord pour voir précisément quels véhicules sont concernés.
SELECT id, plate, brand, model, status
FROM vehicles
WHERE status IN ('loue', 'reserve')
  AND NOT EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.vehicle_id = vehicles.id AND r.status NOT IN ('annulee', 'terminee')
  );

-- 2) Correction — remet ces véhicules à 'disponible' (aucune réservation réelle
--    ne les occupe). Si l'un d'eux est en réalité prêté hors-système, le gérant
--    peut re-fixer son statut manuellement après coup.
UPDATE vehicles
SET status = 'disponible'
WHERE status IN ('loue', 'reserve')
  AND NOT EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.vehicle_id = vehicles.id AND r.status NOT IN ('annulee', 'terminee')
  );
