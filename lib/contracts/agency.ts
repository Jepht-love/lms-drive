// ─── Réglages agence (singleton agency_settings) ──────────────────────────────
// Source unique pour l'en-tête des contrats / PDF et les tarifs par défaut.
// Tant que la table n'existe pas (migration 007), on retombe sur AGENCY_DEFAULTS.

export interface AgencySettings {
  company_name: string
  siret: string | null
  address: string | null
  phone: string | null
  email: string | null
  extra_km_rate: number
  late_hourly_rate: number
  late_daily_rate: number
  fuel_rate_per_liter: number
  default_deposit: number
  insurance_deductible: number
}

export const AGENCY_DEFAULTS: AgencySettings = {
  company_name: 'LMS Agency',
  siret: '99160973600012',
  address: '2 rue Jean Zay 94380 Bonneuil-Sur-Marne',
  phone: null,
  email: null,
  extra_km_rate: 0.3,
  late_hourly_rate: 15,
  late_daily_rate: 80,
  fuel_rate_per_liter: 2.2,
  default_deposit: 500,
  insurance_deductible: 800,
}

// supabase: SupabaseClient (typé `any` pour éviter l'import croisé serveur/client)
export async function getAgencySettings(supabase: any): Promise<AgencySettings> {
  try {
    const { data } = await supabase
      .from('agency_settings')
      .select('*')
      .limit(1)
      .maybeSingle()
    return data ? { ...AGENCY_DEFAULTS, ...data } : AGENCY_DEFAULTS
  } catch {
    return AGENCY_DEFAULTS
  }
}
