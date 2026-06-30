import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import {
  getCategoryLabel, REVENUE_CATEGORIES, EXPENSE_FAMILIES,
  expenseFamily, expenseNature, type CostNature,
} from '@/lib/accounting/categories'

type Tx = {
  date: string; type: string; category: string
  supplier_beneficiary: string | null; amount: number | null
  notes: string | null; reference: string | null
  vehicles?: { plate: string } | { plate: string }[] | null
}

const plate = (t: Tx) => {
  const v = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles
  return v?.plate ?? ''
}

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
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const year = Number(searchParams.get('year')) || new Date().getFullYear()

  let from: string, to: string, periodLabel: string
  if (fromParam && toParam) {
    from = fromParam; to = toParam; periodLabel = `${fromParam} — ${toParam}`
  } else if (monthParam) {
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
    .eq('is_transparent', false)
    .order('date')

  const all = (txs ?? []) as Tx[]
  const rev = all.filter(t => t.type === 'recette')
  const exp = all.filter(t => t.type === 'depense')
  const sum = (list: Tx[]) => list.reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalRev = sum(rev)
  const expFixe = exp.filter(t => expenseNature(t.category) === 'fixe')
  const expVar = exp.filter(t => expenseNature(t.category) === 'variable')
  const totalFixe = sum(expFixe)
  const totalVar = sum(expVar)
  const totalExp = totalFixe + totalVar

  const wb = XLSX.utils.book_new()
  type Row = (string | number)[]

  // ── Synthèse — compte de résultat simplifié ───────────────────────────────
  const synth: Row[] = [
    ['Bilan comptable — LMS Drive'],
    ['Période', periodLabel],
    [],
    ["CHIFFRE D'AFFAIRES", totalRev],
    ['Charges fixes', -totalFixe],
    ['Charges variables', -totalVar],
    ['Total des charges', -totalExp],
    ['RÉSULTAT NET', totalRev - totalExp],
    [],
    ['Détail des recettes par catégorie'],
  ]
  for (const c of REVENUE_CATEGORIES) {
    const t = sum(rev.filter(r => r.category === c.id))
    if (t !== 0) synth.push([c.label, t])
  }
  synth.push([], ['Détail des charges par poste (famille)'])
  for (const fam of EXPENSE_FAMILIES) {
    const t = sum(exp.filter(e => expenseFamily(e.category)?.id === fam.id))
    if (t !== 0) synth.push([`${fam.nature === 'fixe' ? '[Fixe]' : '[Var.]'} ${fam.label}`, t])
  }
  const synthWs = XLSX.utils.aoa_to_sheet(synth)
  synthWs['!cols'] = [{ wch: 42 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, synthWs, 'Synthèse')

  // ── Feuille Recettes — sous-totaux par catégorie + détail ─────────────────
  const buildRevenue = (): Row[] => {
    const aoa: Row[] = [[`Recettes — ${periodLabel}`], [], ['RÉSUMÉ PAR CATÉGORIE'], ['Catégorie', 'Montant (€)']]
    for (const c of REVENUE_CATEGORIES) {
      const t = sum(rev.filter(r => r.category === c.id))
      if (t !== 0) aoa.push([c.label, t])
    }
    aoa.push(['TOTAL RECETTES', totalRev], [], [], ['DÉTAIL DES ÉCRITURES'],
      ['Date', 'Catégorie', 'Client / Bénéficiaire', 'Véhicule', 'Montant (€)', 'Référence', 'Notes'])
    for (const t of rev) {
      aoa.push([t.date, getCategoryLabel(t.category), t.supplier_beneficiary ?? '', plate(t), t.amount ?? 0, t.reference ?? '', t.notes ?? ''])
    }
    return aoa
  }
  const revWs = XLSX.utils.aoa_to_sheet(buildRevenue())
  revWs['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, revWs, 'Recettes')

  // ── Feuilles Charges fixes / variables — famille → poste + détail ─────────
  const buildExpenses = (nature: CostNature): Row[] => {
    const list = nature === 'fixe' ? expFixe : expVar
    const fams = EXPENSE_FAMILIES.filter(f => f.nature === nature)
    const title = nature === 'fixe' ? 'CHARGES FIXES' : 'CHARGES VARIABLES'
    const aoa: Row[] = [[`${title} — ${periodLabel}`], [], ['RÉSUMÉ PAR POSTE'], ['Famille', 'Poste', 'Montant (€)']]
    let grand = 0
    for (const fam of fams) {
      const famTxs = list.filter(t => expenseFamily(t.category)?.id === fam.id)
      if (famTxs.length === 0) continue
      const byPoste = new Map<string, number>()
      for (const t of famTxs) byPoste.set(t.category, (byPoste.get(t.category) ?? 0) + (t.amount ?? 0))
      const entries = [...byPoste.entries()].sort((a, b) => b[1] - a[1])
      let famTotal = 0
      entries.forEach(([cat, amt], i) => { aoa.push([i === 0 ? fam.label : '', getCategoryLabel(cat), amt]); famTotal += amt })
      aoa.push(['', `Sous-total ${fam.label}`, famTotal], [])
      grand += famTotal
    }
    aoa.push(['', `TOTAL ${title}`, grand], [], [], ['DÉTAIL DES ÉCRITURES'],
      ['Date', 'Famille', 'Poste', 'Bénéficiaire', 'Véhicule', 'Montant (€)', 'Référence', 'Notes'])
    for (const t of list) {
      aoa.push([t.date, expenseFamily(t.category)?.label ?? '', getCategoryLabel(t.category),
        t.supplier_beneficiary ?? '', plate(t), t.amount ?? 0, t.reference ?? '', t.notes ?? ''])
    }
    return aoa
  }
  const fixeWs = XLSX.utils.aoa_to_sheet(buildExpenses('fixe'))
  fixeWs['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, fixeWs, 'Charges fixes')

  const varWs = XLSX.utils.aoa_to_sheet(buildExpenses('variable'))
  varWs['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 24 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, varWs, 'Charges variables')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="bilan-${periodLabel}.xlsx"`,
    },
  })
}
