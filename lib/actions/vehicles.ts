'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { VehicleStatus } from '@/types/database'

export async function createVehicle(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const payload = {
    plate: formData.get('plate') as string,
    brand: formData.get('brand') as string,
    model: formData.get('model') as string,
    version: formData.get('version') as string || null,
    year: formData.get('year') ? Number(formData.get('year')) : null,
    color: formData.get('color') as string || null,
    fuel_type: formData.get('fuel_type') as string || null,
    category: formData.get('category') as string || null,
    vin: formData.get('vin') as string || null,
    seats: Number(formData.get('seats') ?? 5),
    doors: Number(formData.get('doors') ?? 5),
    transmission: formData.get('transmission') as string || null,
    fiscal_power: formData.get('fiscal_power') ? Number(formData.get('fiscal_power')) : null,
    engine_power: formData.get('engine_power') ? Number(formData.get('engine_power')) : null,
    current_km: Number(formData.get('current_km') ?? 0),
    daily_price: formData.get('daily_price') ? Number(formData.get('daily_price')) : null,
    weekly_price: formData.get('weekly_price') ? Number(formData.get('weekly_price')) : null,
    deposit_amount: formData.get('deposit_amount') ? Number(formData.get('deposit_amount')) : null,
    km_included_daily: formData.get('km_included_daily') ? Number(formData.get('km_included_daily')) : null,
    extra_km_price: formData.get('extra_km_price') ? Number(formData.get('extra_km_price')) : null,
    rental_start_date: formData.get('rental_start_date') as string || null,
    insurance_company: formData.get('insurance_company') as string || null,
    insurance_contract_ref: formData.get('insurance_contract_ref') as string || null,
    insurance_expiry: formData.get('insurance_expiry') as string || null,
    ct_date: formData.get('ct_date') as string || null,
    next_service_km: formData.get('next_service_km') ? Number(formData.get('next_service_km')) : null,
    next_service_date: formData.get('next_service_date') as string || null,
    notes: formData.get('notes') as string || null,
  }

  const { data, error } = await supabase.from('vehicles').insert(payload).select('id').single()
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'vehicle_created',
    entity_type: 'vehicles',
    entity_id: data.id,
    metadata: { plate: payload.plate },
  })

  revalidatePath('/vehicles')
  redirect(`/vehicles/${data.id}`)
}

export async function updateVehicle(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const payload = {
    plate: formData.get('plate') as string,
    brand: formData.get('brand') as string,
    model: formData.get('model') as string,
    version: formData.get('version') as string || null,
    year: formData.get('year') ? Number(formData.get('year')) : null,
    color: formData.get('color') as string || null,
    fuel_type: formData.get('fuel_type') as string || null,
    category: formData.get('category') as string || null,
    vin: formData.get('vin') as string || null,
    seats: Number(formData.get('seats') ?? 5),
    doors: Number(formData.get('doors') ?? 5),
    transmission: formData.get('transmission') as string || null,
    fiscal_power: formData.get('fiscal_power') ? Number(formData.get('fiscal_power')) : null,
    engine_power: formData.get('engine_power') ? Number(formData.get('engine_power')) : null,
    current_km: Number(formData.get('current_km') ?? 0),
    daily_price: formData.get('daily_price') ? Number(formData.get('daily_price')) : null,
    weekly_price: formData.get('weekly_price') ? Number(formData.get('weekly_price')) : null,
    deposit_amount: formData.get('deposit_amount') ? Number(formData.get('deposit_amount')) : null,
    km_included_daily: formData.get('km_included_daily') ? Number(formData.get('km_included_daily')) : null,
    extra_km_price: formData.get('extra_km_price') ? Number(formData.get('extra_km_price')) : null,
    rental_start_date: formData.get('rental_start_date') as string || null,
    insurance_company: formData.get('insurance_company') as string || null,
    insurance_contract_ref: formData.get('insurance_contract_ref') as string || null,
    insurance_expiry: formData.get('insurance_expiry') as string || null,
    ct_date: formData.get('ct_date') as string || null,
    next_service_km: formData.get('next_service_km') ? Number(formData.get('next_service_km')) : null,
    next_service_date: formData.get('next_service_date') as string || null,
    notes: formData.get('notes') as string || null,
  }

  const { error } = await supabase.from('vehicles').update(payload).eq('id', id)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'vehicle_updated',
    entity_type: 'vehicles',
    entity_id: id,
    metadata: { plate: payload.plate },
  })

  revalidatePath(`/vehicles/${id}`)
  revalidatePath('/vehicles')
  redirect(`/vehicles/${id}`)
}

export async function updateVehicleStatus(id: string, status: VehicleStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('vehicles').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'vehicle_status_changed',
    entity_type: 'vehicles',
    entity_id: id,
    metadata: { status },
  })

  revalidatePath(`/vehicles/${id}`)
  revalidatePath('/vehicles')
  return { success: true }
}
