'use client'

import { useState } from 'react'
import { CalendarPlus, Check, X, Loader2, AlertTriangle, Clock, Mail } from 'lucide-react'
import { prolongReservation } from '@/lib/actions/reservations'
import { formatPrice, formatDateTime, calculateRentalDays, calculateRentalPrice } from '@/lib/utils'

interface Props {
  reservationId: string
  contractId?: string
  startDatetime: string
  endDatetime: string
  dailyPrice: number
  weeklyPrice: number | null
  currentTotal: number
  kmIncludedDaily: number | null
  reservationStatus: string
}

const DEADLINE_HOURS = 12

export default function ProlongReservation({
  reservationId,
  contractId,
  startDatetime,
  endDatetime,
  dailyPrice,
  weeklyPrice,
  currentTotal,
  kmIncludedDaily,
  reservationStatus,
}: Props) {
  const [open, setOpen] = useState(false)
  // Chaînes (et non nombres) : vider un champ ne force plus un chiffre fantôme.
  const [daysStr, setDaysStr] = useState('1')
  const [priceStr, setPriceStr] = useState(String(dailyPrice))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const days = daysStr === '' ? 0 : Math.max(0, Math.floor(Number(daysStr)))
  const price = priceStr === '' ? 0 : Number(priceStr)
  const endMs = new Date(endDatetime).getTime()
  const newEnd = new Date(endMs + days * 24 * 3600 * 1000).toISOString()
  const totalDays = days > 0 ? calculateRentalDays(startDatetime, newEnd) : 0
  const newTotal = totalDays > 0 ? calculateRentalPrice(price, weeklyPrice, totalDays) : 0
  const added = newTotal - currentTotal
  const addedKm = (kmIncludedDaily ?? 0) * days
  // Garde-fou 12 h (indicatif — le serveur fait foi)
  const deadlinePassed = Date.now() > endMs - DEADLINE_HOURS * 3600 * 1000

  async function handleSave() {
    setError(null)
    setLoading(true)
    const result = await prolongReservation(reservationId, days, price)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSaved(true)
    }
  }

  async function handleResend() {
    if (!contractId) return
    setResending(true)
    setError(null)
    try {
      const res = await fetch('/api/contracts/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) { setError(data?.error ?? "Échec de l'envoi") ; return }
      setResent(true)
    } catch {
      setError("Erreur réseau lors de l'envoi")
    } finally {
      setResending(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-semibold transition-colors"
      >
        <CalendarPlus className="w-3.5 h-3.5 text-blue-300" />
        Prolonger la location
      </button>
    )
  }

  // Panneau « dark glass » (style shadcn) — cohérent avec « Modifier tarif » :
  // translucide, s'adapte à tous les fonds de hero, aucune boîte blanche.
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-white/50 mb-1'
  const inputCls = 'w-full min-w-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white [color-scheme:dark] outline-none transition focus:border-white/25 focus:ring-2 focus:ring-white/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  return (
    <div className="mt-3 p-4 bg-black/40 border border-white/15 rounded-2xl backdrop-blur-sm space-y-3 w-full max-w-xl">
      <div className="flex items-center gap-2">
        <CalendarPlus className="w-4 h-4 text-white/60 flex-shrink-0" />
        <p className="text-sm font-bold text-white">Prolonger la location</p>
        <button onClick={() => { setOpen(false); setError(null) }} className="ml-auto p-1.5 rounded-lg text-white/50 hover:bg-white/10 transition-colors" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {deadlinePassed ? (
        <div className="flex items-start gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
          <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Le délai de prolongation ({DEADLINE_HOURS} h avant la fin prévue, le {formatDateTime(endDatetime)})
            est dépassé. Créez une nouvelle réservation pour ce client.
          </span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Jours en plus</label>
              <input
                type="number" min="1" step="1" inputMode="numeric" placeholder="1" value={daysStr}
                onChange={e => setDaysStr(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Prix / jour (€)</label>
              <input
                type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Nouvelle fin</span>
              <span className="font-semibold text-white">{formatDateTime(newEnd)}</span>
            </div>
            {addedKm > 0 && (
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Km inclus en plus ({kmIncludedDaily} km/j × {days})</span>
                <span className="font-semibold text-white">+{addedKm.toLocaleString('fr-FR')} km</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs border-t border-white/10 pt-1.5">
              <span className="text-white/60">Nouveau total ({totalDays} j)</span>
              <span className="font-bold text-white text-sm">{formatPrice(newTotal)}</span>
            </div>
            {added !== 0 && (
              <div className="text-xs font-medium text-emerald-300">
                {added > 0 ? '+' : ''}{formatPrice(added)} vs total actuel ({formatPrice(currentTotal)})
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Prolongation possible jusqu&apos;à {DEADLINE_HOURS} h avant la fin prévue. Au-delà : nouvelle réservation.</span>
          </div>
        </>
      )}

      {error && <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>}

      {saved ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-emerald-300 bg-emerald-400/15 border border-emerald-400/20 rounded-lg px-3 py-2.5">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Prolongation enregistrée. Le prix du contrat est à jour (détail ajouté au PDF). Aucune nouvelle signature requise.</span>
          </div>
          <div className="flex gap-2">
            {contractId && (
              <button
                onClick={handleResend}
                disabled={resending || resent}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 ${
                  resent ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white text-[#111111] hover:bg-white/90'
                }`}
              >
                {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                {resent ? 'Contrat renvoyé ✓' : 'Renvoyer le contrat au client'}
              </button>
            )}
            <button
              onClick={() => { setOpen(false); setSaved(false); setResent(false); setError(null) }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-white/20 text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Fermer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {!deadlinePassed && (
            <button
              onClick={handleSave}
              disabled={loading || days < 1 || price <= 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 bg-white text-[#111111] hover:bg-white/90"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Confirmer la prolongation
            </button>
          )}
          <button
            onClick={() => { setOpen(false); setError(null) }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-white/20 text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Fermer
          </button>
        </div>
      )}
    </div>
  )
}
