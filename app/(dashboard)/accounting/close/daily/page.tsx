import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice, formatDate } from '@/lib/utils'
import DailyCloseReconcile from '../DailyCloseReconcile'
import DayPicker from '../DayPicker'

export default async function DailyClosingPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dp } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  // Date sélectionnée (par défaut aujourd'hui) — permet de consulter/clôturer un jour passé.
  const today = dp || new Date().toISOString().slice(0, 10)
  const [{ data: closing }, { data: txs }] = await Promise.all([
    supabase.from('daily_closings').select('*').eq('date', today).maybeSingle(),
    supabase.from('financial_transactions').select('type, amount, payment_method').eq('date', today),
  ])

  const rev = (txs ?? []).filter(t => t.type === 'recette').reduce((s, t) => s + (t.amount ?? 0), 0)
  const exp = (txs ?? []).filter(t => t.type === 'depense').reduce((s, t) => s + (t.amount ?? 0), 0)
  const net = rev - exp
  const isClosed = closing?.is_closed

  // Répartition des recettes par mode d'encaissement — figée si déjà clôturé,
  // recalculée en direct sinon (mêmes transactions, juste pas encore gelées).
  const byMethod: Record<string, number> = isClosed
    ? (closing!.revenue_by_payment_method ?? {})
    : (txs ?? []).filter(t => t.type === 'recette').reduce((acc: Record<string, number>, t) => {
        const m = t.payment_method || 'carte'
        acc[m] = (acc[m] ?? 0) + (t.amount ?? 0)
        return acc
      }, {})

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/accounting" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Comptabilité
      </BackButton>

      <div className="space-y-2">
        <h1 className="text-xl font-black text-gray-900">Clôture journalière</h1>
        <p className="text-sm text-gray-400 capitalize">{formatDate(today)}</p>
        <DayPicker date={today} />
      </div>

      {isClosed && (
        <div className="flex items-center gap-2 py-3 px-4 bg-green-50 border border-green-100 rounded-2xl text-sm font-semibold text-green-700">
          <CheckCircle2 className="w-4 h-4" /> Journée clôturée
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Recettes</p>
          <p className="text-[24px] font-black text-green-600 leading-none">{formatPrice(isClosed ? closing!.total_revenue : rev)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Dépenses</p>
          <p className="text-[24px] font-black text-red-500 leading-none">{formatPrice(isClosed ? closing!.total_expenses : exp)}</p>
        </div>
      </div>
      <div className="bg-[#111111] rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">Résultat net du jour</p>
        <p className="text-[32px] font-black text-white leading-none">
          {(isClosed ? closing!.net_result : net) >= 0 ? '+' : ''}{formatPrice(isClosed ? closing!.net_result : net)}
        </p>
        <p className="text-xs text-white/50 mt-1">{txs?.length ?? 0} mouvement(s)</p>
      </div>

      <DailyCloseReconcile
        date={today}
        softwareByMethod={byMethod}
        softwareRevenue={isClosed ? (closing!.total_revenue ?? 0) : rev}
        isClosed={!!isClosed}
        countedByMethod={(closing?.counted_by_method as Record<string, number>) ?? {}}
        variance={closing?.variance ?? null}
      />
    </div>
  )
}
