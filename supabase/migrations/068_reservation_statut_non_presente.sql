-- Statut de clôture « client non présenté » (no-show).
--
-- Besoin gérant du 27/07/2026 : une réservation dont l'heure de départ est passée
-- et dont le client n'est jamais venu n'avait aucune porte de sortie. Elle restait
-- « confirmée » indéfiniment, la voiture restait bloquée, et le logiciel devait
-- deviner s'il s'agissait d'un départ sans état des lieux ou d'un client absent.
--
-- « non_presente » est un état de CLÔTURE, volontairement distinct d'« annulee » :
-- une annulation est décidée à l'avance et la voiture a pu être relouée, alors
-- qu'un client non présenté a immobilisé le véhicule pour rien et laisse son
-- acompte acquis. Les confondre rendrait impossible le repérage des clients à
-- risque et fausserait les statistiques de remplissage.
--
-- Cette migration n'écrit AUCUNE donnée : elle élargit seulement la liste des
-- statuts que la base accepte.

alter table reservations drop constraint if exists reservations_status_check;

alter table reservations add constraint reservations_status_check
  check (status = any (array[
    'option'::text,
    'confirmee'::text,
    'en_cours'::text,
    'terminee'::text,
    'annulee'::text,
    'en_retard'::text,
    'non_presente'::text
  ]));
