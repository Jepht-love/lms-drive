'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_INTERVALS } from '@/lib/maintenance-health'
import { maintenanceType } from '@/lib/maintenance'

// Types qui correspondent à un passage en atelier (immobilisation + RDV
// visible au calendrier/tâches du jour) — carburant et lavage sont trop
// courts pour ça et restent gérés séparément ci-dessous.
const GARAGE_TYPES = new Set(['revision', 'vidange', 'pneus', 'freins', 'reparation', 'carrosserie', 'controle_technique', 'autre'])

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

  // Cycle d'entretien : un entretien (révision/vidange) planifie automatiquement
  // le prochain à +15 000 km (et +12 mois) → pilote les alertes 500/200 km.
  if ((payload.type === 'revision' || payload.type === 'vidange') && payload.km_at_intervention != null) {
    const nextDate = new Date(payload.date)
    nextDate.setMonth(nextDate.getMonth() + SERVICE_INTERVALS.entretien.months)
    await supabase
      .from('vehicles')
      .update({
        next_service_km: payload.km_at_intervention + SERVICE_INTERVALS.entretien.km,
        next_service_date: nextDate.toISOString().slice(0, 10),
      })
      .eq('id', vehicleId)
  }

  // Met à jour la date de dernier lavage
  if (payload.type === 'lavage') {
    await supabase.from('vehicles').update({ last_wash_date: payload.date }).eq('id', vehicleId)
  }

  // Intervention atelier (hors carburant/lavage) → RDV visible au calendrier
  // et tâches du jour, + immobilisation si le véhicule était disponible et
  // que la date n'est pas déjà passée (sinon c'est un simple historique).
  if (GARAGE_TYPES.has(payload.type)) {
    const { data: vehicle } = await supabase
      .from('vehicles').select('brand, model, status').eq('id', vehicleId).single()

    if (vehicle) {
      const admin = createAdminClient()
      const startAt = new Date(`${payload.date}T08:00:00`)
      const endAt = new Date(startAt.getTime() + 60 * 60_000)
      const today = new Date().toISOString().slice(0, 10)
      const isUpcoming = payload.date >= today

      await admin.from('calendar_events').insert({
        title: `${maintenanceType(payload.type).label} — ${vehicle.brand} ${vehicle.model}`,
        event_type: 'rdv_garage',
        status: isUpcoming ? 'a_faire' : 'termine',
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        vehicle_ids: [vehicleId],
        notes: payload.description,
      })

      if (isUpcoming && vehicle.status === 'disponible') {
        await supabase.from('vehicles').update({ status: 'maintenance' }).eq('id', vehicleId)
      }
    }
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
  revalidatePath('/')
  revalidatePath('/calendrier')
  revalidatePath('/vehicles')
  return { success: true }
}
