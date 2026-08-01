'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SERVICE_INTERVALS } from '@/lib/maintenance-health'
import { maintenanceType } from '@/lib/maintenance'
import { instantDepuisSaisie } from '@/lib/format/heureAgence'
import { maintenanceTypeForDamageType, expenseCategoryForDamageType } from '@/lib/vehicles/damage-catalog'
import { assertPeriodOpen } from '@/lib/accounting/period-lock'
import type { MaintenanceFlag } from '@/types/database'

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

  // ─── Dégâts rattachés à cette intervention ───────────────────────────────────
  // Ajouté le 01/08/2026. Une intervention peut réparer plusieurs dégâts, chacun
  // avec SON devis : le garage évalue séparément une portière et une vitre, et
  // c'est cette évaluation que la comptabilité doit pouvoir lire ensuite.
  // Aucun montant n'est écrit en comptabilité ici : un devis n'est pas une
  // dépense, elle n'existera qu'au règlement du garage.
  let choisis: { flagId: string; quote: number | null }[] = []
  try {
    const brut = formData.get('damage_flags') as string | null
    if (brut) choisis = JSON.parse(brut)
  } catch {
    return { error: 'Dégâts illisibles' }
  }

  const flagsVehicule = choisis.length > 0
    ? ((await supabase.from('vehicles').select('maintenance_flags').eq('id', vehicleId).single())
        .data?.maintenance_flags as MaintenanceFlag[] | null) ?? []
    : []
  const reparés = flagsVehicule.filter(f => choisis.some(c => c.flagId === f.id))

  // Un dégât déjà pris en charge ou déjà réparé ne doit jamais repartir au garage :
  // ce serait la même réparation payée deux fois.
  if (reparés.some(f => f.repaired_at || f.intervention_id)) {
    return { error: 'Un des dégâts est déjà réparé ou déjà rattaché à une intervention' }
  }
  if (choisis.length > 0 && reparés.length !== choisis.length) {
    return { error: 'Un des dégâts est introuvable sur ce véhicule' }
  }

  const enReparation = reparés.length > 0
  const devisTotal = choisis.reduce((s, c) => s + (c.quote ?? 0), 0)

  // Toutes les réparations d'une même location se rattachent à elle. Dès que les
  // dégâts viennent de locations différentes, on ne rattache rien : la ventilation
  // se fait alors dégât par dégât, pas au niveau de l'intervention.
  const locations = [...new Set(reparés.map(f => f.reservation_id).filter(Boolean))]

  const payload = {
    vehicle_id:         vehicleId,
    // En réparation, le type se déduit du premier dégât : l'agent n'a pas à
    // rechoisir ce que le catalogue sait déjà.
    type: enReparation
      ? maintenanceTypeForDamageType(reparés[0].damage_type)
      : (formData.get('type') as string) || 'autre',
    description: enReparation
      ? reparés.map(f => f.label).join(' · ')
      : (formData.get('description') as string)?.trim() || null,
    date:               (formData.get('date') as string) || new Date().toISOString().slice(0, 10),
    km_at_intervention: Number.isFinite(km as number) ? km : null,
    // Le montant réel reste à 0 tant que le garage n'a pas facturé.
    amount:             enReparation ? 0 : (Number.isFinite(amount) ? amount : 0),
    provider:           (formData.get('provider') as string)?.trim() || null,
    notes:              (formData.get('notes') as string)?.trim() || null,
    ...(enReparation ? {
      quote_amount: devisTotal > 0 ? devisTotal : null,
      quote_status: (formData.get('quote_status') as string) === 'valide' ? 'valide' : 'brouillon',
      reservation_id: locations.length === 1 ? locations[0] : null,
    } : {}),
  }

  const { data, error } = await supabase
    .from('maintenance_records')
    .insert(payload)
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Les dégâts pris en charge portent désormais l'intervention et leur devis.
  if (enReparation) {
    const majFlags = flagsVehicule.map(f => {
      const c = choisis.find(x => x.flagId === f.id)
      return c ? { ...f, intervention_id: data.id, quote_amount: c.quote ?? null } : f
    })
    const { error: flagErr } = await supabase
      .from('vehicles')
      .update({ maintenance_flags: majFlags })
      .eq('id', vehicleId)
    // Une intervention sans ses dégâts serait un fantôme : on annule plutôt que
    // de laisser les deux moitiés se désynchroniser.
    if (flagErr) {
      await supabase.from('maintenance_records').delete().eq('id', data.id)
      return { error: flagErr.message }
    }
  }

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
      // 8 h du matin à l'agence, pas 8 h au fuseau du serveur.
      const startAt = new Date(instantDepuisSaisie(`${payload.date}T08:00:00`))
      const endAt = new Date(startAt.getTime() + 60 * 60_000)
      const today = new Date().toISOString().slice(0, 10)
      const isUpcoming = payload.date >= today

      await admin.from('calendar_events').insert({
        title: `${maintenanceType(payload.type).label} · ${vehicle.brand} ${vehicle.model}`,
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
      const { data: veh } = await supabase.from('vehicles').select('brand, model, plate').eq('id', vehicleId).single()
      const vehLabel = veh ? `${veh.brand} ${veh.model}${veh.plate ? ` (${veh.plate})` : ''}` : ''
      await supabase.from('documents').insert({
        category: 'vehicule',
        subcategory: 'facture_entretien',
        name: `${maintenanceType(payload.type).label} · ${vehLabel} · ${payload.date}`,
        file_url: path,
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
        notes: `${label}${rec.description ? ` · ${rec.description}` : ''} (${rec.date})`,
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

/**
 * Règle une intervention qui répare des DÉGÂTS, avec le montant réellement
 * facturé par le garage, dégât par dégât.
 *
 * Attend l'identifiant de l'intervention, une ligne par dégât (`flagId` et le
 * montant du garage) et le mode de règlement. Produit : les dégâts passent en
 * réparés, l'intervention passe en réglée, et la comptabilité reçoit UNE ÉCRITURE
 * PAR DÉGÂT.
 *
 * Pourquoi une écriture par dégât et non une seule pour l'intervention (règle de
 * Jeff du 01/08/2026) : un même passage au garage peut réparer une rayure due à
 * une location ET une usure du temps. Une écriture globale rendrait impossible de
 * dire ce que le client a remboursé et ce que la société a payé de sa poche, qui
 * est justement toute la question de la rubrique « Dégâts et réparations ».
 *
 * Le moment de l'écriture est le RÈGLEMENT du garage, jamais le devis : tant que
 * le garage n'a pas facturé, aucune dépense n'existe.
 *
 * Ce qu'il ne faut pas casser : la référence `maintenance:<id>:<flagId>` est le
 * garde anti-doublon. La retirer ferait payer deux fois au deuxième clic.
 * `markMaintenancePaid` reste le chemin des entretiens courants, sans dégât.
 */
export async function settleIntervention(
  recordId: string,
  lignes: { flagId: string; amount: number }[],
  method: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: rec } = await supabase
    .from('maintenance_records')
    .select('id, vehicle_id, date, paid_at')
    .eq('id', recordId)
    .single()
  if (!rec) return { error: 'Intervention introuvable' }
  if (rec.paid_at) return { error: 'Cette intervention est déjà réglée' }

  const today = new Date().toISOString().slice(0, 10)
  const locked = await assertPeriodOpen(supabase, today)
  if (locked) return { error: locked }

  const { data: veh } = await supabase
    .from('vehicles').select('maintenance_flags').eq('id', rec.vehicle_id).single()
  const flags = (veh?.maintenance_flags as MaintenanceFlag[] | null) ?? []
  const concernes = flags.filter(f => f.intervention_id === recordId && !f.repaired_at)
  if (concernes.length === 0) return { error: 'Aucun dégât à régler sur cette intervention' }

  const montantDe = (flagId: string) => {
    const l = lignes.find(x => x.flagId === flagId)
    return l && l.amount > 0 ? l.amount : 0
  }
  const total = concernes.reduce((s, f) => s + montantDe(f.id), 0)
  if (total <= 0) return { error: 'Saisissez au moins un montant facturé par le garage' }

  const admin = createAdminClient()
  for (const f of concernes) {
    const m = montantDe(f.id)
    if (m <= 0) continue

    const reference = `maintenance:${recordId}:${f.id}`
    const { data: dup } = await admin
      .from('financial_transactions').select('id').eq('reference', reference).maybeSingle()
    if (dup) continue

    // Un dégât survenu pendant une location mais NON facturé au client (geste
    // commercial, prise en charge par l'assurance) sort de l'origine « location » :
    // sans recette en face, il fausserait le taux d'amortissement des locations.
    const origineCompta = f.origin === 'location' && !(f.billed_amount && f.billed_amount > 0)
      ? 'non_facture'
      : (f.origin ?? 'non_communiquee')

    const { error: txErr } = await admin.from('financial_transactions').insert({
      date: today,
      type: 'depense',
      category: expenseCategoryForDamageType(f.damage_type),
      amount: m,
      vehicle_id: rec.vehicle_id,
      reservation_id: f.reservation_id ?? null,
      payment_method: method,
      damage_origin: origineCompta,
      damage_type: f.damage_type ?? null,
      notes: `Réparation : ${f.label}`,
      reference,
      created_by: user.id,
    })
    if (txErr) return { error: txErr.message }
  }

  // Les dégâts passent en réparés, avec ce qu'ils ont réellement coûté.
  const majFlags = flags.map(f =>
    concernes.some(c => c.id === f.id)
      ? { ...f, repaired_at: today, repair_cost: montantDe(f.id) || null }
      : f,
  )
  const { error: flagErr } = await supabase
    .from('vehicles').update({ maintenance_flags: majFlags }).eq('id', rec.vehicle_id)
  if (flagErr) return { error: flagErr.message }

  const { error: recErr } = await supabase
    .from('maintenance_records')
    .update({ amount: total, paid_at: today, paid_method: method })
    .eq('id', recordId)
  if (recErr) return { error: recErr.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'intervention_settled',
    entity_type: 'maintenance_records',
    entity_id: recordId,
    metadata: { total, method, degats: concernes.length },
  })

  revalidatePath(`/maintenance/${rec.vehicle_id}`)
  revalidatePath('/maintenance')
  revalidatePath(`/vehicles/${rec.vehicle_id}`)
  revalidatePath('/vehicles')
  revalidatePath('/accounting')
  return { success: true, total }
}
