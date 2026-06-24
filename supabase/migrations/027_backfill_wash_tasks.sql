-- Backfill 027 — Rattrapage rétroactif "Lavage avant location"
-- Exécuter dans : Supabase Dashboard > SQL Editor
--
-- syncWashTask (lib/calendar/syncRental.ts) ne crée la tâche calendrier que lors
-- d'une mutation de la réservation (création, statut, dates, prolongation). Les
-- réservations déjà synchronisées avant l'introduction de cette logique, et non
-- re-modifiées depuis, n'ont jamais reçu leur tâche même si la situation
-- (rotation rapide ≤4h sur le même véhicule) s'applique. Reproduit ici la même
-- règle en SQL pur, une seule fois. Idempotent (NOT EXISTS) — peut être relancé
-- sans créer de doublon.

INSERT INTO calendar_events (title, event_type, status, start_at, end_at, reservation_id, vehicle_ids, client_id)
SELECT
  'Lavage avant location — ' || v.brand || ' ' || v.model || COALESCE(' ' || v.color, ''),
  'tache',
  CASE WHEN r.status IN ('en_cours', 'en_retard', 'terminee') THEN 'termine' ELSE 'a_faire' END,
  r.start_datetime - INTERVAL '1 hour',
  r.start_datetime,
  r.id,
  ARRAY[r.vehicle_id],
  NULL
FROM reservations r
JOIN vehicles v ON v.id = r.vehicle_id
WHERE r.status != 'annulee'
  AND EXISTS (
    SELECT 1 FROM reservations prev
    WHERE prev.vehicle_id = r.vehicle_id
      AND prev.id != r.id
      AND prev.status != 'annulee'
      AND prev.end_datetime <= r.start_datetime
      AND prev.end_datetime >= r.start_datetime - INTERVAL '4 hours'
  )
  AND NOT EXISTS (
    SELECT 1 FROM calendar_events ce
    WHERE ce.reservation_id = r.id AND ce.event_type = 'tache'
  );
