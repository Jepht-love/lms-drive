-- 061 — Anti-doublon contrats (ticket SAV 23/07 : alerte fantôme « CONTRAT À SIGNER »)
-- La page d'EDL départ créait un contrat pendant son affichage ; deux chargements
-- simultanés produisaient deux contrats pour la même réservation (ex. RES-2607-9768 :
-- CTR-2607-2893 signé + CTR-2607-7001 orphelin jamais signé).

-- 1) Supprime le doublon orphelin (jamais signé, sans PDF) qui déclenche l'alerte
DELETE FROM contracts
 WHERE contract_number = 'CTR-2607-7001'
   AND status = 'a_signer'
   AND client_signature_svg IS NULL;

-- 2) Verrous : un seul contrat par réservation, une seule convention par opération
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contracts_reservation
  ON contracts (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_contracts_inter_agency
  ON contracts (inter_agency_rental_id)
  WHERE inter_agency_rental_id IS NOT NULL;
