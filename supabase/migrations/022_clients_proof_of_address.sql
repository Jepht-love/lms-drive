-- Ajoute le justificatif de domicile aux pièces justificatives du client.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS proof_of_address_path TEXT;
