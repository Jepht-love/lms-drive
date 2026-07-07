'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPeriodOpen } from '@/lib/accounting/period-lock'
import { assertManager } from '@/lib/auth/roles'

export async function createTransaction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const mgrErr = await assertManager(supabase, user.id)
  if (mgrErr) return { error: mgrErr.error }

  const type = (formData.get('type') as string) || 'depense'
  const category = (formData.get('category') as string)?.trim()
  const amountRaw = (formData.get('amount') as string)?.trim()
  const amount = amountRaw ? parseFloat(amountRaw.replace(',', '.')) : 0
  if (!category || !(amount > 0)) return { error: 'Catégorie et montant (> 0) requis' }

  const str = (k: string) => (formData.get(k) as string)?.trim() || null
  const date = str('date') || new Date().toISOString().slice(0, 10)

  // Verrou : on ne saisit pas dans une période déjà clôturée (figée).
  const locked = await assertPeriodOpen(supabase, date)
  if (locked) return { error: locked }

  const { error } = await createAdminClient().from('financial_transactions').insert({
    date,
    type,
    category,
    amount,
    vehicle_id:           str('vehicle_id'),
    supplier_beneficiary: str('supplier_beneficiary'),
    payment_method:       str('payment_method'),
    reference:            str('reference'),
    notes:                str('notes'),
    created_by:           user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/accounting')
  return { success: true }
}

/**
 * Supprime une écriture comptable MANUELLE. Une écriture liée à une réservation
 * (reservation_id renseigné, donc auto-générée) n'est pas supprimable ici — elle
 * se gère depuis la réservation. Interdit aussi dans une période clôturée.
 */
export async function deleteTransaction(transactionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const mgrErr = await assertManager(supabase, user.id)
  if (mgrErr) return { error: mgrErr.error }

  const admin = createAdminClient()
  const { data: tx } = await admin
    .from('financial_transactions')
    .select('date, reservation_id')
    .eq('id', transactionId)
    .single()
  if (!tx) return { error: 'Écriture introuvable' }
  if (tx.reservation_id) return { error: 'Écriture liée à une réservation — à gérer depuis la réservation.' }

  const locked = await assertPeriodOpen(supabase, tx.date)
  if (locked) return { error: locked }

  const { error } = await admin.from('financial_transactions').delete().eq('id', transactionId)
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'transaction_deleted',
    entity_type: 'financial_transactions', entity_id: transactionId, metadata: {},
  })

  revalidatePath('/accounting')
  return { success: true }
}

// Répartition des recettes par type d'encaissement (espèces/carte/virement/...)
// — figée à la clôture comme total_revenue/total_expenses, pas recalculée après.
function revenueByPaymentMethod(txs: { type: string; amount: number | null; payment_method: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of txs) {
    if (t.type !== 'recette') continue
    const method = t.payment_method || 'carte'
    out[method] = (out[method] ?? 0) + (t.amount ?? 0)
  }
  return out
}

export async function closeDailyAccounting(date: string, countedByMethod: Record<string, number> = {}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const mgrErr = await assertManager(supabase, user.id)
  if (mgrErr) return { error: mgrErr.error }

  const { data: existing } = await supabase.from('daily_closings').select('is_closed').eq('date', date).maybeSingle()
  if (existing?.is_closed) return { error: 'Journée déjà clôturée' }

  const { data: txs } = await supabase.from('financial_transactions').select('type, amount, payment_method').eq('date', date)
  const totalRevenue = (txs ?? []).filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalExpenses = (txs ?? []).filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)

  // Réconciliation de caisse : réel compté vs recettes logiciel.
  const counted = Object.fromEntries(
    Object.entries(countedByMethod).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => [k, Number(v)]),
  )
  const countedTotal = Object.values(counted).reduce((s, v) => s + v, 0)
  const hasCount = Object.keys(counted).length > 0

  const { error } = await supabase.from('daily_closings').upsert({
    date,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    revenue_by_payment_method: revenueByPaymentMethod(txs ?? []),
    counted_by_method: counted,
    counted_total: hasCount ? countedTotal : null,
    variance: hasCount ? countedTotal - totalRevenue : null,
    is_closed: true,
    closed_at: new Date().toISOString(),
    closed_by: user.id,
    snapshot: { transactions: txs, calculatedAt: new Date().toISOString() },
  }, { onConflict: 'date' })
  if (error) return { error: error.message }

  revalidatePath('/accounting/close/daily')
  return { success: true }
}

