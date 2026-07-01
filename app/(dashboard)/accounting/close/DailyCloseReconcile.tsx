'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Unlock, CheckCircle2, AlertTriangle } from 'lucide-react'
import { closeDailyAccounting, reopenDailyClosing } from '@/lib/actions/accounting'
import { paymentMethodLabel } from '@/lib/accounting/categories'
import { formatPrice } from '@/lib/utils'

export default function DailyCloseReconcile({
  date, softwareByMethod, softwareRevenue, isClosed, countedByMethod, variance,
}: {
  date: string
  softwareByMethod: Record<string, number>   // recettes logiciel par mode
  softwareRevenue: number
  isClosed: boolean
  countedByMethod: Record<string, number>    // réel compté figé (si clôturé)
  variance: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Replie l'ancien bucket « non précisé » sur Carte bancaire (mode par défaut).
  const foldLegacy = (src: Record<string, number>): Record<string, number> => {
    const out = { ...src }
    if (out.non_precise != null) { out.carte = (out.carte ?? 0) + out.non_precise; delete out.non_precise }
    return out
  }
  const software = foldLegacy(softwareByMethod)
  const counted0 = foldLegacy(countedByMethod)

  // Modes à réconcilier : ceux encaissés aujourd'hui + carte/virement/espèces toujours présents.
  const methods = [...new Set([...Object.keys(software), 'carte', 'virement', 'especes'])]
  // Inputs pré-remplis avec le montant logiciel → l'utilisateur confirme ou corrige.
  const [counted, setCounted] = useState<Record<string, string>>(
    Object.fromEntries(methods.map(m => [m, String(software[m] ?? 0)])),
  )

  const parse = (s: string) => { const n = parseFloat((s || '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
  const liveCounted = methods.reduce((s, m) => s + parse(counted[m]), 0)
  const liveVariance = liveCounted - softwareRevenue

  function onClose() {
    setError(null)
    const payload = Object.fromEntries(methods.map(m => [m, parse(counted[m])]))
    startTransition(async () => {
      const res = await closeDailyAccounting(date, payload)
      if (res?.error) setError(res.error); else router.refresh()
    })
  }
  function onReopen() {
    setError(null)
    startTransition(async () => {
      const res = await reopenDailyClosing(date)
      if (res?.error) setError(res.error); else router.refresh()
    })
  }

  // ── Vue clôturée : figé + écart ──
  if (isClosed) {
    const v = variance ?? 0
    return (
      <div className="space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Rapprochement de caisse (figé)</p>
          <div className="space-y-1.5">
            {methods.map(m => (
              <div key={m} className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{paymentMethodLabel(m)}</span>
                <span className="text-gray-400">
                  logiciel {formatPrice(software[m] ?? 0)} · réel <span className="font-bold text-gray-900">{formatPrice(counted0[m] ?? 0)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={`flex items-center gap-2 py-3 px-4 rounded-2xl text-sm font-semibold border ${
          Math.abs(v) < 0.01 ? 'bg-green-50 border-green-100 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {Math.abs(v) < 0.01
            ? (<><CheckCircle2 className="w-4 h-4" /> Aucun écart de saisie — caisse juste</>)
            : (<><AlertTriangle className="w-4 h-4" /> Écart de saisie : {v > 0 ? '+' : ''}{formatPrice(v)} {v > 0 ? '(réel supérieur au saisi : recette à enregistrer ?)' : '(réel inférieur au saisi : sortie non comptée ?)'}</>)}
        </div>
        <button onClick={onReopen} disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          <Unlock className="w-4 h-4" /> {pending ? '…' : 'Rouvrir la clôture'}
        </button>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      </div>
    )
  }

  // ── Vue ouverte : saisie du réel compté + écart en direct ──
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Rapprochement de caisse</p>
        <p className="text-xs text-gray-400 mb-3">Saisis l'encaissement réellement compté par mode — l'écart avec le logiciel apparaît en bas.</p>
        <div className="space-y-2">
          {methods.map(m => (
            <div key={m} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-600">{paymentMethodLabel(m)}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-20 text-right">{formatPrice(software[m] ?? 0)}</span>
                <div className="relative">
                  <input
                    inputMode="decimal"
                    value={counted[m] ?? ''}
                    onChange={e => setCounted(c => ({ ...c, [m]: e.target.value }))}
                    className="w-24 text-sm text-right border border-gray-200 rounded-lg pl-2 pr-5 py-1.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="text-sm font-semibold text-gray-700">Écart (réel − logiciel)</span>
          <span className={`text-sm font-black ${Math.abs(liveVariance) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
            {liveVariance > 0 ? '+' : ''}{formatPrice(liveVariance)}
          </span>
        </div>
      </div>
      <button onClick={onClose} disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99] disabled:opacity-40">
        <Lock className="w-4 h-4" /> {pending ? 'Clôture…' : 'Clôturer la journée'}
      </button>
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
    </div>
  )
}
