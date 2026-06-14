import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import CloseButton from '../CloseButton'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default async function AnnualClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yp } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const cur = new Date().getFullYear()
  const year = yp ? parseInt(yp, 10) : cur

  const [{ data: annual }, { data: months }] = await Promise.all([
    supabase.from('annual_closings').select('*').eq('year', year).maybeSingle(),
    supabase.from('monthly_closings').select('*').eq('year', year),
  ])

  const byMonth = new Map((months ?? []).map(m => [m.month, m]))
  const annualRevenue = (months ?? []).reduce((s, m) => s + (m.total_revenue ?? 0), 0)
  const annualExpenses = (months ?? []).reduce((s, m) => s + (m.total_expenses ?? 0), 0)
  const annualProfit = annualRevenue - annualExpenses
  const isClosed = annual?.is_closed
  const closedCount = (months ?? []).filter(m => m.is_closed).length

  const years = [cur, cur - 1, cur - 2]
  const pill = (active: boolean) =>
    `px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 shadow-sm'}`

  return (
    <div className="space-y-4">
      <Link href="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </Link>
      <h1 className="text-xl font-black text-gray-900">Clôture annuelle</h1>

      <div className="flex gap-2">
        {years.map(y => <Link key={y} href={`/accounting/close/annual?year=${y}`} className={pill(y === year)}>{y}</Link>)}
      </div>

      {isClosed && (
        <div className="flex items-center gap-2 py-3 px-4 bg-green-50 border border-green-100 rounded-2xl text-sm font-semibold text-green-700">
          <CheckCircle2 className="w-4 h-4" /> Année {year} clôturée — figée
        </div>
      )}

      {/* Synthèse */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">CA annuel</p>
          <p className="text-[22px] font-black text-[#111111] leading-none">{formatPrice(annualRevenue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Dépenses</p>
          <p className="text-[22px] font-black text-red-500 leading-none">{formatPrice(annualExpenses)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 text-center ${annualProfit >= 0 ? 'bg-[#111111] border-transparent' : 'bg-white border-red-200'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${annualProfit >= 0 ? 'text-white/50' : 'text-gray-400'}`}>Bénéfice</p>
          <p className={`text-[22px] font-black leading-none ${annualProfit >= 0 ? 'text-white' : 'text-red-500'}`}>{formatPrice(annualProfit)}</p>
        </div>
      </div>

      {/* Tableau 12 mois */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {MONTHS.map((label, i) => {
          const m = byMonth.get(i + 1)
          const rev = m?.total_revenue ?? 0
          const exp = m?.total_expenses ?? 0
          const net = rev - exp
          return (
            <Link key={i} href="/accounting/close/monthly" className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50">
              <span className="w-20 text-[13px] font-medium text-gray-900">{label}</span>
              <div className="flex-1 flex items-center gap-3 text-[11px]">
                <span className="text-green-600">+{formatPrice(rev)}</span>
                <span className="text-red-400">−{formatPrice(exp)}</span>
              </div>
              <span className={`text-[13px] font-black ${net >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{formatPrice(net)}</span>
              {m?.is_closed
                ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                : <span className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />}
            </Link>
          )
        })}
      </div>

      {!isClosed && (
        closedCount < 12 ? (
          <div className="flex items-center gap-2 py-3 px-4 bg-orange-50 border border-orange-100 rounded-2xl text-sm font-medium text-orange-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {12 - closedCount} mois non clôturé(s) — clôture annuelle indisponible
          </div>
        ) : (
          <CloseButton mode="annual" year={year} />
        )
      )}
    </div>
  )
}
