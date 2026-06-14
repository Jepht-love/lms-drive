import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { getCategoryLabel } from '@/lib/accounting/categories'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const monthParam = searchParams.get('month')
  const year = Number(searchParams.get('year')) || new Date().getFullYear()

  let from: string, to: string, periodLabel: string
  if (monthParam) {
    const month = Number(monthParam)
    from = `${year}-${String(month).padStart(2, '0')}-01`
    to = new Date(year, month, 0).toISOString().slice(0, 10)
    periodLabel = `${year}-${String(month).padStart(2, '0')}`
  } else {
    from = `${year}-01-01`; to = `${year}-12-31`; periodLabel = `${year}`
  }

  const { data: txs } = await supabase
    .from('financial_transactions')
    .select('date, type, category, supplier_beneficiary, amount, notes, reference, vehicles(plate)')
    .gte('date', from).lte('date', to)
    .eq('is_transparent', false)          // exclut les lignes en mode transparence
    .order('date')

  const all = txs ?? []
  const plate = (t: any) => { const v = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles; return v?.plate ?? '' }
  const rev = all.filter(t => t.type === 'recette')
  const exp = all.filter(t => t.type === 'depense')
  const totalRev = rev.reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalExp = exp.reduce((s, t) => s + (t.amount ?? 0), 0)

  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Bilan comptable — LMS Agency'],
    ['Période', periodLabel],
    [],
    ["Chiffre d'affaires", totalRev],
    ['Dépenses', totalExp],
    ['Résultat net', totalRev - totalExp],
  ]), 'Synthèse')

  const header = ['Date', 'Catégorie', 'Bénéficiaire', 'Véhicule', 'Montant', 'Référence', 'Notes']
  const rows = (list: any[]) => [header, ...list.map(t => [t.date, getCategoryLabel(t.category), t.supplier_beneficiary ?? '', plate(t), t.amount, t.reference ?? '', t.notes ?? ''])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows(rev)), 'Recettes')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows(exp)), 'Dépenses')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bilan-${periodLabel}.xlsx"`,
    },
  })
}
