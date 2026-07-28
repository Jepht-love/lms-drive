'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createDueDate(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const description = (formData.get('description') as string)?.trim()
  const type = (formData.get('type') as string) || 'depense'
  const category = (formData.get('category') as string)?.trim()
  const amountRaw = (formData.get('amount') as string)?.trim()
  const amount = amountRaw ? parseFloat(amountRaw.replace(',', '.')) : 0
  const dueDate = (formData.get('due_date') as string)?.trim()
  if (!description || !category || !(amount > 0) || !dueDate) {
    return { error: 'Description, catégorie, montant (> 0) et date requis' }
  }

  const { error } = await supabase.from('financial_due_dates').insert({
    description,
    type,
    category,
    amount,
    due_date: dueDate,
    vehicle_id: (formData.get('vehicle_id') as string)?.trim() || null,
    notes: (formData.get('notes') as string)?.trim() || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/accounting/due-dates')
  return { success: true }
}

/**
 * Créance client = paiement de réservation à recevoir. Enregistre une échéance
 * 'recette' liée à la réservation + au client. Le service est rattaché à la
 * date de la réservation (service_date) ; l'échéance (due_date) est la date de
 * paiement attendue. Soldée via markDuePaid → crée la recette réelle datée du
 * jour de l'encaissement (l'app reste en comptabilité de trésorerie).
 */
export async function createReceivable(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const reservationId = (formData.get('reservation_id') as string)?.trim()
  if (!reservationId) return { error: 'Réservation requise' }

  // Une créance peut être découpée en plusieurs échéances (paiement échelonné) :
  // on lit une liste JSON [{amount, due_date}, ...]. Repli sur le couple simple
  // (amount, due_date) pour compat ascendante avec d'anciens appels.
  type Echeance = { amount: number; due_date: string }
  let echeances: Echeance[] = []
  const raw = (formData.get('echeances') as string)?.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return { error: 'Échéances invalides' }
      echeances = parsed.map((e: any) => ({
        amount: typeof e.amount === 'number' ? e.amount : parseFloat(String(e.amount ?? '').replace(',', '.')),
        due_date: String(e.due_date ?? '').trim(),
      }))
    } catch { return { error: 'Échéances invalides' } }
  } else {
    const amountRaw = (formData.get('amount') as string)?.trim()
    echeances = [{
      amount: amountRaw ? parseFloat(amountRaw.replace(',', '.')) : 0,
      due_date: (formData.get('due_date') as string)?.trim() ?? '',
    }]
  }

  echeances = echeances.filter(e => e.amount > 0 && e.due_date)
  if (echeances.length === 0) {
    return { error: 'Au moins une échéance (montant > 0 et date) est requise' }
  }

  const { data: resa } = await supabase
    .from('reservations')
    .select('reservation_number, start_datetime, vehicle_id, client_id, client:clients(first_name, last_name)')
    .eq('id', reservationId)
    .single()
  if (!resa) return { error: 'Réservation introuvable' }

  const client = Array.isArray(resa.client) ? resa.client[0] : resa.client as any
  const clientName = client ? `${client.first_name} ${client.last_name}`.trim() : 'client'
  const serviceDate = resa.start_datetime ? String(resa.start_datetime).slice(0, 10) : echeances[0].due_date

  // Anti-double-clic : on écarte les échéances STRICTEMENT identiques (même
  // montant + même date) déjà en attente pour cette réservation — sans bloquer
  // l'ajout légitime de nouvelles échéances (paiement échelonné, complément après
  // une location déjà marquée réglée…).
  const { data: existingRows } = await supabase
    .from('financial_due_dates')
    .select('amount, due_date')
    .eq('reservation_id', reservationId)
    .eq('is_paid', false)
    .is('deleted_at', null)
  const seen = new Set((existingRows ?? []).map((r: any) => `${r.amount}|${r.due_date}`))
  const toInsert = echeances.filter(e => !seen.has(`${e.amount}|${e.due_date}`))
  if (toInsert.length === 0) {
    return { error: 'Ces échéances existent déjà pour cette réservation.' }
  }

  const notes = (formData.get('notes') as string)?.trim() || null
  const rows = toInsert.map(e => ({
    description: `Location ${resa.reservation_number} — ${clientName}`,
    type: 'recette',
    category: 'location',
    amount: e.amount,
    due_date: e.due_date,
    service_date: serviceDate,
    reservation_id: reservationId,
    client_id: resa.client_id ?? null,
    vehicle_id: resa.vehicle_id ?? null,
    notes,
    created_by: user.id,
  }))

  const { error } = await supabase.from('financial_due_dates').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/accounting/due-dates')
  revalidatePath('/accounting/creances')
  revalidatePath(`/reservations/${reservationId}`)
  return { success: true, count: rows.length }
}

/**
 * Crée en une fois toutes les mensualités d'un échéancier récurrent (loyer
 * véhicule, assurance...) — évite de répéter createDueDate manuellement pour
 * chaque mois (ex. 36 fois pour un loyer sur 3 ans). Un mois fixe (+1 mois par
 * échéance, jour conservé) — pas de fréquence hebdo/trimestrielle pour l'instant,
 * tous les cas observés (loyers véhicules) sont mensuels.
 */
