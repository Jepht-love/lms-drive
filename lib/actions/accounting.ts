'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createTransaction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const type = (formData.get('type') as string) || 'depense'
  const category = (formData.get('category') as string)?.trim()
  const amountRaw = (formData.get('amount') as string)?.trim()
  const amount = amountRaw ? parseFloat(amountRaw.replace(',', '.')) : 0
  if (!category || !(amount > 0)) return { error: 'Catégorie et montant (> 0) requis' }

  const str = (k: string) => (formData.get(k) as string)?.trim() || null

  const { error } = await supabase.from('financial_transactions').insert({
    date:                 str('date') || new Date().toISOString().slice(0, 10),
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

export async function closeDailyAccounting(date: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: existing } = await supabase.from('daily_closings').select('is_closed').eq('date', date).maybeSingle()
  if (existing?.is_closed) return { error: 'Journée déjà clôturée' }

  const { data: txs } = await supabase.from('financial_transactions').select('type, amount').eq('date', date)
  const totalRevenue = (txs ?? []).filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalExpenses = (txs ?? []).filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)

  const { error } = await supabase.from('daily_closings').upsert({
    date,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
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

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = new Date(year, month, 0).toISOString().slice(0, 10)

  const { data: existing } = await supabase.from('monthly_closings').select('is_closed').eq('month', month).eq('year', year).maybeSingle()
  if (existing?.is_closed) return { error: 'Mois déjà clôturé' }

  const { data: txs } = await supabase.from('financial_transactions').select('*').gte('date', from).lte('date', to)
  const totalRevenue = (txs ?? []).filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalExpenses = (txs ?? []).filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)

  const { error } = await supabase.from('monthly_closings').upsert({
    month, year,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
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

  const { error } = await supabase
    .from('financial_transactions')
    .update({ is_transparent: !current })
    .eq('id', transactionId)
  if (error) return { error: error.message }

  revalidatePath('/accounting')
  return { success: true }
}
