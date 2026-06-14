'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createMaintenanceRecord(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const vehicleId = formData.get('vehicle_id') as string
  if (!vehicleId) return { error: 'Véhicule manquant' }

  const kmRaw     = (formData.get('km_at_intervention') as string)?.trim()
  const amountRaw = (formData.get('amount') as string)?.trim()
  const km     = kmRaw ? parseInt(kmRaw, 10) : null
  const amount = amountRaw ? parseFloat(amountRaw.replace(',', '.')) : 0

  const payload = {
    vehicle_id:         vehicleId,
    type:               (formData.get('type') as string) || 'autre',
    description:        (formData.get('description') as string)?.trim() || null,
    date:               (formData.get('date') as string) || new Date().toISOString().slice(0, 10),
    km_at_intervention: Number.isFinite(km as number) ? km : null,
    amount:             Number.isFinite(amount) ? amount : 0,
    provider:           (formData.get('provider') as string)?.trim() || null,
    notes:              (formData.get('notes') as string)?.trim() || null,
  }

  const { data, error } = await supabase
    .from('maintenance_records')
    .insert(payload)
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Avance le km courant du véhicule si l'intervention est plus récente
  if (payload.km_at_intervention != null) {
    await supabase
      .from('vehicles')
      .update({ current_km: payload.km_at_intervention })
      .eq('id', vehicleId)
      .lt('current_km', payload.km_at_intervention)
  }

  // Met à jour la date de dernier lavage
  if (payload.type === 'lavage') {
    await supabase.from('vehicles').update({ last_wash_date: payload.date }).eq('id', vehicleId)
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'maintenance_created',
    entity_type: 'maintenance_records',
    entity_id: data.id,
    metadata: { vehicle_id: vehicleId, type: payload.type, amount: payload.amount },
  })

  revalidatePath(`/maintenance/${vehicleId}`)
  revalidatePath('/maintenance')
  return { success: true }
}
