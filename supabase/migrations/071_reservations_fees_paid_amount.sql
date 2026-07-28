-- 071 — Tracer ce qui est encaissé sur les frais de restitution
--
-- Pourquoi : « Reste à payer » ne comptait que le prix de la location. Les frais
-- constatés au retour (km supplémentaires, retard, dégâts) n'y entraient jamais,
-- alors qu'ils se règlent au même moment (demande de Jeff, 27/07/2026).
--
-- Pourquoi une colonne SÉPARÉE plutôt que de gonfler payment_amount : la recette
-- « location » est posée en comptabilité avec payment_amount (updatePaymentInfo).
-- Y verser les frais les compterait deux fois, puisqu'ils sont déjà postés à la
-- clôture dans leurs propres catégories (km_supplementaires, frais_retard,
-- degats). Décision de Jeff du 28/07/2026 : la facture de restitution figure en
-- comptabilité, rattachée à la location, mais pas au même titre que son prix.

alter table reservations
  add column if not exists fees_paid_amount numeric default 0;

comment on column reservations.fees_paid_amount is
  'Montant encaissé sur les frais de restitution (km, retard, dégâts). Distinct de payment_amount, qui ne porte que la location.';
