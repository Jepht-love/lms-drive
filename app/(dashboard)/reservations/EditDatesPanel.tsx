'use client'

import { useState } from 'react'
import { Pencil, Check, X, Loader2, CalendarClock, AlertTriangle, TrendingUp, TrendingDown, BadgePercent } from 'lucide-react'
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
  // Date et heure SÉPARÉES : sur Safari, un datetime-local a une largeur
  // incompressible qui déborde de sa colonne (constaté en prod le 23/07).
  // Deux champs compacts (date + time) tiennent partout, sur tous les moteurs.
  const [startDate, setStartDate] = useState(toInputValue(startDatetime).slice(0, 10))
  const [startTime, setStartTime] = useState(toInputValue(startDatetime).slice(11, 16))
  const [endDate, setEndDate]     = useState(toInputValue(endDatetime).slice(0, 10))
  const [endTime, setEndTime]     = useState(toInputValue(endDatetime).slice(11, 16))
  const start = startDate && startTime ? `${startDate}T${startTime}` : ''
  const end   = endDate && endTime ? `${endDate}T${endTime}` : ''
  // Deux façons de fixer le tarif (ticket SAV 23/07) : par taux journalier OU
  // directement par prix total (prix négocié → la réduction est mentionnée).
  const [mode, setMode]       = useState<'daily' | 'total'>('daily')
  // Chaînes (et non nombres) : vider un champ ne force plus un « 0 » fantôme.
  const [price, setPrice]     = useState(String(dailyPrice))
  const [total, setTotal]     = useState(String(currentTotal))
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [saved, setSaved]     = useState(false)

  const priceNum  = price === '' ? 0 : Number(price)
  const totalNum  = total === '' ? 0 : Number(total)
  const days      = start && end ? calculateRentalDays(start, end) : 0
  // Tarif « standard » : ce que coûterait la période au barème (jour/semaine).
  const standard  = days > 0 ? calculateRentalPrice(mode === 'daily' ? priceNum : dailyPrice, weeklyPrice, days) : 0
  const newTotal  = mode === 'daily' ? standard : totalNum
  const discount  = mode === 'total' ? Math.round((standard - totalNum) * 100) / 100 : 0
  const delta     = newTotal - currentTotal
  const isLocked  = reservationStatus === 'terminee' || reservationStatus === 'annulee'
  const canSave   = days > 0 && (mode === 'daily' ? priceNum > 0 : totalNum > 0)

  async function handleSave() {
    setError(null)
    setLoading(true)
    const result = await updateReservationDates(
      reservationId,
      start,
      end,
      mode === 'daily' ? priceNum : undefined,
      mode === 'total' ? totalNum : undefined,
    )
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
    setStartDate(toInputValue(startDatetime).slice(0, 10))
    setStartTime(toInputValue(startDatetime).slice(11, 16))
    setEndDate(toInputValue(endDatetime).slice(0, 10))
    setEndTime(toInputValue(endDatetime).slice(11, 16))
    setPrice(String(dailyPrice))
    setTotal(String(currentTotal))
    setMode('daily')
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

  const baseCls  = 'w-full min-w-0 h-10 rounded-lg border border-amber-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400'
  const fieldCls = `${baseCls} px-3 text-[13px]`
  const dateCls  = `${baseCls} px-2.5 text-[13px]`
  const labelCls = 'block text-[11px] text-amber-700/80 font-bold uppercase tracking-wide mb-1.5'

  return (
    // En mode hero, w-full fait passer le panneau sous la ligne des badges
    // (flex-wrap) ; max-w-xl évite des champs démesurés sur grand écran.
    <div className={`mt-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-4 ${
      variant === 'hero' ? 'w-full max-w-xl' : ''
    }`}>
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <p className="text-sm font-bold text-amber-900">Modifier les dates &amp; tarif</p>
        <button onClick={handleCancel} className="ml-auto p-1.5 rounded-lg text-amber-500 hover:bg-amber-100 transition-colors" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dates — champs date + heure séparés : contrairement à datetime-local
          (largeur incompressible qui déborde sur Safari), ces deux contrôles
          compacts tiennent sur une ligne quel que soit le moteur. */}
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Départ</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={`${dateCls} flex-1`}
            />
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className={`${dateCls} w-[104px] flex-none`}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Retour</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate}
              className={`${dateCls} flex-1`}
            />
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className={`${dateCls} w-[104px] flex-none`}
            />
          </div>
        </div>
      </div>

      {/* Tarif : par jour OU prix total (négocié) */}
      <div>
        <label className={labelCls}>Tarif</label>
        <div className="grid grid-cols-2 gap-1 p-1 bg-amber-100/70 rounded-xl mb-2">
          <button
            type="button"
            onClick={() => setMode('daily')}
            className={`h-8 rounded-lg text-xs font-bold transition-colors ${
              mode === 'daily' ? 'bg-white text-amber-900 shadow-sm' : 'text-amber-700/70 hover:text-amber-900'
            }`}
          >
            Prix / jour
          </button>
          <button
            type="button"
            onClick={() => setMode('total')}
            className={`h-8 rounded-lg text-xs font-bold transition-colors ${
              mode === 'total' ? 'bg-white text-amber-900 shadow-sm' : 'text-amber-700/70 hover:text-amber-900'
            }`}
          >
            Prix total
          </button>
        </div>

        {mode === 'daily' ? (
          <>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className={`${fieldCls} pr-14`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">€ / jour</span>
            </div>
            {weeklyPrice != null && weeklyPrice > 0 && (
              <p className="text-[11px] text-amber-600 mt-1.5">
                Tarif semaine : {formatPrice(weeklyPrice)} — appliqué auto si ≥ 7 jours
              </p>
            )}
          </>
        ) : (
          <>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={total}
                onChange={e => setTotal(e.target.value)}
                className={`${fieldCls} pr-24`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">€ au total</span>
            </div>
            <p className="text-[11px] text-amber-600 mt-1.5">
              Prix négocié pour toute la période — le taux journalier reste la référence.
            </p>
          </>
        )}
      </div>

      {/* Récapitulatif */}
      {days > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl px-3.5 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {mode === 'daily'
                ? `${days} jour${days > 1 ? 's' : ''} × ${formatPrice(priceNum)}`
                : `Tarif standard (${days} jour${days > 1 ? 's' : ''} × ${formatPrice(dailyPrice)})`}
            </span>
            <span className={mode === 'total' && discount > 0 ? 'line-through text-gray-400' : 'font-bold text-gray-800 text-sm'}>
              {formatPrice(standard)}
            </span>
          </div>

          {mode === 'total' && discount > 0 && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                  <BadgePercent className="w-3.5 h-3.5" />
                  Réduction accordée
                </span>
                <span className="font-bold text-emerald-700">
                  −{formatPrice(discount)}{standard > 0 ? ` (−${Math.round((discount / standard) * 100)} %)` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
                <span className="text-gray-500">Prix appliqué</span>
                <span className="font-bold text-gray-900 text-sm">{formatPrice(totalNum)}</span>
              </div>
            </>
          )}

          {mode === 'total' && discount < 0 && (
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
              <span className="text-gray-500">Prix appliqué (majoré)</span>
              <span className="font-bold text-gray-900 text-sm">{formatPrice(totalNum)}</span>
            </div>
          )}

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
          disabled={loading || !canSave}
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
