'use server'

// ─── Les grilles tarifaires, côté écriture ────────────────────────────────────
//
// À quoi sert ce fichier : créer, renommer et régler une grille, y attacher ou
// en retirer une voiture, et corriger les tarifs d'une voiture depuis la grille.
//
// **Un seul endroit pour changer un prix** (décision de Jeff du 02/08/2026) :
// c'est cet écran. La fiche du véhicule garde les tarifs en lecture seule.
//
// Qui a le droit : **administrateur et gérant seulement**. Un associé consulte,
// il ne fixe pas les prix.
//
// Ce qu'il ne faut pas casser : supprimer une grille ne supprime aucune voiture
// (`ON DELETE SET NULL` en base). Une voiture sans grille facture ses propres
// valeurs, exactement comme avant l'existence des grilles.
//
// Chaque mouvement laisse une trace dans le journal d'audit (comme le reste de
// l'appli), pour qu'on sache QUI a changé un prix (demande de Jeff du
// 06/08/2026). La trace ne bloque jamais l'action : un journal en échec ne doit
// pas empêcher l'enregistrement du prix.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/** Seuls ces rôles fixent les prix. `is_admin` prime sur le rôle. */
const ROLES_TARIFS = ['gerant']

async function verifieDroit() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: 'Non authentifié' as const, supabase, user: null }
  const { data: profile } = await supabase
    .from('profiles').select('role, is_admin').eq('id', user.id).single()
  const peut = profile?.is_admin || ROLES_TARIFS.includes(profile?.role ?? '')
  if (!peut) return { erreur: 'Seuls le gérant et l’administrateur modifient les tarifs.' as const, supabase, user }
  return { erreur: null, supabase, user }
}

/**
 * Les valeurs communes, lues du formulaire. Vide veut dire « non renseigné ».
 *
 * ⚠️ Un champ ABSENT du formulaire n'est pas touché, un champ vide l'est. La
 * nuance compte : « retard à la journée » a quitté l'écran le 03/08/2026, et
 * sans cette précaution, enregistrer une grille aurait effacé sa valeur en base
 * sans que personne ne l'ait demandé.
 */
