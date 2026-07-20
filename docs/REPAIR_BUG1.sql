-- ============================================================================
-- BUG 1 — Réparation des réservations bloquées « en location » sans EDL départ
-- ----------------------------------------------------------------------------
-- Contexte : avant le correctif dfc7657 (2026-07-19), OUVRIR l'écran EDL départ
-- suffisait à passer la réservation en `en_cours` (donc véhicule « loué »), même
-- sans état des lieux réellement effectué. Le code est désormais correct (le
-- passage en_cours ne se fait qu'à la SAUVEGARDE de l'EDL départ). Reste à
-- nettoyer les réservations restées bloquées « en_cours/en_retard » alors
-- qu'AUCUN état des lieux de départ n'existe pour elles.
--
-- Règle métier (gérant) : une réservation confirmée (même avec acompte) N'EST
-- PAS une sortie de véhicule. Seul un EDL départ effectué met « en location ».
--
-- ⚠️ À exécuter dans Supabase → SQL Editor. Lancez d'abord l'ÉTAPE 1 (lecture
-- seule), vérifiez la liste, puis seulement l'ÉTAPE 2 et 3 (dans une transaction).
-- ============================================================================


-- ── ÉTAPE 1 — DIAGNOSTIC (lecture seule) ────────────────────────────────────
-- Liste les réservations « sorties » (en_cours/en_retard) et indique si un EDL
-- départ existe / est signé. Les lignes edl_depart = 0 sont les bloquées à tort.
select
  r.id,
  r.reservation_number,
  r.status,
  r.start_datetime,
  r.end_datetime,
  r.updated_at,
  v.plate, v.brand, v.model, v.status as vehicle_status,
  count(i.id) filter (where i.type = 'depart')                               as edl_depart,
  count(i.id) filter (where i.type = 'depart' and i.client_signature_svg is not null) as edl_depart_signe
from reservations r
left join vehicles  v on v.id = r.vehicle_id
left join contracts c on c.reservation_id = r.id
left join inspections i on i.contract_id = c.id
where r.status in ('en_cours', 'en_retard')
group by r.id, v.id
order by r.start_datetime desc;


-- ── ÉTAPE 2 — RÉPARATION (à lancer après relecture de l'étape 1) ────────────
-- Repasse en « confirmee » toute réservation en_cours/en_retard SANS aucun EDL
-- départ (jamais réellement partie). Ne touche PAS celles qui ont un EDL départ
-- (sorties légitimes, y compris récupération anticipée).
--
-- Exécuter dans une transaction pour pouvoir annuler (ROLLBACK) si le résultat
-- ne correspond pas à l'attendu.
begin;

with sans_edl_depart as (
  select r.id
  from reservations r
  where r.status in ('en_cours', 'en_retard')
    and not exists (
      select 1
      from contracts c
      join inspections i on i.contract_id = c.id
      where c.reservation_id = r.id and i.type = 'depart'
    )
)
update reservations
set status = 'confirmee'
where id in (select id from sans_edl_depart)
returning id, reservation_number, status;

-- ── ÉTAPE 3 — Recalage du statut véhicule (même logique que recomputeVehicleStatus)
-- loué s'il reste un en_cours/en_retard, sinon réservé s'il reste un
-- confirmée/option, sinon disponible. Ne touche jamais un statut de maintenance.
update vehicles v
set status = sub.next
from (
  select ve.id,
    case
      when exists (select 1 from reservations r where r.vehicle_id = ve.id and r.status in ('en_cours','en_retard')) then 'loue'
      when exists (select 1 from reservations r where r.vehicle_id = ve.id and r.status in ('confirmee','option'))  then 'reserve'
      else 'disponible'
    end as next
  from vehicles ve
  where ve.status in ('disponible','loue','reserve')
) sub
where v.id = sub.id
  and v.status in ('disponible','loue','reserve')
  and v.status <> sub.next
returning v.id, v.plate, v.status;

-- Vérifiez les deux RETURNING ci-dessus, puis :
--   COMMIT;   -- pour appliquer
--   ROLLBACK; -- pour tout annuler si quelque chose cloche
commit;
