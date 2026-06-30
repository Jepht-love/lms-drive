import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import CloseButton from '../CloseButton'
import ReopenClosingButton from '../ReopenClosingButton'
import AccountingTransactions from '../../AccountingTransactions'

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

  const [{ data: annual }, { data: months }, { data: txs }] = await Promise.all([
    supabase.from('annual_closings').select('*').eq('year', year).maybeSingle(),
    supabase.from('monthly_closings').select('*').eq('year', year),
    supabase.from('financial_transactions').select('*, vehicles(plate, brand, model)')
      .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`),
  ])

  const isClosed = annual?.is_closed
  const closedCount = (months ?? []).filter(m => m.is_closed).length

  // Transparence : recalculée depuis les transactions brutes de l'année plutôt
  // que depuis monthly_closings.total_revenue/expenses (figé sans transparence
  // à la clôture de chaque mois) — sans quoi le bilan annuel envoyé au
  // comptable ne refléterait pas les lignes marquées transparentes après coup.
  const all = txs ?? []
  const visible = all.filter(t => !t.is_transparent)
  const hidden = all.filter(t => t.is_transparent)
  const hiddenAmount = hidden.reduce((s, t) => s + (t.amount ?? 0), 0)

  const annualRevenue = visible.filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const annualExpenses = visible.filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)
  const annualProfit = annualRevenue - annualExpenses

  const byMonthVisible = new Map<number, { rev: number; exp: number }>()
  for (const t of visible) {
    const m = new Date(t.date).getMonth() + 1
    const e = byMonthVisible.get(m) ?? { rev: 0, exp: 0 }
    if (t.type === 'recette') e.rev += t.amount ?? 0
    else e.exp += t.amount ?? 0
    byMonthVisible.set(m, e)
  }
  const byMonth = new Map((months ?? []).map(m => [m.month, m]))

  const years = [cur, cur - 1, cur - 2]
  const pill = (active: boolean) =>
    `px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 shadow-sm'}`

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>
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

      {hidden.length > 0 && (
        <p className="text-[11px] text-gray-400 text-center">
          {hidden.length} ligne{hidden.length > 1 ? 's' : ''} transparente{hidden.length > 1 ? 's' : ''} exclue{hidden.length > 1 ? 's' : ''} du bilan ci-dessus · {formatPrice(hiddenAmount)}
        </p>
      )}

      {/* Tableau 12 mois */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {MONTHS.map((label, i) => {
          const m = byMonth.get(i + 1)
          const v = byMonthVisible.get(i + 1)
          const rev = v?.rev ?? 0
          const exp = v?.exp ?? 0
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

      {isClosed && <ReopenClosingButton mode="annual" year={year} />}

      {/* Mouvements — marquer une ligne transparente la déduit du bilan et des exports ci-dessus */}
      {!isClosed && all.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
            Mouvements de l&apos;année
          </p>
          <AccountingTransactions transactions={all} />
        </div>
      )}
    </div>
  )
}
