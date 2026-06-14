export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'gerant' | 'associe' | 'employe'
export type VehicleStatus = 'disponible' | 'loue' | 'reserve' | 'maintenance' | 'hors_service' | 'en_verification' | 'immobilise' | 'mis_a_disposition'
export type VehicleFuelType = 'essence' | 'diesel' | 'hybride' | 'electrique'
export type VehicleCategory = 'citadine' | 'suv' | 'sportif'
export type VehicleTransmission = 'manuelle' | 'automatique'
export type ClientStatus = 'standard' | 'vip' | 'blackliste'
export type ReservationStatus = 'option' | 'confirmee' | 'en_cours' | 'terminee' | 'annulee' | 'en_retard'
export type DepositStatus = 'en_attente' | 'liberee' | 'saisie_partielle' | 'saisie_totale' | 'litigieuse'
export type PaymentStatus = 'en_attente' | 'paye' | 'partiel' | 'impaye'
export type PaymentMethod = 'especes' | 'virement' | 'cb' | 'cheque'
export type ContractStatus = 'brouillon' | 'a_signer' | 'signe' | 'cloture'
export type InspectionType = 'depart' | 'arrivee'
export type IncidentStatus = 'ouvert' | 'en_cours' | 'resolu' | 'litigieux' | 'classe'
export type TripPurpose = 'livraison' | 'recuperation' | 'garage' | 'preparation' | 'personnel' | 'autre'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  plate: string
  brand: string
  model: string
  version: string | null
  year: number | null
  color: string | null
  fuel_type: VehicleFuelType | null
  category: VehicleCategory | null
  vin: string | null
  seats: number
  doors: number
  transmission: VehicleTransmission | null
  fiscal_power: number | null
  current_km: number
  status: VehicleStatus
  // Legacy price columns (used by ReservationForm + PDF)
  daily_price: number | null
  weekly_price: number | null
  km_included_daily: number | null
  extra_km_price: number | null
  // Granular pricing
  price_day_week: number | null
  price_day_weekend: number | null
  price_weekend_full: number | null
  price_week: number | null
  km_included_day: number | null
  km_included_weekend: number | null
  km_included_week: number | null
  km_extra_price: number | null
  is_smart_fortwo: boolean
  deposit_amount: number | null
  purchase_value: number | null
  purchase_date: string | null
  insurance_company: string | null
  insurance_contract_ref: string | null
  insurance_expiry: string | null
  ct_date: string | null
  next_service_km: number | null
  next_service_date: string | null
  reference_photos: string[]
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  email: string | null
  phone: string
  license_number: string | null
  license_expiry: string | null
  license_categories: string[]
  id_doc_type: 'CNI' | 'passeport' | 'titre_sejour' | null
  id_doc_number: string | null
  id_doc_front_path: string | null
  id_doc_back_path: string | null
  license_front_path: string | null
  license_back_path: string | null
  usual_payment_method: PaymentMethod | null
  usual_deposit: number | null
  status: ClientStatus
  blacklist_reason: string | null
  internal_notes: string | null
  rating: number | null
  acquisition_channel: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Reservation {
  id: string
  reservation_number: string
  vehicle_id: string
  client_id: string
  start_datetime: string
  end_datetime: string
  status: ReservationStatus
  daily_price: number
  total_price: number
  km_included: number | null
  extra_km_price: number | null
  deposit_amount: number | null
  deposit_method: PaymentMethod | null
  deposit_ref: string | null
  deposit_status: DepositStatus
  deposit_deducted: number
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  payment_amount: number | null
  payment_date: string | null
  payment_ref: string | null
  late_minutes: number
  late_fee_amount: number
  late_fee_validated: boolean
  extra_km_count: number
  extra_km_amount: number
  internal_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  vehicle?: Vehicle
  client?: Client
}

export interface Contract {
  id: string
  contract_number: string
  reservation_id: string
  status: ContractStatus
  client_signature_svg: string | null
  agent_signature_svg: string | null
  signed_at: string | null
  signed_by: string | null
  pdf_storage_path: string | null
  email_sent_at: string | null
  template_snapshot: Json | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  reservation?: Reservation
}

export interface DamagedZone {
  id: string
  label: string
  severity: 'rayure' | 'dommage' | 'attention'
  description: string
  photos: string[]
}

export interface Inspection {
  id: string
  contract_id: string
  vehicle_id: string
  type: InspectionType
  km_reading: number
  fuel_level: number
  exterior_cleanliness: number | null
  interior_cleanliness: number | null
  damaged_zones: DamagedZone[]
  accessories_ok: boolean
  accessories_notes: string | null
  client_signature_svg: string | null
  agent_signature_svg: string | null
  signed_at: string | null
  notes: string | null
  performed_by: string
  performed_at: string
  device_info: string | null
}

export interface InspectionPhoto {
  id: string
  inspection_id: string
  photo_type: string
  zone_id: string | null
  storage_path: string
  file_size_bytes: number | null
  taken_at: string
  taken_by: string
}

export interface Incident {
  id: string
  vehicle_id: string
  contract_id: string | null
  arrival_inspection_id: string | null
  description: string
  zones: Json | null
  status: IncidentStatus
  responsibility: 'client' | 'structure' | 'indetermine' | null
  responsible_client_id: string | null
  repair_estimate: number | null
  repair_cost: number | null
  deposit_deducted: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface InternalTrip {
  id: string
  vehicle_id: string
  user_id: string
  start_datetime: string
  end_datetime: string | null
  purpose: TripPurpose
  purpose_notes: string | null
  km_start: number
  km_end: number | null
  fuel_start: number | null
  fuel_end: number | null
  tolls_amount: number | null
  expenses_amount: number | null
  notes: string | null
  created_at: string
  // Joined
  vehicle?: Vehicle
  user?: Profile
}

export interface Notification {
  id: string
  user_id: string | null
  type: 'departure_soon' | 'return_late' | 'maintenance_due' | 'contract_unsigned' | 'incident_open'
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  created_at: string
}

export type DocumentCategory = 'entreprise' | 'vehicule' | 'client' | 'partenaire'

export interface Document {
  id: string
  category: DocumentCategory
  subcategory: string
  name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  entity_id: string | null
  entity_type: string | null
  reservation_id: string | null
  is_auto_generated: boolean
  tags: string[]
  created_by: string | null
  created_at: string
  updated_at: string
  expiry_date: string | null
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Json | null
  device_info: string | null
  created_at: string
}