export async function createRecurringDueDates(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const description = (formData.get('description') as string)?.trim()
  const type = (formData.get('type') as string) || 'depense'
  const category = (formData.get('category') as string)?.trim()
  const amountRaw = (formData.get('amount') as string)?.trim()
  const amount = amountRaw ? parseFloat(amountRaw.replace(',', '.')) : 0
  const firstDate = (formData.get('due_date') as string)?.trim()
  const count = parseInt((formData.get('installments') as string)?.trim() || '0', 10)
  if (!description || !category || !(amount > 0) || !firstDate || !(count > 0)) {
    return { error: 'Description, catégorie, montant (> 0), date et nombre de mensualités (> 0) requis' }
  }
  if (count > 120) return { error: 'Maximum 120 mensualités (10 ans) en une fois' }

  const vehicleId = (formData.get('vehicle_id') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null

  // Mensualités déjà réglées AVANT la saisie dans l'appli (ex. véhicule dont on a
  // déjà payé les 5 premiers mois). Les N premières échéances sont créées
  // marquées « réglée » pour ne pas apparaître comme dues, MAIS sans créer de
  // financial_transaction : ces paiements ont eu lieu hors de l'appli, on ne veut
  // pas fausser les bilans comptables avec des mouvements rétroactifs.
  const paidUpfrontRaw = parseInt((formData.get('paid_upfront') as string)?.trim() || '0', 10)
  const paidUpfront = Math.max(0, Math.min(Number.isFinite(paidUpfrontRaw) ? paidUpfrontRaw : 0, count))

  const rows = Array.from({ length: count }, (_, i) => {
    const d = new Date(firstDate)
    d.setMonth(d.getMonth() + i)
    const alreadyPaid = i < paidUpfront
    return {
      description: `${description} (${i + 1}/${count})`,
      type,
      category,
      amount,
      due_date: d.toISOString().slice(0, 10),
      vehicle_id: vehicleId,
      notes,
      created_by: user.id,
      ...(alreadyPaid ? { is_paid: true, paid_at: d.toISOString() } : {}),
    }
  })

  const { error } = await supabase.from('financial_due_dates').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/accounting/due-dates')
  revalidatePath('/accounting')
  return { success: true, count, paid: paidUpfront }
}

/**
 * Marquer une échéance payée crée la transaction réelle correspondante plutôt
 * que de dupliquer la logique de saisie — l'échéance devient une simple trace
 * de ce qui était attendu, le mouvement réel vit dans financial_transactions
 * comme n'importe quelle autre recette/dépense (donc inclus dans les bilans).
 */
export async function markDuePaid(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: due } = await supabase.from('financial_due_dates').select('*').eq('id', id).single()
  if (!due) return { error: 'Échéance introuvable' }
  if (due.is_paid) return { error: 'Échéance déjà réglée' }

  // `reservation_id` est INDISPENSABLE, pas décoratif : la clôture d'une location
  // (postRentalRevenue) cherche les recettes déjà posées par ce lien avant de
  // poser la sienne. Sans lui, elle ne voyait pas l'encaissement de la créance et
  // reposait une seconde recette « location » : une location de 500 € réglée par
  // créance comptait 1 000 € au chiffre d'affaires. Constaté le 28/07/2026.
  const { data: tx, error: txError } = await supabase.from('financial_transactions').insert({
    date: new Date().toISOString().slice(0, 10),
    type: due.type,
    category: due.category,
    amount: due.amount,
    vehicle_id: due.vehicle_id,
    reservation_id: due.reservation_id ?? null,
    notes: due.notes ?? due.description,
    reference: due.id,
    created_by: user.id,
  }).select('id').single()
  if (txError) return { error: txError.message }

  const { error } = await supabase.from('financial_due_dates').update({
    is_paid: true,
    paid_at: new Date().toISOString(),
    transaction_id: tx.id,
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/accounting/due-dates')
  revalidatePath('/accounting')
  return { success: true }
}

/**
 * Suppression LOGIQUE (corbeille) : marque deleted_at pour pouvoir restaurer.
 * Repli sur une suppression dure si la colonne deleted_at n'existe pas encore
 * (migration 057 non appliquée) — l'app reste fonctionnelle dans les deux cas.
 */
export async function deleteDueDate(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const soft = await supabase.from('financial_due_dates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_paid', false)

  if (soft.error) {
    // Colonne deleted_at absente → suppression classique (repli).
    const hard = await supabase.from('financial_due_dates').delete().eq('id', id).eq('is_paid', false)
    if (hard.error) return { error: hard.error.message }
  }

  revalidatePath('/accounting/due-dates')
  revalidatePath('/accounting')
  return { success: true }
}

/**
 * Restaure une échéance depuis la corbeille (deleted_at → null). Fonctionne tant
 * que la suppression logique a été utilisée (migration 057 appliquée).
 */
export async function restoreDueDate(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('financial_due_dates')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/accounting/due-dates')
  revalidatePath('/accounting')
  return { success: true }
}