export async function closeMonthlyAccounting(month: number, year: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const mgrErr = await assertManager(supabase, user.id)
  if (mgrErr) return { error: mgrErr.error }

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = new Date(year, month, 0).toISOString().slice(0, 10)

  const { data: existing } = await supabase.from('monthly_closings').select('is_closed').eq('month', month).eq('year', year).maybeSingle()
  if (existing?.is_closed) return { error: 'Mois déjà clôturé' }

  // Snapshot AVEC le véhicule joint → l'affichage figé garde les noms de véhicule.
  const { data: txs } = await supabase.from('financial_transactions').select('*, vehicles(plate, brand, model)').gte('date', from).lte('date', to)
  const totalRevenue = (txs ?? []).filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalExpenses = (txs ?? []).filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)

  const { error } = await supabase.from('monthly_closings').upsert({
    month, year,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    revenue_by_payment_method: revenueByPaymentMethod(txs ?? []),
    is_closed: true,
    closed_at: new Date().toISOString(),
    closed_by: user.id,
    snapshot: { transactions: txs, calculatedAt: new Date().toISOString() },
  }, { onConflict: 'month,year' })
  if (error) return { error: error.message }

  revalidatePath('/accounting/close/monthly')
  return { success: true }
}

export async function closeAnnualAccounting(year: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const mgrErr = await assertManager(supabase, user.id)
  if (mgrErr) return { error: mgrErr.error }

  const { data: months } = await supabase
    .from('monthly_closings')
    .select('month, is_closed, total_revenue, total_expenses')
    .eq('year', year).order('month')

  const unclosed = (months ?? []).filter(m => !m.is_closed)
  if (unclosed.length > 0) {
    return { error: `${unclosed.length} mois non clôturé(s) : ${unclosed.map(m => m.month).join(', ')}` }
  }

  const totalRevenue = (months ?? []).reduce((s, m) => s + (m.total_revenue ?? 0), 0)
  const totalExpenses = (months ?? []).reduce((s, m) => s + (m.total_expenses ?? 0), 0)

  const { error } = await supabase.from('annual_closings').upsert({
    year,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    is_closed: true,
    closed_at: new Date().toISOString(),
    closed_by: user.id,
    snapshot: { months, calculatedAt: new Date().toISOString() },
  }, { onConflict: 'year' })
  if (error) return { error: error.message }

  revalidatePath('/accounting/close/annual')
  return { success: true }
}

export async function updateTransactionNotes(transactionId: string, notes: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const mgrErr = await assertManager(supabase, user.id)
  if (mgrErr) return { error: mgrErr.error }

  const { data: tx } = await supabase.from('financial_transactions').select('date').eq('id', transactionId).single()
  if (tx) {
    const locked = await assertPeriodOpen(supabase, tx.date)
    if (locked) return { error: locked }
  }

  const { error } = await supabase
    .from('financial_transactions')
    .update({ notes: notes || null })
    .eq('id', transactionId)
  if (error) return { error: error.message }

  revalidatePath('/accounting')
  return { success: true }
}

export async function toggleTransparence(transactionId: string, current: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const mgrErr = await assertManager(supabase, user.id)
  if (mgrErr) return { error: mgrErr.error }

  const { data: tx } = await supabase.from('financial_transactions').select('date').eq('id', transactionId).single()
  if (tx) {
    const locked = await assertPeriodOpen(supabase, tx.date)
    if (locked) return { error: locked }
  }

  const { error } = await supabase
    .from('financial_transactions')
    .update({ is_transparent: !current })
    .eq('id', transactionId)
  if (error) return { error: error.message }

  revalidatePath('/accounting')
  return { success: true }
}

// ─── Réouverture d'une clôture (lève le verrou pour corriger une saisie) ───────
async function reopen(table: string, match: Record<string, unknown>, path: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const mgrErr = await assertManager(supabase, user.id)
  if (mgrErr) return { error: mgrErr.error }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) return { error: 'Accès refusé' }

  const { error } = await supabase.from(table).update({ is_closed: false }).match(match)
  if (error) return { error: error.message }
  revalidatePath(path)
  return { success: true }
}

export async function reopenDailyClosing(date: string) {
  return reopen('daily_closings', { date }, '/accounting/close/daily')
}
export async function reopenMonthlyClosing(month: number, year: number) {
  return reopen('monthly_closings', { month, year }, '/accounting/close/monthly')
}
export async function reopenAnnualClosing(year: number) {
  return reopen('annual_closings', { year }, '/accounting/close/annual')
}
