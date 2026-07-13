'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recomputeVehicleStatus } from '@/lib/vehicles/vehicleStatus'
import type { MaintenanceFlag } from '@/types/database'

type NewIssue = Omit<MaintenanceFlag, 'id' | 'created_at'>

async function loadFlags(supabase: Awaited<ReturnType<typeof createClient>>, vehicleId: string) {
  const { data } = await supabase
    .from('vehicles')
    .select('status, maintenance_flags')
    .eq('id', vehicleId)
    .single()
  return {
    status: (data?.status as string) ?? 'disponible',
    flags: (data?.maintenance_flags as MaintenanceFlag[] | null) ?? [],
  }
}

/** Ajoute des dégradations au véhicule (badge « Dégradé »). Ne change PAS le statut. */
export async function reportVehicleIssues(vehicleId: string, issues: NewIssue[], sourceId: string | null = null) {
  if (!vehicleId || issues.length === 0) return { success: true }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { flags } = await loadFlags(supabase, vehicleId)
  const now = new Date().toISOString()
  const added: MaintenanceFlag[] = issues.map(i => ({
    ...i,
    id: crypto.randomUUID(),
    created_at: now,
    source_id: i.source_id ?? sourceId,
  }))

  const { error } = await supabase
    .from('vehicles')
    .update({ maintenance_flags: [...flags, ...added] })
    .eq('id', vehicleId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'vehicle_damage_flagged',
    entity_type: 'vehicles',
    entity_id: vehicleId,
    metadata: { count: added.length, source_id: sourceId },
  })

  revalidatePath('/vehicles')
  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/maintenance')
  revalidatePath(`/maintenance/${vehicleId}`)
  return { success: true, count: added.length }
}

/** Résout une dégradation. Si plus aucune et statut « à réparer » → repasse disponible. */
export async function resolveVehicleIssue(vehicleId: string, flagId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { status, flags } = await loadFlags(supabase, vehicleId)
  const remaining = flags.filter(f => f.id !== flagId)

  const update: Record<string, unknown> = { maintenance_flags: remaining }
  if (remaining.length === 0 && status === 'a_reparer') update.status = 'disponible'

  const { error } = await supabase.from('vehicles').update(update).eq('id', vehicleId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'vehicle_issue_resolved',
    entity_type: 'vehicles',
    entity_id: vehicleId,
    metadata: { flag_id: flagId },
  })

  revalidatePath('/vehicles')
  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/maintenance')
  revalidatePath(`/maintenance/${vehicleId}`)
  return { success: true }
}

/**
 * Bascule manuelle « à réparer » ↔ « réparé ».
 * Mise en réparation → statut `a_reparer`.
 * Réparation terminée → on remet le véhicule disponible ET on met à jour l'état
 * mécanique : les dégradations actives sont effacées (le garage les a traitées),
 * puis recompute pour qu'un véhicule encore réservé/loué retrouve son vrai statut.
 */
export async function setVehicleRepairStatus(vehicleId: string, toRepair: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  if (toRepair) {
    const { error } = await supabase.from('vehicles').update({ status: 'a_reparer' }).eq('id', vehicleId)
    if (error) return { error: error.message }
  } else {
    // Réparation terminée : on solde l'état mécanique puis on recalcule le statut réel.
    const { error } = await supabase
      .from('vehicles')
      .update({ status: 'disponible', maintenance_flags: [] })
      .eq('id', vehicleId)
    if (error) return { error: error.message }
    await recomputeVehicleStatus(supabase, vehicleId)
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: toRepair ? 'vehicle_marked_repair' : 'vehicle_repair_cleared',
    entity_type: 'vehicles',
    entity_id: vehicleId,
  })

  revalidatePath('/vehicles')
  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/maintenance')
  return { success: true }
}
