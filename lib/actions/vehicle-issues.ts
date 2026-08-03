'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recomputeVehicleStatus } from '@/lib/vehicles/vehicleStatus'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPeriodOpen } from '@/lib/accounting/period-lock'
import type { MaintenanceFlag } from '@/types/database'
import { expenseCategoryForDamageType, maintenanceTypeForDamageType, damageTypeLabel, damageOriginLabel } from '@/lib/vehicles/damage-catalog'

type NewIssue = Omit<MaintenanceFlag, 'id' | 'created_at'>

// Poste comptable d'une réparation. Depuis le 30/07/2026 il vient du type du
// catalogue ; les dégâts saisis AVANT n'en ont pas, on retombe alors sur l'ancienne
// lecture des mots du libellé pour ne pas les envoyer tous dans « réparations ».
function expenseCategoryForDamage(flag: { category?: string; label?: string; damage_type?: string | null }): string {
  if (flag.damage_type) return expenseCategoryForDamageType(flag.damage_type)
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
    // Qui a déclaré le dégât. Posé ici, côté serveur : c'est le seul endroit où
    // l'identité est certaine, un écran pourrait envoyer n'importe quoi.
    reported_by: i.reported_by ?? user.id,
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
 * Corrige une déclaration de dommage déjà enregistrée (remarque 35 de Jeff,
 * 01/08/2026). Un dommage se saisit à chaud, souvent depuis le téléphone : une
 * faute de frappe, un type mal choisi ou une gravité trop forte devaient pouvoir
 * se rattraper sans supprimer la ligne et la refaire.
 *
 * Ce qu'elle attend : le véhicule, le dégât, et les seuls champs à changer.
 * Ce qu'elle produit : le dégât corrigé dans `vehicles.maintenance_flags`.
 *
 * Deux garde-fous, qui protègent des chiffres déjà écrits ailleurs :
 *   · Un dommage RÉPARÉ ne se modifie plus. Sa dépense est déjà en comptabilité,
 *     dans un poste déduit de son type : le changer ferait mentir l'écriture.
 *   · Un dommage venu d'un ÉTAT DES LIEUX garde son type et son origine. Ce sont
 *     eux qui ont déterminé ce que le client a payé sur sa facture de restitution ;
 *     seuls le libellé et la gravité restent libres.
 *
 * Un dommage déjà confié à une intervention reste modifiable : rien n'est encore
 * écrit en comptabilité tant que le garage n'a pas facturé.
 */
export async function updateVehicleIssue(
  vehicleId: string,
  flagId: string,
  patch: {
    label?: string; damage_type?: string; origin?: string
    severity?: MaintenanceFlag['severity']
    /** Devis du garage, estimé dès la déclaration (Jeff, 02/08/2026). `null` l'efface. */
    quote_amount?: number | null
  },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { flags } = await loadFlags(supabase, vehicleId)
  const target = flags.find(f => f.id === flagId)
  if (!target) return { error: 'Dommage introuvable' }
  if (target.repaired_at) return { error: 'Ce dommage a déjà été réparé, il ne peut plus être modifié' }

  const label = patch.label?.trim()
  if (patch.label !== undefined && !label) return { error: 'Le dommage constaté ne peut pas être vide' }

  const venuDunEtatDesLieux = target.source === 'inspection'
  const corrige: MaintenanceFlag = {
    ...target,
    ...(label ? { label } : {}),
    ...(patch.severity ? { severity: patch.severity } : {}),
    // Le devis se corrige toujours, même sur un dégât venu d'un état des lieux :
    // c'est le garage qui le donne, il n'a rien à voir avec ce qui a été facturé
    // au client (02/08/2026).
    ...(patch.quote_amount !== undefined ? { quote_amount: patch.quote_amount } : {}),
    ...(venuDunEtatDesLieux ? {} : {
      ...(patch.damage_type ? { damage_type: patch.damage_type } : {}),
      ...(patch.origin ? { origin: patch.origin } : {}),
    }),
  }

  const { error } = await supabase
    .from('vehicles')
    .update({ maintenance_flags: flags.map(f => (f.id === flagId ? corrige : f)) })
    .eq('id', vehicleId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'vehicle_damage_updated',
    entity_type: 'vehicles',
    entity_id: vehicleId,
    metadata: { flag_id: flagId, avant: { label: target.label, damage_type: target.damage_type, origin: target.origin, severity: target.severity } },
  })

  revalidatePath('/vehicles')
  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/maintenance')
  revalidatePath(`/maintenance/${vehicleId}`)
  return { success: true }
}

