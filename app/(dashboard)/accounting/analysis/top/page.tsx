import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import { periodRange } from '@/lib/accounting/categories'
import { previousRange, dateLabel, buildAnalysisData, pctDelta, type Tx } from '@/lib/accounting/analysis-helpers'

export default async function TopPostesPage({
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

  const { C, postes } = buildAnalysisData(
    (curTxs ?? []) as Tx[],
    (prevTxs ?? []) as Tx[],
  )

  const curLabel = dateLabel(cur.from, granularity)
  const prevLabel = dateLabel(prev.from, granularity)
  const maxPoste = Math.max(1, ...postes.map(p => p.amount))

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting/analysis" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Analyse
      </BackButton>

      <div>
        <h1 className="text-xl font-black text-gray-900">Détail par catégorie</h1>
        <p className="text-sm text-gray-400 mt-0.5">{curLabel}</p>
      </div>

      {/* Explication */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-800 leading-relaxed">
          Vue précise de chaque <strong>catégorie</strong> de dépense.
          Appuyez sur une ligne pour voir toutes les transactions associées sur la période.
          La comparaison avec {prevLabel} indique la tendance.
        </p>
      </div>

      {postes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-sm text-gray-400">Aucune dépense sur la période</p>
        </div>
      ) : (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {postes.map((p, i) => {
            const delta = p.amount - p.prev
            const varPct = pctDelta(p.amount, p.prev)
            const pctOfMax = Math.round((p.amount / maxPoste) * 100)
            return (
              <Link
                key={p.id}
                href={`/accounting?period=${granularity}&type=depense&category=${p.id}`}
                className="flex items-center gap-3 p-4 active:bg-gray-50 transition-colors"
              >
                {/* Rang */}
                <span className="w-5 text-[11px] font-black text-gray-300 flex-shrink-0 text-center">{i + 1}</span>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800 leading-snug">{p.label}</span>
                    <span className="text-sm font-black text-gray-900 flex-shrink-0">{formatPrice(p.amount)}</span>
                  </div>
                  {/* Barre */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${pctOfMax}%` }} />
                  </div>
                  {/* Comparaison */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">
                      {p.prev > 0 ? `${prevLabel} : ${formatPrice(p.prev)}` : 'Nouveau'}
                    </span>
                    {delta !== 0 && (
                      <span className={`text-[10px] font-bold ${delta > 0 ? 'text-red-400' : 'text-green-500'}`}>
                        {delta > 0 ? '+' : ''}{formatPrice(delta)}
                        {varPct != null && p.prev > 0 ? ` (${varPct > 0 ? '+' : ''}${varPct}%)` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
              </Link>
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
