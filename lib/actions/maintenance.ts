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
        await admin.from('vehicles').update({ status: 'maintenance' }).eq('id', vehicleId)
      }
    }
  }

  // Justificatif optionnel (facture garage, devis…) → rangé automatiquement dans
  // Documents › Véhicule. Choix gérant : le document n'apparaît QUE si un fichier
  // est réellement joint (la dépense, elle, va en compta au règlement).
  const justificatif = formData.get('justificatif') as File | null
  if (justificatif && justificatif.size > 0) {
    const ext = justificatif.name.split('.').pop() || 'pdf'
    const path = `vehicule/facture_entretien/${Date.now()}-${vehicleId}.${ext}`
    const ab = await justificatif.arrayBuffer()
    const { error: upErr } = await supabase.storage.from('documents').upload(path, ab, { contentType: justificatif.type })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      const { data: veh } = await supabase.from('vehicles').select('brand, model, plate').eq('id', vehicleId).single()
      const vehLabel = veh ? `${veh.brand} ${veh.model}${veh.plate ? ` (${veh.plate})` : ''}` : ''
      await supabase.from('documents').insert({
        category: 'vehicule',
        subcategory: 'facture_entretien',
        name: `${maintenanceType(payload.type).label} — ${vehLabel} — ${payload.date}`,
        file_url: publicUrl,
        file_type: justificatif.type,
        file_size: justificatif.size,
        entity_id: vehicleId,
        entity_type: 'vehicle',
        is_auto_generated: false,
        created_by: user.id,
      })
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

/**
 * Supprime une intervention d'entretien et nettoie ses artefacts : la charge
 * comptable liée (reference `maintenance:<id>`, si l'intervention avait été
 * réglée) et, best-effort, le RDV garage au calendrier (même véhicule / même
 * jour — ces événements n'ont pas de source_key). Le km véhicule et le prochain
 * entretien planifié ne sont PAS recalculés.
 */
export async function deleteMaintenanceRecord(recordId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, type, date')
    .eq('id', recordId)
    .single()
  if (!rec) return { error: 'Intervention introuvable' }

  const admin = createAdminClient()
  await admin.from('financial_transactions').delete().eq('reference', `maintenance:${recordId}`)

  if (GARAGE_TYPES.has(rec.type)) {
    await admin
      .from('calendar_events')
      .delete()
      .eq('event_type', 'rdv_garage')
      .contains('vehicle_ids', [rec.vehicle_id])
      .gte('start_at', `${rec.date}T00:00:00`)
      .lte('start_at', `${rec.date}T23:59:59`)
  }

  const { error } = await supabase.from('maintenance_records').delete().eq('id', recordId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'maintenance_deleted',
    entity_type: 'maintenance_records', entity_id: recordId, metadata: {},
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/maintenance')
  revalidatePath('/accounting')
  revalidatePath('/calendrier')
  revalidatePath('/')
  return { success: true }
}

// Catégorie comptable selon le type d'intervention (réparation vs entretien courant).
function expenseCategoryFor(type: string): string {
  if (['reparation', 'carrosserie', 'freins'].includes(type)) return 'reparations'
  if (['revision', 'vidange', 'pneus', 'controle_technique'].includes(type)) return 'entretien'
  if (type === 'lavage') return 'lavage'
  if (type === 'carburant') return 'carburant'
  return 'autres_depenses'
}

/**
 * Marque une intervention comme payée et l'enregistre en comptabilité (choix
 * gérant : la dépense n'est bookée qu'au règlement, pas à la saisie). Anti-doublon
 * via `reference = maintenance:<id>` : un 2ᵉ clic ne recrée pas la transaction.
 * Couvre aussi les réparations de sinistre, qui passent par `maintenance_records`.
 */
export async function markMaintenancePaid(recordId: string, method: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, type, description, amount, date, paid_at')
    .eq('id', recordId)
    .single()
  if (!rec) return { error: 'Intervention introuvable' }

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('maintenance_records')
    .update({ paid_at: today, paid_method: method })
    .eq('id', recordId)
  if (error) return { error: error.message }

  const amount = rec.amount ?? 0
  const reference = `maintenance:${rec.id}`
  if (amount > 0) {
    const admin = createAdminClient()
    const { data: dup } = await admin
      .from('financial_transactions').select('id').eq('reference', reference).maybeSingle()
    if (!dup) {
      const { label } = maintenanceType(rec.type)
      const { error: txError } = await admin.from('financial_transactions').insert({
        date: today,
        type: 'depense',
        category: expenseCategoryFor(rec.type),
        amount,
        vehicle_id: rec.vehicle_id,
        payment_method: method,
        notes: `${label}${rec.description ? ` — ${rec.description}` : ''} (${rec.date})`,
        reference,
        created_by: user.id,
      })
      if (txError) return { error: txError.message }
    }
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'maintenance_paid',
    entity_type: 'maintenance_records',
    entity_id: rec.id,
    metadata: { amount, method },
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/maintenance')
  revalidatePath('/accounting')
  return { success: true }
}
