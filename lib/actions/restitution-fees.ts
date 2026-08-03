'use server'

/**
 * Les écritures sur les frais de restitution du contrat.
 *
 * Réservé au gérant et à l'administrateur, comme les grilles tarifaires : ce
 * sont les montants qu'un locataire signe.
 *
 * ⚠️ Ce qu'il ne faut pas casser :
 * - **Une catégorie est tout ou rien.** Tant qu'elle n'a aucune ligne en base,
 *   le contrat imprime le contrat type écrit dans le code. À la première
 *   modification, `reprendreContratType` recopie les 27 postes d'un coup :
 *   sans ça, modifier une ligne ferait disparaître les 26 autres du contrat.
 * - **Rien ne s'efface.** Retirer un poste pose une date dans `deleted_at` ;
 *   le poste descend dans la corbeille de l'écran et remonte d'un clic.
 * - **Les postes de franchise et de retard gardent leur marque `source`.**
 *   Leur montant ne se saisit pas : il vient de la grille tarifaire du véhicule.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { CONTRAT_TYPE, type ScopeFrais } from '@/lib/contracts/frais-restitution'

const ECRANS = ['/settings/tarifs', '/contracts', '/reservations']

async function exigerGerant() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, erreur: 'Non authentifié' as const }
  const { data: profile } = await supabase
    .from('profiles').select('role, is_admin').eq('id', user.id).single()
  if (!(profile?.is_admin || profile?.role === 'gerant')) {
    return { supabase, erreur: 'Réservé au gérant' as const }
  }
  return { supabase, erreur: null }
}

function rafraichir() {
  for (const e of ECRANS) revalidatePath(e)
}

/**
 * Recopie le contrat type d'une catégorie en base, pour que le gérant parte de
 * quelque chose. Sans effet si la catégorie porte déjà des lignes vivantes.
 */
export async function reprendreContratType(scope: ScopeFrais) {
  const { supabase, erreur } = await exigerGerant()
  if (erreur) return { error: erreur }

  const { count } = await supabase
    .from('restitution_fees')
    .select('id', { count: 'exact', head: true })
    .eq('scope', scope)
    .is('deleted_at', null)
  if ((count ?? 0) > 0) return { error: 'Cette liste est déjà personnalisée.' }

  const lignes = CONTRAT_TYPE[scope].map((p, i) => ({
    scope,
    position: i,
    label: p.label,
    amount: p.amount,
    note: p.note,
    damage_key: p.damageKey,
    source: p.source,
  }))

  const { error } = await supabase.from('restitution_fees').insert(lignes)
  if (error) return { error: error.message }
  rafraichir()
  return { success: true }
}

/** Ajoute un poste à la fin d'une liste. */
export async function ajouterPoste(scope: ScopeFrais) {
  const { supabase, erreur } = await exigerGerant()
  if (erreur) return { error: erreur }

  const { data: dernier } = await supabase
    .from('restitution_fees')
    .select('position')
    .eq('scope', scope)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('restitution_fees').insert({
    scope,
    position: (dernier?.position ?? -1) + 1,
    label: 'Nouveau poste',
    amount: null,
    note: null,
  })
  if (error) return { error: error.message }
  rafraichir()
  return { success: true }
}

/**
 * Modifie un poste. Le montant d'un poste piloté par la grille (franchise,
 * retard) est ignoré : il n'a aucun effet sur le contrat et ne ferait
 * qu'entretenir la confusion.
 */
export async function majPoste(
  id: string,
  patch: { label?: string; amount?: number | null; note?: string | null },
) {
  const { supabase, erreur } = await exigerGerant()
  if (erreur) return { error: erreur }

  const { data: poste } = await supabase
    .from('restitution_fees').select('source').eq('id', id).single()
  if (!poste) return { error: 'Poste introuvable' }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) {
    const label = patch.label.trim()
    if (!label) return { error: 'Le nom du poste ne peut pas être vide.' }
    payload.label = label
  }
  if (patch.note !== undefined) payload.note = patch.note?.trim() || null
  if (patch.amount !== undefined && !poste.source) {
    payload.amount = patch.amount != null && Number.isFinite(patch.amount) ? patch.amount : null
  }

  const { error } = await supabase.from('restitution_fees').update(payload).eq('id', id)
  if (error) return { error: error.message }
  rafraichir()
  return { success: true }
}

/** Met un poste à la corbeille. Il reste visible dans « Postes retirés ». */
export async function retirerPoste(id: string) {
  const { supabase, erreur } = await exigerGerant()
  if (erreur) return { error: erreur }
  const { error } = await supabase
    .from('restitution_fees')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  rafraichir()
  return { success: true }
}

/** Ressort un poste de la corbeille, à sa place d'origine. */
export async function remettrePoste(id: string) {
  const { supabase, erreur } = await exigerGerant()
  if (erreur) return { error: erreur }
  const { error } = await supabase
    .from('restitution_fees')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) return { error: error.message }
  rafraichir()
  return { success: true }
}

/** Fait monter ou descendre un poste d'un cran dans sa liste. */
export async function deplacerPoste(id: string, sens: 'haut' | 'bas') {
  const { supabase, erreur } = await exigerGerant()
  if (erreur) return { error: erreur }

  const { data: poste } = await supabase
    .from('restitution_fees').select('id, scope, position').eq('id', id).single()
  if (!poste) return { error: 'Poste introuvable' }

  const { data: voisin } = await supabase
    .from('restitution_fees')
    .select('id, position')
    .eq('scope', poste.scope)
    .is('deleted_at', null)
    .order('position', { ascending: sens === 'bas' })
    [sens === 'bas' ? 'gt' : 'lt']('position', poste.position)
    .limit(1)
    .maybeSingle()
  if (!voisin) return { success: true }   // déjà en bout de liste

  await supabase.from('restitution_fees').update({ position: poste.position }).eq('id', voisin.id)
  await supabase.from('restitution_fees').update({ position: voisin.position }).eq('id', poste.id)
  rafraichir()
  return { success: true }
}
