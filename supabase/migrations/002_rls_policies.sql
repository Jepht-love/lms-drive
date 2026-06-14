-- ═══════════════════════════════════════════════════════
-- LMS DRIVE — Row Level Security (RLS)
-- À exécuter APRÈS 001_initial_schema.sql
-- ═══════════════════════════════════════════════════════

-- Activer RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES : chacun lit son profil, gerant lit tout
CREATE POLICY "profiles_own_read" ON profiles FOR SELECT
  USING (id = auth.uid() OR get_user_role() = 'gerant');
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- VEHICLES
CREATE POLICY "vehicles_read_all" ON vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "vehicles_write_managers" ON vehicles FOR ALL
  USING (get_user_role() IN ('gerant', 'associe'));

-- CLIENTS
CREATE POLICY "clients_managers" ON clients FOR ALL
  USING (get_user_role() IN ('gerant', 'associe'));

-- RESERVATIONS
CREATE POLICY "reservations_read_all" ON reservations FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "reservations_write_managers" ON reservations FOR ALL
  USING (get_user_role() IN ('gerant', 'associe'));

-- CONTRACTS
CREATE POLICY "contracts_managers" ON contracts FOR ALL
  USING (get_user_role() IN ('gerant', 'associe'));

-- INSPECTIONS
CREATE POLICY "inspections_managers_read" ON inspections FOR SELECT
  USING (get_user_role() IN ('gerant', 'associe'));
CREATE POLICY "inspections_all_insert" ON inspections FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "inspections_own_read" ON inspections FOR SELECT
  USING (performed_by = auth.uid());

-- INSPECTION_PHOTOS
CREATE POLICY "photos_all_insert" ON inspection_photos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "photos_managers_read" ON inspection_photos FOR SELECT
  USING (get_user_role() IN ('gerant', 'associe'));
CREATE POLICY "photos_own_read" ON inspection_photos FOR SELECT
  USING (taken_by = auth.uid());

-- INCIDENTS
CREATE POLICY "incidents_read_all" ON incidents FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "incidents_create_all" ON incidents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "incidents_update_gerant" ON incidents FOR UPDATE
  USING (get_user_role() = 'gerant');

-- INTERNAL_TRIPS
CREATE POLICY "trips_own" ON internal_trips FOR ALL
  USING (user_id = auth.uid() OR get_user_role() = 'gerant');

-- NOTIFICATIONS
CREATE POLICY "notifs_own" ON notifications FOR ALL
  USING (user_id = auth.uid());

-- AUDIT_LOGS
CREATE POLICY "audit_insert_all" ON audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "audit_read_gerant" ON audit_logs FOR SELECT
  USING (get_user_role() = 'gerant');

-- ═══════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES
  ('vehicle-photos', 'vehicle-photos', false),
  ('client-documents', 'client-documents', false),
  ('contracts-pdf', 'contracts-pdf', false),
  ('vehicle-reference', 'vehicle-reference', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies : utilisateurs authentifiés
CREATE POLICY "auth_upload_vehicle_photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth_read_vehicle_photos" ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "managers_client_documents" ON storage.objects FOR ALL
  USING (bucket_id = 'client-documents' AND get_user_role() IN ('gerant', 'associe'));

CREATE POLICY "auth_contracts_pdf" ON storage.objects FOR ALL
  USING (bucket_id = 'contracts-pdf' AND auth.uid() IS NOT NULL);

CREATE POLICY "auth_vehicle_reference" ON storage.objects FOR ALL
  USING (bucket_id = 'vehicle-reference' AND auth.uid() IS NOT NULL);
