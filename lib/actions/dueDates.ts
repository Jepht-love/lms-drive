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

  const rows = Array.from({ length: count }, (_, i) => {
    const d = new Date(firstDate)
    d.setMonth(d.getMonth() + i)
    return {
      description: `${description} (${i + 1}/${count})`,
      type,
      category,
      amount,
      due_date: d.toISOString().slice(0, 10),
      vehicle_id: vehicleId,
      notes,
      created_by: user.id,
    }
  })

  const { error } = await supabase.from('financial_due_dates').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/accounting/due-dates')
  return { success: true, count }
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

  const { data: tx, error: txError } = await supabase.from('financial_transactions').insert({
    date: new Date().toISOString().slice(0, 10),
    type: due.type,
    category: due.category,
    amount: due.amount,
    vehicle_id: due.vehicle_id,
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
