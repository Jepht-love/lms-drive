import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import { periodRange } from '@/lib/accounting/categories'
import { previousRange, dateLabel, buildAnalysisData, pctDelta, type Tx } from '@/lib/accounting/analysis-helpers'

export default async function PostesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period = 'month' } = await searchParams
  const granularity = period === 'year' ? 'year' : period === 'quarter' ? 'quarter' : 'month'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const now = new Date()
  const cur = periodRange(granularity, now)
  const prev = previousRange(granularity, now)

  const [{ data: curTxs }, { data: prevTxs }] = await Promise.all([
    supabase.from('financial_transactions').select('type, category, amount').gte('date', cur.from).lte('date', cur.to),
    supabase.from('financial_transactions').select('type, category, amount').gte('date', prev.from).lte('date', prev.to),
  ])

  const { C, families } = buildAnalysisData(
    (curTxs ?? []) as Tx[],
    (prevTxs ?? []) as Tx[],
  )

  const curLabel = dateLabel(cur.from, granularity)
  const prevLabel = dateLabel(prev.from, granularity)
  const maxFamily = Math.max(1, ...families.map(f => f.amount))

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting/analysis" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Analyse
      </BackButton>

      <div>
        <h1 className="text-xl font-black text-gray-900">Postes les plus lourds</h1>
        <p className="text-sm text-gray-400 mt-0.5">{curLabel}</p>
      </div>

      {/* Explication */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-800 leading-relaxed">
          Vos dépenses sont regroupées par <strong>famille</strong> (nature de la charge).
          La barre montre le poids de chaque famille dans le total des dépenses.
          La comparaison avec {prevLabel} indique si ce poste a augmenté ou baissé.
        </p>
      </div>

      {/* Total dépenses */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total dépenses {curLabel}</p>
        <p className="text-[28px] font-black text-red-500 leading-none">{formatPrice(C.expenses)}</p>
      </div>

      {families.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-sm text-gray-400">Aucune dépense sur la période</p>
        </div>
      ) : (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
          {families.map((f, i) => {
            const pctOfTotal = C.expenses > 0 ? Math.round((f.amount / C.expenses) * 100) : 0
            const pctOfMax = Math.round((f.amount / maxFamily) * 100)
            const delta = f.amount - f.prev
            const varPct = pctDelta(f.amount, f.prev)
            return (
              <div key={f.id} className={i > 0 ? 'pt-4 border-t border-gray-50' : ''}>
                {/* Ligne principale */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 leading-snug">{f.label}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{pctOfTotal}% des dépenses totales</p>
                  </div>
                  <p className="text-base font-black text-gray-900 flex-shrink-0">{formatPrice(f.amount)}</p>
                </div>
                {/* Barre */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-[#111111] rounded-full transition-all" style={{ width: `${pctOfMax}%` }} />
                </div>
                {/* Comparaison période précédente */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    {f.prev > 0 ? `${prevLabel} : ${formatPrice(f.prev)}` : 'Pas de données pour la période précédente'}
                  </span>
                  {delta !== 0 && (
                    <span className={`text-[11px] font-bold ${delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {delta > 0 ? '+' : ''}{formatPrice(delta)}
                      {varPct != null && f.prev > 0 ? ` (${varPct > 0 ? '+' : ''}${varPct}%)` : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}

      <Link href={`/accounting/analysis?period=${period}`} className="block text-center text-sm font-semibold text-gray-400 py-2">
        ← Retour à l'analyse
      </Link>
    </div>
  )
}
