'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateAgencySettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'gerant') return { error: 'Réservé au gérant' }

  const str = (k: string) => (formData.get(k) as string)?.trim() || null
  const num = (k: string) => {
    const v = (formData.get(k) as string)?.trim()
    if (!v) return null
    const n = parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  const payload = {
    company_name:         str('company_name') ?? 'LMS Agency',
    siret:                str('siret'),
    address:              str('address'),
    phone:                str('phone'),
    email:                str('email'),
    extra_km_rate:        num('extra_km_rate'),
    late_hourly_rate:     num('late_hourly_rate'),
    late_daily_rate:      num('late_daily_rate'),
    fuel_rate_per_liter:  num('fuel_rate_per_liter'),
    default_deposit:      num('default_deposit'),
    insurance_deductible: num('insurance_deductible'),
    updated_at:           new Date().toISOString(),
  }

  // Singleton : update la ligne existante, sinon insert
  const { data: existing } = await supabase
    .from('agency_settings').select('id').limit(1).maybeSingle()

  let error = null
  if (existing) {
    const res = await supabase.from('agency_settings').update(payload).eq('id', existing.id)
    error = res.error
  } else {
    const res = await supabase.from('agency_settings').insert(payload)
    error = res.error
  }
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'agency_settings_updated',
    entity_type: 'agency_settings',
  })

  revalidatePath('/settings')
  return { success: true }
}
