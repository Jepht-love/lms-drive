'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recomputeVehicleStatus } from '@/lib/vehicles/vehicleStatus'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPeriodOpen } from '@/lib/accounting/period-lock'
import type { MaintenanceFlag } from '@/types/database'

type NewIssue = Omit<MaintenanceFlag, 'id' | 'created_at'>

// Catégorie comptable déduite du libellé du dommage (« déjà catégorisé par le
// type de dommage » — pas de sélecteur). Défaut : réparation mécanique.
function expenseCategoryForDamage(flag: { category?: string; label?: string }): string {
  const hay = `${flag.category ?? ''} ${flag.label ?? ''}`.toLowerCase()
  if (/glace|vitre|pare.?brise|bris/.test(hay)) return 'bris_glace'
  if (/carross|pare.?choc|aile|porti?[eè]re|porte|capot|hayon|r[eé]tro|jante/.test(hay)) return 'carrosserie'
  if (/pneu|roue/.test(hay)) return 'pneumatiques'
  if (/frein|plaquette|disque/.test(hay)) return 'freins'
  return 'reparations'
}

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

/**
 * Solde une dégradation. NE change PAS le statut du véhicule (dissocié de la
 * remise en service — demande gérant). Si un montant de réparation est fourni,
 * on crée la dépense correspondante en compta, liée au véhicule (→ Rentabilité).
 * Tout utilisateur connecté peut solder + saisir le coût : l'écriture passe donc
 * par le client admin (RLS compta = manager) sans garde manager, mais reste
 * strictement contrainte (dépense, montant > 0, période ouverte, journalisée).
 */
export async function resolveVehicleIssue(
  vehicleId: string,
  flagId: string,
  repair?: { amount?: number; date?: string | null; note?: string | null },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { flags } = await loadFlags(supabase, vehicleId)
  const target = flags.find(f => f.id === flagId)
  // Garde-fou : le dommage doit réellement exister sur CE véhicule avant toute
  // écriture (compta ou statut). Bloque un coût posté contre un vehicleId/flagId
  // arbitraire, et évite un double débit si deux personnes soldent le même
  // dommage en même temps (le 2ᵉ ne le trouve plus).
  if (!target) return { error: 'Dommage introuvable ou déjà soldé' }
  const remaining = flags.filter(f => f.id !== flagId)

  // Coût de réparation → écriture de dépense liée au véhicule.
  const amount = repair?.amount && repair.amount > 0 ? repair.amount : 0
  if (amount > 0) {
    const date = (repair?.date || new Date().toISOString().slice(0, 10)).slice(0, 10)
    const locked = await assertPeriodOpen(supabase, date)
    if (locked) return { error: locked }
    const note = repair?.note?.trim()
    const { error: txErr } = await createAdminClient().from('financial_transactions').insert({
      date,
      type: 'depense',
      category: expenseCategoryForDamage(target),
      amount,
      vehicle_id: vehicleId,
      notes: `Réparation : ${target.label}${note ? ` — ${note}` : ''}`,
      created_by: user.id,
    })
    if (txErr) return { error: txErr.message }
  }

  const { error } = await supabase
    .from('vehicles')
    .update({ maintenance_flags: remaining })
    .eq('id', vehicleId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'vehicle_issue_resolved',
    entity_type: 'vehicles',
    entity_id: vehicleId,
    metadata: { flag_id: flagId, repair_cost: amount || null },
  })

  revalidatePath('/vehicles')
  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/maintenance')
  revalidatePath(`/maintenance/${vehicleId}`)
  if (amount > 0) revalidatePath('/accounting')
  return { success: true }
}

/**
 * Bascule manuelle du statut « à réparer » ↔ remise en service.
 * Mise en réparation → statut `a_reparer` (indisponible).
 * Remise en service → statut recalculé (disponible/loué/réservé) SANS toucher aux
 * dégradations : elles restent affichées (badge « Intervenir ») et se soldent une
 * par une avec leur coût — dissocié de la remise en service (demande gérant).
 */
export async function setVehicleRepairStatus(vehicleId: string, toRepair: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  if (toRepair) {
    const { error } = await supabase.from('vehicles').update({ status: 'a_reparer' }).eq('id', vehicleId)
    if (error) return { error: error.message }
  } else {
    // Remise en service : on rend le véhicule disponible SANS toucher aux dommages,
    // puis on recalcule le statut réel (un véhicule encore loué/réservé le reste).
    const { error } = await supabase
      .from('vehicles')
      .update({ status: 'disponible' })
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
