-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 008 (SESSION 4)
-- Infractions routières + Sinistres (accidents)
-- ═══════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────
-- INFRACTIONS (amendes)
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS infractions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       UUID REFERENCES vehicles(id),
  reservation_id   UUID REFERENCES reservations(id),
  client_id        UUID REFERENCES clients(id),
  internal_user_id UUID REFERENCES profiles(id),   -- si utilisation interne
  infraction_date  DATE NOT NULL,
  type             TEXT NOT NULL,
  amount           NUMERIC DEFAULT 0,
  points_lost      INTEGER DEFAULT 0,
  reception_date   DATE,
  transmission_date DATE,
  payment_date     DATE,
  admin_fees       NUMERIC DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'en_attente'
                   CHECK (status IN ('en_attente','transmis_client','conteste','regle','cloture')),
  notes            TEXT,
  document_url     TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_infractions_vehicle ON infractions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_infractions_status  ON infractions(status);

-- ───────────────────────────────────────────────────────
-- ACCIDENTS (sinistres)
-- ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accidents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id            UUID REFERENCES vehicles(id),
  reservation_id        UUID REFERENCES reservations(id),
  client_id             UUID REFERENCES clients(id),
  internal_user_id      UUID REFERENCES profiles(id),
  accident_date         DATE NOT NULL,
  description           TEXT NOT NULL,
  dossier_number        TEXT,
  photos                TEXT[] DEFAULT '{}',
  declaration_url       TEXT,
  repair_cost           NUMERIC DEFAULT 0,
  insurance_covered     BOOLEAN DEFAULT false,
  insurance_amount      NUMERIC DEFAULT 0,
  deposit_retained      NUMERIC DEFAULT 0,
  client_responsibility BOOLEAN DEFAULT true,
  status                TEXT NOT NULL DEFAULT 'declare'
                        CHECK (status IN ('declare','en_attente_traitement','en_expertise','en_reparation','en_attente_remboursement','cloture')),
  expert_report_url     TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accidents_vehicle ON accidents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_accidents_status  ON accidents(status);

-- ───────────────────────────────────────────────────────
-- VEHICLES — étendre l'enum statut (en_verification pour B4, mis_a_disposition pour S5)
-- ───────────────────────────────────────────────────────
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_status_check
  CHECK (status IN ('disponible','loue','reserve','maintenance','hors_service','en_verification','mis_a_disposition'));

-- ───────────────────────────────────────────────────────
-- RLS — managers (gérant / associé)
-- ───────────────────────────────────────────────────────
ALTER TABLE infractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accidents   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "infractions_managers" ON infractions FOR ALL
  USING (get_user_role() IN ('gerant','associe'));
CREATE POLICY "accidents_managers" ON accidents FOR ALL
  USING (get_user_role() IN ('gerant','associe'));
