'use client'

import { useState } from 'react'
import { Pencil, Check, X, Loader2, CalendarClock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { updateReservationDates } from '@/lib/actions/reservations'
import { formatPrice, calculateRentalDays, calculateRentalPrice } from '@/lib/utils'

interface Props {
  reservationId: string
  startDatetime: string
  endDatetime: string
  dailyPrice: number
  weeklyPrice: number | null
  currentTotal: number
  reservationStatus: string
  /** 'hero' : bouton intégré à l'encadré noir en haut de la fiche résa. */
  variant?: 'inline' | 'hero'
}

function toInputValue(iso: string) {
  if (!iso) return ''
  return iso.slice(0, 16)
}

export default function EditDatesPanel({
  reservationId,
  startDatetime,
  endDatetime,
  dailyPrice,
  weeklyPrice,
  currentTotal,
  reservationStatus,
  variant = 'inline',
}: Props) {
  const [editing, setEditing] = useState(false)
  const [start, setStart]     = useState(toInputValue(startDatetime))
  const [end, setEnd]         = useState(toInputValue(endDatetime))
  // Chaîne (et non nombre) : vider le champ ne force plus un « 0 » fantôme.
  const [price, setPrice]     = useState(String(dailyPrice))
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [saved, setSaved]     = useState(false)

  const priceNum = price === '' ? 0 : Number(price)
  const days     = start && end ? calculateRentalDays(start, end) : 0
  const newTotal = days > 0 ? calculateRentalPrice(priceNum, weeklyPrice, days) : 0
  const delta    = newTotal - currentTotal
  const isLocked = reservationStatus === 'terminee' || reservationStatus === 'annulee'

  async function handleSave() {
    setError(null)
    setLoading(true)
    const result = await updateReservationDates(reservationId, start, end, priceNum)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setEditing(false)
      }, 1400)
    }
  }

  function handleCancel() {
    setStart(toInputValue(startDatetime))
    setEnd(toInputValue(endDatetime))
    setPrice(String(dailyPrice))
    setError(null)
    setEditing(false)
  }

  if (!editing) {
    // Mode hero : lien dans l'encadré noir, à côté de « Prolonger la
    // location » (même style) — ticket SAV 23/07.
    if (variant === 'hero') {
      return (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 font-semibold transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Modifier les dates &amp; tarif
        </button>
      )
    }
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-2 transition-colors"
      >
        <Pencil className="w-3 h-3" />
        Modifier les dates &amp; tarif
      </button>
    )
  }

  return (
    // En mode hero, w-full fait passer le panneau sous la ligne des badges
    // (flex-wrap) ; max-w-2xl évite des champs démesurés sur grand écran.
    <div className={`mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 ${
      variant === 'hero' ? 'w-full max-w-2xl' : ''
    }`}>
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-800">Modifier les dates &amp; tarif</p>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-amber-700 font-medium uppercase tracking-wide mb-1">
            Départ
          </label>
          <input
            type="datetime-local"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label className="block text-xs text-amber-700 font-medium uppercase tracking-wide mb-1">
            Retour
          </label>
          <input
            type="datetime-local"
            value={end}
            onChange={e => setEnd(e.target.value)}
            min={start}
            className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Prix / jour */}
      <div>
        <label className="block text-xs text-amber-700 font-medium uppercase tracking-wide mb-1">
          Prix par jour (€)
        </label>
        <div className="relative max-w-[220px]">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400 pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
        </div>
        {weeklyPrice && (
          <p className="text-xs text-amber-600 mt-0.5">
            Tarif semaine : {formatPrice(weeklyPrice)} — appliqué auto si ≥ 7 jours
          </p>
        )}
      </div>

      {/* Récapitulatif */}
      {days > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{days} jour{days > 1 ? 's' : ''} × {formatPrice(priceNum)}</span>
            <span className="font-bold text-gray-800 text-sm">{formatPrice(newTotal)}</span>
          </div>
          {newTotal !== currentTotal && (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${delta > 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
              {delta > 0
                ? <TrendingUp className="w-3.5 h-3.5" />
                : <TrendingDown className="w-3.5 h-3.5" />}
              <span>
                {delta > 0 ? '+' : ''}{formatPrice(delta)} vs total actuel ({formatPrice(currentTotal)})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Avertissement */}
      {(reservationStatus === 'en_cours' || reservationStatus === 'en_retard') && (
        <div className="flex items-start gap-2 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Location en cours — la modification recalculera le total et mettra à jour le calendrier.</span>
        </div>
      )}

      {isLocked && (
        <div className="flex items-start gap-2 text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>La réservation est {reservationStatus === 'terminee' ? 'terminée' : 'annulée'}. La modification est à but correctif uniquement.</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading || days <= 0 || priceNum <= 0}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
            saved
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Check className="w-3.5 h-3.5" />}
          {saved ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
        <button
          onClick={handleCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </div>
  )
}
