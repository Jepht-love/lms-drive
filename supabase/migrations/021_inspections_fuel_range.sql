-- EDL : remplace la jauge carburant (0-8) par un relevé en km d'autonomie restante
-- (lu sur l'ordinateur de bord du véhicule — plus simple et plus précis).
-- fuel_level est conservé pour l'historique mais n'est plus alimenté par les
-- nouvelles saisies, donc on retire sa contrainte NOT NULL.

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS fuel_range_km INTEGER;
ALTER TABLE inspections ALTER COLUMN fuel_level DROP NOT NULL;