/**
 * Enregistre le DEVIS du garage sur un dégât, avant réparation.
 *
 * N'écrit rien en comptabilité et ne solde rien : un devis n'est pas une dépense,
 * le garage ne facture qu'une fois la réparation faite. Le dégât reste actif et
 * continue d'appeler une intervention. Ajouté le 30/07/2026.
 *
 * Passer `null` efface le devis (devis annulé, ou saisie erronée).
 */
export async function setDamageQuote(vehicleId: string, flagId: string, amount: number | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { flags } = await loadFlags(supabase, vehicleId)
  const target = flags.find(f => f.id === flagId)
  if (!target) return { error: 'Dommage introuvable' }
  if (target.repaired_at) return { error: 'Ce dommage a déjà été réparé' }

  const value = amount != null && amount > 0 ? amount : null
  const updated = flags.map(f => (f.id === flagId ? { ...f, quote_amount: value } : f))

  const { error } = await supabase
    .from('vehicles')
    .update({ maintenance_flags: updated })
    .eq('id', vehicleId)
  if (error) return { error: error.message }

  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath(`/maintenance/${vehicleId}`)
  return { success: true }
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
  if (!target) return { error: 'Dommage introuvable' }
  if (target.repaired_at) return { error: 'Ce dommage a déjà été réparé' }

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
      notes: `Réparation : ${target.label}${note ? ` · ${note}` : ''}`,
      created_by: user.id,
    })
    if (txErr) return { error: txErr.message }
  }

  // Le dégât réparé RESTE dans la liste, marqué de sa date et de son coût — il ne
  // s'efface plus (décision de Jeff du 30/07/2026). C'est ce qui permet de comparer
  // ce qui a été facturé au client et ce que la réparation a coûté, de garder
  // l'historique du véhicule, et d'empêcher qu'un même dégât soit réparé deux fois.
  const repairedAt = (repair?.date || new Date().toISOString().slice(0, 10)).slice(0, 10)
  const updated = flags.map(f =>
    f.id === flagId
      ? { ...f, repaired_at: repairedAt, repair_cost: amount > 0 ? amount : null }
      : f,
  )

  const { error } = await supabase
    .from('vehicles')
    .update({ maintenance_flags: updated })
    .eq('id', vehicleId)
  if (error) return { error: error.message }

  // Une réparation laisse sa trace dans l'HISTORIQUE D'ENTRETIEN du véhicule, pas
  // seulement en comptabilité : c'est là qu'on lit le passé d'une voiture. Ajouté
  // le 31/07/2026, la réparation d'un dégât n'y apparaissait nulle part.
  // `paid_at` reste vide : la dépense a déjà été écrite plus haut, la renseigner
  // ici la compterait deux fois.
  const { error: histErr } = await supabase.from('maintenance_records').insert({
    vehicle_id: vehicleId,
    type: maintenanceTypeForDamageType(target.damage_type),
    description: target.label,
    date: repairedAt,
    amount,
    notes: [
      damageTypeLabel(target.damage_type),
      `origine ${damageOriginLabel(target.origin).toLowerCase()}`,
      target.billed_amount != null ? `facturé ${target.billed_amount} € au client` : null,
      target.quote_amount != null ? `devis ${target.quote_amount} €` : null,
      repair?.note?.trim() || null,
    ].filter(Boolean).join(' · '),
  })
  // L'historique ne doit jamais faire échouer la réparation : le dégât est déjà
  // soldé et la dépense écrite. On avale l'erreur plutôt que de laisser Jeff avec
  // un écran en échec sur une opération qui, elle, a bien eu lieu.
  if (histErr) console.error('historique entretien non écrit', histErr.message)

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
