import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import { periodRange } from '@/lib/accounting/categories'
import { previousRange, dateLabel, buildAnalysisData, pctDelta, type Tx } from '@/lib/accounting/analysis-helpers'

const PERIODS = [
  { id: 'month',   label: 'Ce mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year',    label: 'Année' },
]

export default async function AnalysisPage({
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

  const { C, P, families, postes, costDrivers, savings } = buildAnalysisData(
    (curTxs ?? []) as Tx[],
    (prevTxs ?? []) as Tx[],
  )

  const marginDelta = C.margin - P.margin
  const revenueDelta = C.revenue - P.revenue
  const expenseDelta = C.expenses - P.expenses
  const marginDown = marginDelta < 0

  const curLabel = dateLabel(cur.from, granularity)
  const prevLabel = dateLabel(prev.from, granularity)

  const periodPill = (active: boolean) =>
    `px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
      active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
    }`

  function DeltaBadge({ value, positiveIsGood = true }: { value: number; positiveIsGood?: boolean }) {
    if (value === 0) return <span className="text-[11px] font-bold text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" /> stable</span>
    const up = value > 0
    const good = positiveIsGood ? up : !up
    return (
      <span className={`text-[11px] font-bold flex items-center gap-0.5 ${good ? 'text-green-600' : 'text-red-500'}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {up ? '+' : ''}{formatPrice(value)}
      </span>
    )
  }

  const topCostDriver = costDrivers[0]
  const topSaving = savings[0]

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>

      <div>
        <h1 className="text-xl font-black text-gray-900">Analyse financière</h1>
        <p className="text-sm text-gray-400 mt-0.5">{curLabel} · comparé à {prevLabel}</p>
      </div>

      {/* Sélecteur de période */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {PERIODS.map(p => (
          <Link key={p.id} href={`/accounting/analysis?period=${p.id}`} className={periodPill(period === p.id)}>{p.label}</Link>
        ))}
      </div>

      {/* ── KPI marge ── */}
      <div className={`rounded-2xl border shadow-sm p-4 ${marginDown ? 'bg-white border-red-200' : 'bg-[#111111] border-transparent'}`}>
        <div className="flex items-center justify-between">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${marginDown ? 'text-gray-400' : 'text-white/50'}`}>
            Résultat net {curLabel}
          </p>
          <DeltaBadge value={marginDelta} />
        </div>
        <p className={`text-[34px] font-black leading-none mt-1 ${marginDown ? 'text-red-500' : 'text-white'}`}>
          {C.margin >= 0 ? '+' : ''}{formatPrice(C.margin)}
        </p>
        <p className={`text-[11px] mt-1 ${marginDown ? 'text-gray-400' : 'text-white/50'}`}>
          {prevLabel} : {formatPrice(P.margin)}
        </p>
      </div>

      {/* ── Recettes / Dépenses ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Recettes</p>
          <p className="text-[20px] font-black text-green-600 leading-none">{formatPrice(C.revenue)}</p>
          <div className="mt-1.5"><DeltaBadge value={revenueDelta} /></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dépenses</p>
          <p className="text-[20px] font-black text-red-500 leading-none">{formatPrice(C.expenses)}</p>
          <div className="mt-1.5"><DeltaBadge value={expenseDelta} positiveIsGood={false} /></div>
        </div>
      </div>

      {/* ── Carte : Évolution des postes ── */}
      <Link href={`/accounting/analysis/evolution?period=${granularity}`} className="block active:scale-[.99] transition-transform">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">Évolution des postes</h2>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
          <p className="text-[10px] text-gray-400 mb-3">{curLabel} vs {prevLabel}</p>
          {costDrivers.length === 0 && savings.length === 0 ? (
            <p className="text-xs text-gray-400">Aucune variation notable</p>
          ) : (
            <div className="space-y-1.5">
              {topCostDriver && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-600 truncate">{topCostDriver.label}</span>
                  <span className="text-xs font-black text-red-500 flex-shrink-0">+{formatPrice(topCostDriver.delta)}</span>
                </div>
              )}
              {topSaving && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-600 truncate">{topSaving.label}</span>
                  <span className="text-xs font-black text-green-600 flex-shrink-0">{formatPrice(topSaving.delta)}</span>
                </div>
              )}
              {(costDrivers.length + savings.length) > 2 && (
                <p className="text-[10px] text-gray-400">+ {costDrivers.length + savings.length - 2} autre(s) variation(s)</p>
              )}
            </div>
          )}
        </div>
      </Link>

      {/* ── Carte : Postes les plus lourds ── */}
      <Link href={`/accounting/analysis/postes?period=${granularity}`} className="block active:scale-[.99] transition-transform">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">Postes les plus lourds</h2>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
          <p className="text-[10px] text-gray-400 mb-3">{families.length} familles · {formatPrice(C.expenses)} dépenses</p>
          {families.length === 0 ? (
            <p className="text-xs text-gray-400">Aucune dépense sur la période</p>
          ) : (
            <div className="space-y-1.5">
              {families.slice(0, 3).map(f => {
                const pct = C.expenses > 0 ? Math.round((f.amount / C.expenses) * 100) : 0
                return (
                  <div key={f.id} className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#111111] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 w-[28px] text-right flex-shrink-0">{pct}%</span>
                    <span className="text-[10px] font-semibold text-gray-700 truncate flex-1">{f.label}</span>
                  </div>
                )
              })}
              {families.length > 3 && <p className="text-[10px] text-gray-400">+ {families.length - 3} autre(s)</p>}
            </div>
          )}
        </div>
      </Link>

      {/* ── Carte : Détail par catégorie ── */}
      <Link href={`/accounting/analysis/top?period=${granularity}`} className="block active:scale-[.99] transition-transform">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-900">Détail par catégorie</h2>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
          <p className="text-[10px] text-gray-400 mb-3">Top {postes.length} catégories · cliquer pour voir les transactions</p>
          {postes.length === 0 ? (
            <p className="text-xs text-gray-400">Aucune dépense sur la période</p>
          ) : (
            <div className="space-y-1">
              {postes.slice(0, 4).map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-gray-300 w-4 flex-shrink-0">{i + 1}</span>
                  <span className="text-xs text-gray-600 truncate flex-1">{p.label}</span>
                  <span className="text-xs font-black text-gray-900 flex-shrink-0">{formatPrice(p.amount)}</span>
                </div>
              ))}
              {postes.length > 4 && <p className="text-[10px] text-gray-400 mt-1">+ {postes.length - 4} autre(s)</p>}
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
