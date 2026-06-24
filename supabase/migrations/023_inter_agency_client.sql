-- Permet d'associer directement un client du répertoire à une opération
-- inter-agences "Entrant", sans dépendre de l'existence d'une réservation
-- classique (souvent absente puisque le véhicule n'est pas le nôtre).
ALTER TABLE inter_agency_rentals ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
