import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import { getCategoryLabel } from '@/lib/accounting/categories'
import CloseButton from '../CloseButton'
import AccountingTransactions from '../../AccountingTransactions'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default async function MonthlyClosingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to = new Date(year, month, 0).toISOString().slice(0, 10)

  const [{ data: closing }, { data: txs }] = await Promise.all([
    supabase.from('monthly_closings').select('*').eq('month', month).eq('year', year).maybeSingle(),
    supabase.from('financial_transactions').select('*, vehicles(plate, brand, model)').gte('date', from).lte('date', to),
  ])

  const all = txs ?? []
  const isClosed = closing?.is_closed

  // Transparence : une ligne marquée transparente est déduite du bilan affiché
  // ici et des exports (déjà le cas pour export/pdf et export/excel) — sans
  // quoi le bilan envoyé au comptable ne correspondrait pas à ce qui est vu ici.
  const visible = all.filter(t => !t.is_transparent)
  const hidden = all.filter(t => t.is_transparent)
  const hiddenAmount = hidden.reduce((s, t) => s + (t.amount ?? 0), 0)

  const rev = visible.filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const exp = visible.filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)
  const net = rev - exp

  const byCat = new Map<string, { count: number; amount: number; type: string }>()
  for (const t of visible) {
    const e = byCat.get(t.category) ?? { count: 0, amount: 0, type: t.type }
    e.count++; e.amount += t.amount ?? 0
    byCat.set(t.category, e)
  }

  const byVeh = new Map<string, { name: string; plate: string; revenue: number; expenses: number }>()
  for (const t of visible) {
    if (!t.vehicle_id) continue
    const v = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles
    const e = byVeh.get(t.vehicle_id) ?? { name: v ? `${v.brand} ${v.model}` : '—', plate: v?.plate ?? '', revenue: 0, expenses: 0 }
    if (t.type === 'recette') e.revenue += t.amount ?? 0
    else e.expenses += t.amount ?? 0
    byVeh.set(t.vehicle_id, e)
  }

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>

      <div>
        <h1 className="text-xl font-black text-gray-900">Clôture mensuelle</h1>
        <p className="text-sm text-gray-400 mt-0.5">{MONTHS[month - 1]} {year}</p>
      </div>

      {isClosed && (
        <div className="flex items-center gap-2 py-3 px-4 bg-green-50 border border-green-100 rounded-2xl text-sm font-semibold text-green-700">
          <CheckCircle2 className="w-4 h-4" /> Mois clôturé — figé
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">CA</p>
          <p className="text-base font-black text-green-600">{formatPrice(rev)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
          <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">Dépenses</p>
          <p className="text-base font-black text-red-500">{formatPrice(exp)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-3 text-center ${net >= 0 ? 'bg-[#111111] border-transparent' : 'bg-white border-red-200'}`}>
          <p className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${net >= 0 ? 'text-white/50' : 'text-gray-400'}`}>Net</p>
          <p className={`text-base font-black ${net >= 0 ? 'text-white' : 'text-red-500'}`}>{formatPrice(net)}</p>
        </div>
      </div>

      {hidden.length > 0 && (
        <p className="text-[11px] text-gray-400 text-center">
          {hidden.length} ligne{hidden.length > 1 ? 's' : ''} transparente{hidden.length > 1 ? 's' : ''} exclue{hidden.length > 1 ? 's' : ''} du bilan ci-dessus · {formatPrice(hiddenAmount)}
        </p>
      )}

      {/* Par catégorie */}
      {byCat.size > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 p-4 border-b border-gray-100">Par catégorie</p>
          {[...byCat.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([cat, e]) => (
            <div key={cat} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex-1">
                <p className="text-[13px] font-medium text-gray-900">{getCategoryLabel(cat)}</p>
                <p className="text-[11px] text-gray-400">{e.count} mouvement(s)</p>
              </div>
              <p className={`text-sm font-black ${e.type === 'recette' ? 'text-green-600' : 'text-red-500'}`}>
                {e.type === 'recette' ? '+' : '−'}{formatPrice(e.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Par véhicule */}
      {byVeh.size > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 p-4 border-b border-gray-100">Rentabilité par véhicule</p>
          {[...byVeh.values()].map((v, i) => {
            const profit = v.revenue - v.expenses
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-gray-900">{v.name}</p>
                  <p className="text-[11px] text-gray-400">{v.plate}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-bold text-green-600">+{formatPrice(v.revenue)}</p>
                  <p className="text-[11px] text-red-400">−{formatPrice(v.expenses)}</p>
                </div>
                <div className={`text-right w-20 ${profit >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                  <p className="text-[14px] font-black">{formatPrice(profit)}</p>
                  <p className="text-[10px] text-gray-400">net</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Exports & graphiques */}
      <div className="flex gap-2">
        <a href={`/accounting/export/pdf?month=${month}&year=${year}`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-100 shadow-sm rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50">
          📄 PDF
        </a>
        <a href={`/accounting/export/excel?month=${month}&year=${year}`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-100 shadow-sm rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50">
          📊 Excel
        </a>
        <Link href="/accounting/charts"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-gray-100 shadow-sm rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50">
          📈 Graphiques
        </Link>
      </div>

      {/* Mouvements — marquer une ligne transparente la déduit du bilan et des exports ci-dessus */}
      {!isClosed && all.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
            Mouvements du mois
          </p>
          <AccountingTransactions transactions={all} />
        </div>
      )}

      {!isClosed && <CloseButton mode="monthly" month={month} year={year} />}
    </div>
  )
}
