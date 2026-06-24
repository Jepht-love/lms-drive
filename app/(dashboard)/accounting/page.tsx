import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, CalendarCheck, BarChart3, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { periodRange } from '@/lib/accounting/categories'
import AccountingTransactions from './AccountingTransactions'
import AccountingCustomPeriod from './AccountingCustomPeriod'

const PERIODS = [
  { id: 'today',        label: "Aujourd'hui" },
  { id: 'week',         label: 'Semaine' },
  { id: 'month',        label: 'Mois' },
  { id: 'last_month',   label: 'Mois préc.' },
  { id: 'quarter',      label: 'Trimestre' },
  { id: 'last_quarter', label: 'Trim. préc.' },
  { id: 'year',         label: 'Année' },
]

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; type?: string; from?: string; to?: string }>
}) {
  const { period = 'month', type, from: customFrom, to: customTo } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const isCustom = period === 'custom' && customFrom && customTo
  const { from, to, label } = isCustom
    ? { from: customFrom, to: customTo, label: `${customFrom} → ${customTo}` }
    : periodRange(period)

  const [{ data: txs }, { count: dueCount }] = await Promise.all([
    supabase
      .from('financial_transactions')
      .select('*, vehicles(plate)')
      .gte('date', from).lte('date', to)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('financial_due_dates').select('id', { count: 'exact', head: true }).eq('is_paid', false),
  ])

  const all = txs ?? []
  const totalRevenue = all.filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalExpenses = all.filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)
  const net = totalRevenue - totalExpenses

  const list = type === 'recette' || type === 'depense' ? all.filter(t => t.type === type) : all

  const periodPill = (active: boolean) =>
    `px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
      active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
    }`
  const typePill = (active: boolean, extra = '') =>
    `px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
      active ? `${extra} text-white` : 'bg-white border border-gray-100 text-gray-600 shadow-sm'
    }`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Comptabilité</h1>
          <p className="text-sm text-gray-400 mt-0.5">{label}</p>
        </div>
        <Link href="/accounting/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors active:scale-[.98]">
          <Plus className="w-4 h-4" /> Saisir
        </Link>
      </div>

      {/* Sélecteur de période */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {PERIODS.map(p => (
          <Link key={p.id} href={`/accounting?period=${p.id}${type ? `&type=${type}` : ''}`} className={periodPill(period === p.id)}>{p.label}</Link>
        ))}
        <Link href={`/accounting?period=custom${type ? `&type=${type}` : ''}`} className={periodPill(period === 'custom')}>
          Personnalisé
        </Link>
      </div>

      {/* Date picker personnalisé */}
      {period === 'custom' && (
        <AccountingCustomPeriod from={customFrom} to={customTo} type={type} />
      )}

      {/* Synthèse */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Recettes</p>
          <p className="text-[26px] font-black text-green-600 leading-none">{formatPrice(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dépenses</p>
          <p className="text-[26px] font-black text-red-500 leading-none">{formatPrice(totalExpenses)}</p>
        </div>
      </div>
      <div className={`rounded-2xl border shadow-sm p-4 ${net >= 0 ? 'bg-[#111111] border-transparent' : 'bg-white border-red-200'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${net >= 0 ? 'text-white/50' : 'text-gray-400'}`}>Résultat net</p>
        <p className={`text-[34px] font-black leading-none ${net >= 0 ? 'text-white' : 'text-red-500'}`}>
          {net >= 0 ? '+' : ''}{formatPrice(net)}
        </p>
      </div>

      {/* Clôtures & analyses */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/accounting/close/daily" className="flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-100 shadow-sm rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <CalendarCheck className="w-4 h-4" /> Clôture jour
        </Link>
        <Link href="/accounting/close/monthly" className="flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-100 shadow-sm rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <CalendarCheck className="w-4 h-4" /> Clôture mois
        </Link>
        <Link href="/accounting/close/annual" className="flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-100 shadow-sm rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <CalendarCheck className="w-4 h-4" /> Clôture année
        </Link>
        <Link href="/accounting/charts" className="flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-100 shadow-sm rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <BarChart3 className="w-4 h-4" /> Graphiques
        </Link>
        <Link href="/accounting/due-dates" className="relative col-span-2 flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-100 shadow-sm rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <AlertTriangle className="w-4 h-4" /> Échéances
          {(dueCount ?? 0) > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-orange-500 rounded-full text-white text-[10px] font-black flex items-center justify-center px-1">
              {dueCount}
            </span>
          )}
        </Link>
        <Link href="/accounting/report" className="col-span-2 flex items-center justify-center gap-2 py-2.5 bg-[#111111] text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
          <FileSpreadsheet className="w-4 h-4" /> Rapport CA personnalisé
        </Link>
      </div>

      {/* Filtre type */}
      <div className="flex items-center gap-2">
        <Link href={`/accounting?period=${period}`} className={typePill(!type, 'bg-[#111111]')}>Tous</Link>
        <Link href={`/accounting?period=${period}&type=recette`} className={typePill(type === 'recette', 'bg-green-600')}>Recettes</Link>
        <Link href={`/accounting?period=${period}&type=depense`} className={typePill(type === 'depense', 'bg-red-500')}>Dépenses</Link>
      </div>

      {/* Liste des mouvements (avec mode transparence) */}
      <AccountingTransactions transactions={list} />
    </div>
  )
}
