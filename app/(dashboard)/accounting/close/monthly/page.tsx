import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import { getCategoryLabel, paymentMethodLabel, expenseNature } from '@/lib/accounting/categories'
import CloseButton from '../CloseButton'
import ReopenClosingButton from '../ReopenClosingButton'
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
  // Mois précédent (pour l'analyse de variation)
  const pm = month === 1 ? 12 : month - 1
  const py = month === 1 ? year - 1 : year
  const pFrom = `${py}-${String(pm).padStart(2, '0')}-01`
  const pTo = new Date(py, pm, 0).toISOString().slice(0, 10)

  const [{ data: closing }, { data: txs }, { data: prevTxs }] = await Promise.all([
    supabase.from('monthly_closings').select('*').eq('month', month).eq('year', year).maybeSingle(),
    supabase.from('financial_transactions').select('*, vehicles(plate, brand, model)').gte('date', from).lte('date', to),
    supabase.from('financial_transactions').select('type, category, amount, is_transparent').gte('date', pFrom).lte('date', pTo),
  ])

  const isClosed = closing?.is_closed
  // Mois clôturé → on affiche le SNAPSHOT FIGÉ (pris à la clôture), pas le recalcul
  // live, pour garantir un historique stable. Sinon, données en direct.
  const snap = (closing?.snapshot as { transactions?: any[] } | null)?.transactions
  const all = isClosed && Array.isArray(snap) ? snap : (txs ?? [])

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

  const byMethod = new Map<string, number>()
  for (const t of visible) {
    if (t.type !== 'recette') continue
    const m = t.payment_method || 'non_precise'
    byMethod.set(m, (byMethod.get(m) ?? 0) + (t.amount ?? 0))
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

  // Charges fixes vs variables (sur les dépenses) — demandé au cahier des charges.
  let chargesFixes = 0, chargesVariables = 0
  for (const t of visible) {
    if (t.type !== 'depense') continue
    if (expenseNature(t.category) === 'fixe') chargesFixes += t.amount ?? 0
    else chargesVariables += t.amount ?? 0
  }

  // ── Analyse de variation vs mois précédent (expliquer une baisse de rentabilité) ──
  const pv = (prevTxs ?? []).filter(t => !t.is_transparent)
  const prevRev = pv.filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const prevExp = pv.filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)
  const prevNet = prevRev - prevExp
  const expNow = new Map<string, number>()
  for (const t of visible) if (t.type === 'depense') expNow.set(t.category, (expNow.get(t.category) ?? 0) + (t.amount ?? 0))
  const expPrev = new Map<string, number>()
  for (const t of pv) if (t.type === 'depense') expPrev.set(t.category, (expPrev.get(t.category) ?? 0) + (t.amount ?? 0))
  const catDeltas = [...new Set([...expNow.keys(), ...expPrev.keys()])]
    .map(c => ({ cat: c, delta: (expNow.get(c) ?? 0) - (expPrev.get(c) ?? 0) }))
    .filter(d => Math.abs(d.delta) > 0.01)
    .sort((a, b) => b.delta - a.delta)
  const hasPrev = pv.length > 0
  const fmtDelta = (n: number) => `${n >= 0 ? '+' : '−'}${formatPrice(Math.abs(n))}`

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

      {/* Charges fixes vs variables */}
      {(chargesFixes > 0 || chargesVariables > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Charges fixes</p>
            <p className="text-lg font-black text-gray-900">{formatPrice(chargesFixes)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">assurance, loyers, salaires…</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Charges variables</p>
            <p className="text-lg font-black text-gray-900">{formatPrice(chargesVariables)}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">carburant, entretien, réparations…</p>
          </div>
        </div>
      )}

      {/* Analyse de variation vs mois précédent */}
      {hasPrev && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Variation vs {MONTHS[pm - 1]} {py}</p>
          <div className="grid grid-cols-3 gap-3 mb-1">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">CA</p>
              <p className={`text-sm font-black ${rev - prevRev >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtDelta(rev - prevRev)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Dépenses</p>
              <p className={`text-sm font-black ${exp - prevExp <= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtDelta(exp - prevExp)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Bénéfice</p>
              <p className={`text-sm font-black ${net - prevNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtDelta(net - prevNet)}</p>
            </div>
          </div>
          {net - prevNet < 0 && catDeltas.some(d => d.delta > 0) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Postes de dépense en hausse</p>
              <div className="space-y-1">
                {catDeltas.filter(d => d.delta > 0).slice(0, 4).map(d => (
                  <div key={d.cat} className="flex items-center justify-between text-[13px]">
                    <span className="text-gray-600">{getCategoryLabel(d.cat)}</span>
                    <span className="font-bold text-red-500">{fmtDelta(d.delta)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Encaissements par type */}
      {byMethod.size > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 p-4 border-b border-gray-100">Encaissements par type</p>
          {[...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
            <div key={method} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <p className="text-[13px] font-medium text-gray-900">{paymentMethodLabel(method)}</p>
              <p className="text-sm font-black text-green-600">{formatPrice(amount)}</p>
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
      {isClosed && <ReopenClosingButton mode="monthly" month={month} year={year} />}
    </div>
  )
}
