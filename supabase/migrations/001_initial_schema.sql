-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Schéma initial Phase 1
-- À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────
-- PROFILES (étend auth.users)
-- ───────────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gerant', 'associe', 'employe')),
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────
-- VEHICLES
-- ───────────────────────────────────────────────────────
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  version TEXT,
  year INTEGER,
  color TEXT,
  fuel_type TEXT CHECK (fuel_type IN ('essence', 'diesel', 'hybride', 'electrique')),
  category TEXT CHECK (category IN ('citadine', 'berline', 'suv', 'utilitaire')),
  vin TEXT,
  seats INTEGER DEFAULT 5,
  doors INTEGER DEFAULT 5,
  transmission TEXT CHECK (transmission IN ('manuelle', 'automatique')),
  fiscal_power INTEGER,
  current_km INTEGER DEFAULT 0,
  status TEXT DEFAULT 'disponible' CHECK (status IN ('disponible', 'loue', 'reserve', 'maintenance', 'hors_service')),
  daily_price DECIMAL(10,2),
  weekly_price DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  km_included_daily INTEGER,
  extra_km_price DECIMAL(10,2),
  purchase_value DECIMAL(10,2),
  purchase_date DATE,
  insurance_company TEXT,
  insurance_contract_ref TEXT,
  insurance_expiry DATE,
  ct_date DATE,
  next_service_km INTEGER,
  next_service_date DATE,
  reference_photos JSONB DEFAULT '[]',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────
-- CLIENTS
-- ───────────────────────────────────────────────────────
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  license_number TEXT,
  license_expiry DATE,
  license_categories TEXT[] DEFAULT ARRAY['B'],
  id_doc_type TEXT CHECK (id_doc_type IN ('CNI', 'passeport', 'titre_sejour')),
  id_doc_number TEXT,
  id_doc_front_path TEXT,
  id_doc_back_path TEXT,
  license_front_path TEXT,
  license_back_path TEXT,
  usual_payment_method TEXT CHECK (usual_payment_method IN ('especes', 'virement', 'cb', 'cheque')),
  usual_deposit DECIMAL(10,2),
  status TEXT DEFAULT 'standard' CHECK (status IN ('standard', 'vip', 'blackliste')),
  blacklist_reason TEXT,
  internal_notes TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  acquisition_channel TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────
-- RESERVATIONS
-- ───────────────────────────────────────────────────────
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT UNIQUE NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'option' CHECK (status IN ('option', 'confirmee', 'en_cours', 'terminee', 'annulee', 'en_retard')),
  daily_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  km_included INTEGER,
  extra_km_price DECIMAL(10,2),
  deposit_amount DECIMAL(10,2),
  deposit_method TEXT CHECK (deposit_method IN ('especes', 'virement', 'cb', 'cheque')),
  deposit_ref TEXT,
  deposit_status TEXT DEFAULT 'en_attente' CHECK (deposit_status IN ('en_attente', 'liberee', 'saisie_partielle', 'saisie_totale', 'litigieuse')),
  deposit_deducted DECIMAL(10,2) DEFAULT 0,
  internal_notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────
-- CONTRACTS
-- ───────────────────────────────────────────────────────
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE NOT NULL,
  reservation_id UUID NOT NULL REFERENCES reservations(id),
  status TEXT DEFAULT 'brouillon' CHECK (status IN ('brouillon', 'a_signer', 'signe', 'cloture')),
  client_signature_svg TEXT,
  agent_signature_svg TEXT,
  signed_at TIMESTAMPTZ,
  signed_by UUID REFERENCES profiles(id),
  pdf_storage_path TEXT,
  email_sent_at TIMESTAMPTZ,
  template_snapshot JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────
-- INSPECTIONS (États des lieux)
-- ───────────────────────────────────────────────────────
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  type TEXT NOT NULL CHECK (type IN ('depart', 'arrivee')),
  km_reading INTEGER NOT NULL,
  fuel_level INTEGER NOT NULL CHECK (fuel_level BETWEEN 0 AND 100),
  exterior_cleanliness INTEGER CHECK (exterior_cleanliness BETWEEN 1 AND 5),
  interior_cleanliness INTEGER CHECK (interior_cleanliness BETWEEN 1 AND 5),
  damaged_zones JSONB DEFAULT '[]',
  accessories_ok BOOLEAN DEFAULT true,
  accessories_notes TEXT,
  client_signature_svg TEXT,
  agent_signature_svg TEXT,
  signed_at TIMESTAMPTZ,
  notes TEXT,
  performed_by UUID NOT NULL REFERENCES profiles(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  device_info TEXT
);

-- ───────────────────────────────────────────────────────
-- INSPECTION PHOTOS
-- ───────────────────────────────────────────────────────
CREATE TABLE inspection_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES inspections(id),
  photo_type TEXT NOT NULL,
  zone_id TEXT,
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  taken_by UUID NOT NULL REFERENCES profiles(id)
);

-- ───────────────────────────────────────────────────────
-- INCIDENTS
-- ───────────────────────────────────────────────────────
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  contract_id UUID REFERENCES contracts(id),
  arrival_inspection_id UUID REFERENCES inspections(id),
  description TEXT NOT NULL,
  zones JSONB,
  status TEXT DEFAULT 'ouvert' CHECK (status IN ('ouvert', 'en_cours', 'resolu', 'litigieux', 'classe')),
  responsibility TEXT CHECK (responsibility IN ('client', 'structure', 'indetermine')),
  responsible_client_id UUID REFERENCES clients(id),
  repair_estimate DECIMAL(10,2),
  repair_cost DECIMAL(10,2),
  deposit_deducted DECIMAL(10,2),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────
-- INTERNAL TRIPS
-- ───────────────────────────────────────────────────────
CREATE TABLE internal_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  purpose TEXT NOT NULL CHECK (purpose IN ('livraison', 'recuperation', 'garage', 'preparation', 'personnel', 'autre')),
  purpose_notes TEXT,
  km_start INTEGER NOT NULL,
  km_end INTEGER,
  fuel_start INTEGER,
  fuel_end INTEGER,
  tolls_amount DECIMAL(10,2),
  expenses_amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ───────────────────────────────────────────────────────
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────
-- AUDIT LOGS (append-only)
-- ───────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────
-- INDEXES (performance)
-- ───────────────────────────────────────────────────────
CREATE INDEX idx_reservations_vehicle ON reservations(vehicle_id);
CREATE INDEX idx_reservations_client ON reservations(client_id);
CREATE INDEX idx_reservations_dates ON reservations(start_datetime, end_datetime);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_contracts_reservation ON contracts(reservation_id);
CREATE INDEX idx_inspections_contract ON inspections(contract_id);
CREATE INDEX idx_inspection_photos_inspection ON inspection_photos(inspection_id);
CREATE INDEX idx_internal_trips_vehicle ON internal_trips(vehicle_id);
CREATE INDEX idx_internal_trips_user ON internal_trips(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_clients_search ON clients USING gin (to_tsvector('french', first_name || ' ' || last_name));

-- ───────────────────────────────────────────────────────
-- FONCTIONS ET TRIGGERS
-- ───────────────────────────────────────────────────────

-- Trigger : créer profil à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employe')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger : updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Helper : rôle de l'utilisateur connecté
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