function valeursCommunes(formData: FormData) {
  const nombre = (cle: string) => {
    const brut = (formData.get(cle) as string | null)?.trim()
    if (!brut) return null
    const n = parseFloat(brut.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  const valeurs: Record<string, number | null> = {}
  for (const cle of ['late_hourly_rate', 'late_daily_rate', 'fuel_rate_per_liter', 'insurance_deductible']) {
    if (formData.get(cle) != null) valeurs[cle] = nombre(cle)
  }
  return valeurs
}

/**
 * Trace un mouvement de grille dans le journal d'audit, au même format que le
 * reste de l'appli (`user_id`, `action`, `entity_type`, `entity_id`, `metadata`).
 * On n'attend PAS son résultat au sens où un échec n'est pas remonté : une trace
 * manquante vaut mieux qu'un prix refusé. La règle `audit_insert_self`
 * (migration 063) exige `user_id = auth.uid()`, d'où le passage de l'identifiant.
 */
async function journal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown>,
) {
  await supabase.from('audit_logs').insert({
    user_id: userId, action, entity_type: entityType, entity_id: entityId, metadata,
  })
}

export async function creerGrille(formData: FormData) {
  const { erreur, supabase, user } = await verifieDroit()
  if (erreur || !user) return { error: erreur ?? 'Non authentifié' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Donnez un nom à la grille.' }

  const { data, error } = await supabase
    .from('pricing_grids')
    .insert({ name, ...valeursCommunes(formData) })
    .select('id').single()
  if (error) return { error: error.message }

  await journal(supabase, user.id, 'grille_created', 'pricing_grids', data.id, { name })

  revalidatePath('/settings')
  return { success: true }
}

export async function majGrille(grilleId: string, formData: FormData) {
  const { erreur, supabase, user } = await verifieDroit()
  if (erreur || !user) return { error: erreur ?? 'Non authentifié' }

  const name = (formData.get('name') as string)?.trim()
  const valeurs = valeursCommunes(formData)
  const { error } = await supabase
    .from('pricing_grids')
    .update({
      ...(name ? { name } : {}),
      ...valeurs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', grilleId)
  if (error) return { error: error.message }

  await journal(supabase, user.id, 'grille_updated', 'pricing_grids', grilleId, { name: name ?? null, ...valeurs })

  revalidatePath('/settings')
  revalidatePath('/vehicles')
  return { success: true }
}

/**
 * Supprime une grille. Les voitures qui y étaient rattachées **restent**, elles
 * repartent simplement sans grille et facturent leurs propres valeurs.
 */
export async function supprimerGrille(grilleId: string) {
  const { erreur, supabase, user } = await verifieDroit()
  if (erreur || !user) return { error: erreur ?? 'Non authentifié' }

  const { error } = await supabase.from('pricing_grids').delete().eq('id', grilleId)
  if (error) return { error: error.message }

  await journal(supabase, user.id, 'grille_deleted', 'pricing_grids', grilleId, {})

  revalidatePath('/settings')
  revalidatePath('/vehicles')
  return { success: true }
}

/**
 * Attache une voiture à une grille, ou l'en retire (`grilleId` à `null`).
 *
 * **Attacher ne réécrit AUCUN tarif du véhicule** : ses prix restent les siens,
 * la grille ne fournit que les quatre valeurs communes. C'est ce qui garantit
 * qu'aucune facture ne change de montant le jour où le gérant range ses voitures.
 */
export async function attacherVehicule(vehicleId: string, grilleId: string | null) {
  const { erreur, supabase, user } = await verifieDroit()
  if (erreur || !user) return { error: erreur ?? 'Non authentifié' }

  const { error } = await supabase
    .from('vehicles').update({ pricing_grid_id: grilleId }).eq('id', vehicleId)
  if (error) return { error: error.message }

  await journal(
    supabase, user.id,
    grilleId ? 'vehicle_grid_attached' : 'vehicle_grid_detached',
    'vehicles', vehicleId, { pricing_grid_id: grilleId },
  )

  revalidatePath('/settings')
  revalidatePath('/vehicles')
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true }
}

/**
 * Corrige les tarifs d'une voiture **depuis l'écran des grilles**, seul endroit
 * où un prix se modifie désormais.
 *
 * Attend l'identifiant du véhicule et les neuf valeurs. Une case vide efface la
 * valeur (le véhicule n'a alors plus de prix propre) ; **zéro est une valeur
 * valable**, elle veut dire « inclus, sans supplément ».
 */
export async function majTarifsVehicule(vehicleId: string, valeurs: Record<string, string>) {
  const { erreur, supabase, user } = await verifieDroit()
  if (erreur || !user) return { error: erreur ?? 'Non authentifié' }

  const CHAMPS_AUTORISES = [
    'daily_price', 'price_day_weekend', 'price_weekend_full', 'weekly_price',
    'deposit_amount', 'extra_km_price', 'km_included_daily', 'km_included_week',
    'unlimited_km_price',
  ]
  const ENTIERS = ['km_included_daily', 'km_included_week']

  const patch: Record<string, number | null> = {}
  for (const [cle, brut] of Object.entries(valeurs)) {
    if (!CHAMPS_AUTORISES.includes(cle)) continue
    const txt = (brut ?? '').trim()
    if (!txt) { patch[cle] = null; continue }
    const n = ENTIERS.includes(cle)
      ? parseInt(txt, 10)
      : parseFloat(txt.replace(',', '.'))
    patch[cle] = Number.isFinite(n) ? n : null
  }
  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await supabase.from('vehicles').update(patch).eq('id', vehicleId)
  if (error) return { error: error.message }

  // La trace la plus importante pour le gérant : qui a changé quel prix, et vers
  // quelle valeur. `patch` porte exactement les champs modifiés.
  await journal(supabase, user.id, 'vehicle_prices_updated', 'vehicles', vehicleId, patch)

  revalidatePath('/settings')
  revalidatePath('/vehicles')
  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/reservations')
  return { success: true }
}
