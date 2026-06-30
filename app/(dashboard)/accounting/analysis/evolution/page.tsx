import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import { periodRange } from '@/lib/accounting/categories'
import { previousRange, dateLabel, buildAnalysisData, pctDelta, type Tx } from '@/lib/accounting/analysis-helpers'

export default async function EvolutionPage({
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

  const { costDrivers, savings } = buildAnalysisData(
    (curTxs ?? []) as Tx[],
    (prevTxs ?? []) as Tx[],
  )

  const curLabel = dateLabel(cur.from, granularity)
  const prevLabel = dateLabel(prev.from, granularity)

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting/analysis" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Analyse
      </BackButton>

      <div>
        <h1 className="text-xl font-black text-gray-900">Évolution des postes</h1>
        <p className="text-sm text-gray-400 mt-0.5">{curLabel} vs {prevLabel}</p>
      </div>

      {/* Explication */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-800 leading-relaxed">
          Ce tableau compare vos dépenses par famille entre <strong>{curLabel}</strong> et <strong>{prevLabel}</strong>.
          Une hausse (en rouge) alourdit votre résultat. Une baisse (en vert) l'améliore.
          Quand une famille n'existait pas la période précédente, elle est marquée <em>Nouveau</em>.
        </p>
      </div>

      {costDrivers.length === 0 && savings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <Minus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-500">Aucune variation entre les deux périodes</p>
        </div>
      ) : (
        <>
          {/* Hausses */}
          {costDrivers.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-500" />
                <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">
                  Hausses de dépenses
                </h2>
              </div>
              <p className="text-[10px] text-gray-400 -mt-1">Ces familles coûtent plus cher que la période précédente.</p>
              <div className="space-y-3 divide-y divide-gray-50">
                {costDrivers.map(d => {
                  const pct = pctDelta(d.cur, d.prev)
                  return (
                    <div key={d.id} className="pt-3 first:pt-0">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-gray-800 leading-snug">{d.label}</span>
                        <span className="text-sm font-black text-red-500 flex-shrink-0">+{formatPrice(d.delta)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-gray-400">
                          {d.prev > 0
                            ? `${prevLabel} : ${formatPrice(d.prev)} → ${curLabel} : ${formatPrice(d.cur)}`
                            : `Nouveau poste · ${curLabel} : ${formatPrice(d.cur)}`
                          }
                        </span>
                        {pct != null && d.prev > 0 && (
                          <span className="text-[11px] font-bold text-red-400 flex-shrink-0">+{pct}%</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Baisses */}
          {savings.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-green-500" />
                <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">
                  Baisses de dépenses
                </h2>
              </div>
              <p className="text-[10px] text-gray-400 -mt-1">Ces familles coûtent moins cher qu'avant. Bon signe.</p>
              <div className="space-y-3 divide-y divide-gray-50">
                {savings.map(d => {
                  const pct = pctDelta(d.cur, d.prev)
                  return (
                    <div key={d.id} className="pt-3 first:pt-0">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-semibold text-gray-800 leading-snug">{d.label}</span>
                        <span className="text-sm font-black text-green-600 flex-shrink-0">{formatPrice(d.delta)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-gray-400">
                          {d.cur > 0
                            ? `${prevLabel} : ${formatPrice(d.prev)} → ${curLabel} : ${formatPrice(d.cur)}`
                            : `Poste soldé · ${prevLabel} : ${formatPrice(d.prev)}`
                          }
                        </span>
                        {pct != null && d.prev > 0 && (
                          <span className="text-[11px] font-bold text-green-500 flex-shrink-0">{pct}%</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}

      <Link href={`/accounting/analysis?period=${period}`} className="block text-center text-sm font-semibold text-gray-400 py-2">
        ← Retour à l'analyse
      </Link>
    </div>
  )
}
