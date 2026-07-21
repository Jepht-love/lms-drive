-- Facture de restitution signée sur la page de l'EDL retour (ticket SAV 21/07) :
-- le client signe l'EDL retour ET la facture des frais (dommages, retard, km sup).
alter table inspections add column if not exists invoice_signature_svg text;

comment on column inspections.invoice_signature_svg is
  'Signature client de la facture de restitution (EDL retour uniquement, null si aucun frais)';
