-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Migration 009 (SESSION 5)
-- Partenariats : agences partenaires + opérations inter-agences
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS partner_agencies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  contact_name TEXT,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  siret        TEXT,
  notes        TEXT,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inter_agency_rentals (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction                    TEXT NOT NULL CHECK (direction IN ('out','in')),
  partner_agency_id            UUID REFERENCES partner_agencies(id),
  vehicle_id                   UUID REFERENCES vehicles(id),
  external_vehicle_description TEXT,
  client_reservation_id        UUID REFERENCES reservations(id),
  start_date                   TIMESTAMPTZ NOT NULL,
  end_date_expected            TIMESTAMPTZ NOT NULL,
  end_date_actual              TIMESTAMPTZ,
  departure_km                 INTEGER,
  return_km                    INTEGER,
  fuel_level_departure         INTEGER DEFAULT 8,
  fuel_level_return            INTEGER DEFAULT NULL,
  rental_cost                  NUMERIC DEFAULT 0,
  client_price                 NUMERIC DEFAULT 0,
  margin                       NUMERIC GENERATED ALWAYS AS (client_price - rental_cost) STORED,
  deposit_amount               NUMERIC DEFAULT 0,
  deposit_returned             BOOLEAN DEFAULT false,
  status                       TEXT NOT NULL DEFAULT 'en_cours'
                               CHECK (status IN ('planifie','en_cours','termine','litige','cloture')),
  departure_damages            JSONB DEFAULT '{}',
  return_damages               JSONB DEFAULT '{}',
  notes                        TEXT,
  created_at                   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_iar_partner   ON inter_agency_rentals(partner_agency_id);
CREATE INDEX IF NOT EXISTS idx_iar_vehicle   ON inter_agency_rentals(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_iar_direction ON inter_agency_rentals(direction);

-- Note de disponibilité véhicule (D1)
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS availability_note TEXT;

-- RLS — lecture tous authentifiés, écriture managers
ALTER TABLE partner_agencies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inter_agency_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_agencies_read"  ON partner_agencies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "partner_agencies_write" ON partner_agencies FOR ALL    USING (get_user_role() IN ('gerant','associe'));
CREATE POLICY "iar_read"  ON inter_agency_rentals FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "iar_write" ON inter_agency_rentals FOR ALL    USING (get_user_role() IN ('gerant','associe'));
