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

export async function deleteDueDate(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('financial_due_dates').delete().eq('id', id).eq('is_paid', false)
  if (error) return { error: error.message }

  revalidatePath('/accounting/due-dates')
  return { success: true }
}
