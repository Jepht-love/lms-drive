import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createElement, type ReactElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AccountingPdf, type AccountingPdfData } from '@/lib/accounting/AccountingPdf'
import { getAgencySettings } from '@/lib/contracts/agency'
import { getCategoryLabel } from '@/lib/accounting/categories'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

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

  let from: string, to: string, periodLabel: string, fileLabel: string
  if (fromParam && toParam) {                       // période libre
    from = fromParam; to = toParam
    periodLabel = `Bilan — ${fromParam} au ${toParam}`
    fileLabel = `${fromParam}_${toParam}`
  } else if (monthParam) {
    const month = Number(monthParam)
    from = `${year}-${String(month).padStart(2, '0')}-01`
    to = new Date(year, month, 0).toISOString().slice(0, 10)
    periodLabel = `Bilan mensuel — ${MONTHS[month - 1]} ${year}`
    fileLabel = `${year}-${String(month).padStart(2, '0')}`
  } else {
    from = `${year}-01-01`; to = `${year}-12-31`
    periodLabel = `Bilan annuel — ${year}`
    fileLabel = `${year}`
  }

  const { data: txs } = await supabase
    .from('financial_transactions')
    .select('type, category, amount')
    .gte('date', from).lte('date', to)
    .eq('is_transparent', false)

  const all = txs ?? []
  const totalRevenue = all.filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalExpenses = all.filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)

  const revMap = new Map<string, number>()
  const expMap = new Map<string, number>()
  for (const t of all) {
    const m = t.type === 'recette' ? revMap : expMap
    m.set(t.category, (m.get(t.category) ?? 0) + (t.amount ?? 0))
  }
  const toCat = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, amount]) => ({ label: getCategoryLabel(id), amount }))

  const agency = await getAgencySettings(supabase)

  const data: AccountingPdfData = {
    periodLabel,
    agencyName: agency.company_name,
    siret: agency.siret,
    totalRevenue,
    totalExpenses,
    revenueByCategory: toCat(revMap),
    expenseByCategory: toCat(expMap),
    generatedAt: new Date().toLocaleDateString('fr-FR'),
  }

  const element = createElement(AccountingPdf, { data }) as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bilan-${fileLabel}.pdf"`,
    },
  })
}
