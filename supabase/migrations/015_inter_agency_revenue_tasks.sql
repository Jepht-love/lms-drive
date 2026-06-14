-- ── Migration 015 : CA inter-agences + statuts tâches ──────────────────────

-- Colonnes revenus/dépenses sur les opérations inter-agences
ALTER TABLE inter_agency_rentals
  ADD COLUMN IF NOT EXISTS revenue_amount  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expense_amount  NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes           TEXT          DEFAULT NULL;

-- Statut vehicles : s'assurer que le check inclut tous les nouveaux statuts
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check
  CHECK (status IN (
    'disponible','loue','reserve','maintenance','hors_service',
    'en_verification','immobilise','mis_a_disposition'
  ));

-- Statut tâches : ajouter les valeurs kanban si pas déjà présentes
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('a_faire','en_cours','termine','reporte','annule'));

-- Index pour les rapports CA par période
CREATE INDEX IF NOT EXISTS idx_reservations_status_start
  ON reservations (status, start_datetime)
  WHERE status = 'terminee';

CREATE INDEX IF NOT EXISTS idx_inter_agency_status_start
  ON inter_agency_rentals (status, start_date, direction)
  WHERE status = 'completee' AND direction = 'out';
