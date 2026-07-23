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
        className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 font-semibold transition-colors"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        Prolonger la location
      </button>
    )
  }

  return (
    <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3 w-full">
      <div className="flex items-center gap-2">
        <CalendarPlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-blue-800">Prolonger la location</p>
      </div>

      {deadlinePassed ? (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
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
              <label className="block text-xs text-blue-700 font-medium uppercase tracking-wide mb-1">
                Jours en plus
              </label>
              <input
                type="number" min="1" step="1" inputMode="numeric" placeholder="1" value={daysStr}
                onChange={e => setDaysStr(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl border border-blue-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 font-medium uppercase tracking-wide mb-1">
                Prix / jour (€)
              </label>
              <input
                type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl border border-blue-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="bg-white border border-blue-200 rounded-xl px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Nouvelle fin</span>
              <span className="font-semibold text-gray-800">{formatDateTime(newEnd)}</span>
            </div>
            {addedKm > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Km inclus en plus ({kmIncludedDaily} km/j × {days})</span>
                <span className="font-semibold text-gray-800">+{addedKm.toLocaleString('fr-FR')} km</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-1.5">
              <span className="text-gray-500">Nouveau total ({totalDays} j)</span>
              <span className="font-bold text-blue-700 text-sm">{formatPrice(newTotal)}</span>
            </div>
            {added !== 0 && (
              <div className="text-xs font-medium text-emerald-600">
                {added > 0 ? '+' : ''}{formatPrice(added)} vs total actuel ({formatPrice(currentTotal)})
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-blue-700">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Prolongation possible jusqu&apos;à {DEADLINE_HOURS} h avant la fin prévue. Au-delà : nouvelle réservation.</span>
          </div>
        </>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {saved ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Prolongation enregistrée. Le prix du contrat est à jour (détail ajouté au PDF). Aucune nouvelle signature requise.</span>
          </div>
          <div className="flex gap-2">
            {contractId && (
              <button
                onClick={handleResend}
                disabled={resending || resent}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                  resent ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                {resent ? 'Contrat renvoyé ✓' : 'Renvoyer le contrat au client'}
              </button>
            )}
            <button
              onClick={() => { setOpen(false); setSaved(false); setResent(false); setError(null) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Confirmer la prolongation
            </button>
          )}
          <button
            onClick={() => { setOpen(false); setError(null) }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Fermer
          </button>
        </div>
      )}
    </div>
  )
}
