'use client'

import { useState } from 'react'
import { Pencil, Check, X, Loader2, CalendarClock, AlertTriangle, TrendingUp, TrendingDown, BadgePercent } from 'lucide-react'
import { updateReservationDates } from '@/lib/actions/reservations'
import { formatPrice, calculateRentalDays, calculateRentalPrice } from '@/lib/utils'
import DateTimeField from '@/components/ui/DateTimeField'

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
  // DateTimeField (date + heure séparés) : jamais de datetime-local — largeur
  // incompressible sur Safari. Le composant isole les largeurs dans ses propres
  // conteneurs, aucun conflit de classes possible.
  const [start, setStart] = useState(toInputValue(startDatetime))
  const [end, setEnd]     = useState(toInputValue(endDatetime))
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
  // Prix de revient à la journée quand on négocie un prix total (ticket 24/07) :
  // le gérant voit à combien revient réellement la journée après remise.
  const effectiveDaily = mode === 'total' && days > 0 ? Math.round((totalNum / days) * 100) / 100 : 0
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
    setStart(toInputValue(startDatetime))
    setEnd(toInputValue(endDatetime))
    setPrice(String(dailyPrice))
    setTotal(String(currentTotal))
    setMode('daily')
    setError(null)
    setEditing(false)
  }

  if (!editing) {
    // Mode hero : bouton bien visible dans l'encadré foncé, à côté de
    // « Prolonger la location » (même style pilule) — ticket SAV 23/07.
    if (variant === 'hero') {
      return (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-white font-semibold transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-amber-300" />
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

  // Panneau « dark glass » (style shadcn) : translucide, s'adapte à tous les fonds
  // de hero (noir/bleu/rouge/gris selon le statut) et reste lisible partout.
  // Aucune boîte blanche (choix Jepht 23/07) : le sombre remplace l'ancien ambre.
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-white/50 mb-1.5'
  const fieldCls = 'flex items-center rounded-xl border border-white/15 bg-white/5 transition focus-within:border-white/25 focus-within:ring-2 focus-within:ring-white/10'
  const numCls   = 'flex-1 min-w-0 bg-transparent border-0 outline-none px-3 py-2.5 text-sm text-white [color-scheme:dark] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
  const tabCls = (on: boolean) =>
    `min-h-[auto] h-8 px-3.5 rounded-md text-xs font-bold transition-colors ${on ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'}`

  return (
    // En mode hero, w-full fait passer le panneau sous la ligne des badges
    // (flex-wrap) ; max-w-xl évite des champs démesurés sur grand écran.
    <div className={`mt-3 p-4 bg-black/40 border border-white/15 rounded-2xl backdrop-blur-sm space-y-4 ${
      variant === 'hero' ? 'w-full max-w-xl' : ''
    }`}>
      <div className="flex items-center gap-2">
        <CalendarClock className="w-4 h-4 text-white/60 flex-shrink-0" />
        <p className="text-sm font-bold text-white">Modifier les dates &amp; tarif</p>
        <button onClick={handleCancel} className="ml-auto p-1.5 rounded-lg text-white/50 hover:bg-white/10 transition-colors" aria-label="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dates — DateTimeField groupé, ton sombre. */}
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Départ</label>
          <DateTimeField value={start} onChange={setStart} grouped tone="dark" />
        </div>
        <div>
          <label className={labelCls}>Retour</label>
          <DateTimeField value={end} onChange={setEnd} min={start} grouped tone="dark" />
        </div>
      </div>

      {/* Tarif : par jour OU prix total (négocié) — onglets segmentés shadcn. */}
      <div>
        <div className="inline-flex p-0.5 rounded-lg bg-white/10 mb-3">
          <button type="button" onClick={() => setMode('daily')} className={tabCls(mode === 'daily')}>
            Prix / jour
          </button>
          <button type="button" onClick={() => setMode('total')} className={tabCls(mode === 'total')}>
            Prix total
          </button>
        </div>

        {mode === 'daily' ? (
          <>
            <div className={fieldCls}>
              <input
                type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
                value={price} onChange={e => setPrice(e.target.value)} className={numCls}
              />
              <span className="pr-3 text-xs font-semibold text-white/45 whitespace-nowrap">€ / jour</span>
            </div>
            {weeklyPrice != null && weeklyPrice > 0 && (
              <p className="text-[11px] text-white/45 mt-1.5">
                Tarif semaine : {formatPrice(weeklyPrice)} — appliqué auto si ≥ 7 jours
              </p>
            )}
          </>
        ) : (
          <>
            <div className={fieldCls}>
              <input
                type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
                value={total} onChange={e => setTotal(e.target.value)} className={numCls}
              />
              <span className="pr-3 text-xs font-semibold text-white/45 whitespace-nowrap">€ au total</span>
            </div>
            <p className="text-[11px] text-white/45 mt-1.5">
              Prix négocié pour toute la période — le taux journalier reste la référence.
            </p>
          </>
        )}
      </div>

      {/* Récapitulatif */}
      {days > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>
              {mode === 'daily'
                ? `${days} jour${days > 1 ? 's' : ''} × ${formatPrice(priceNum)}`
                : `Tarif standard (${days} jour${days > 1 ? 's' : ''} × ${formatPrice(dailyPrice)})`}
            </span>
            <span className={mode === 'total' && discount > 0 ? 'line-through text-white/40' : 'font-bold text-white text-sm'}>
              {formatPrice(standard)}
            </span>
          </div>

          {mode === 'total' && discount > 0 && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 font-bold text-emerald-300">
                  <BadgePercent className="w-3.5 h-3.5" />
                  Réduction accordée
                </span>
                <span className="font-bold text-emerald-300">
                  −{formatPrice(discount)}{standard > 0 ? ` (−${Math.round((discount / standard) * 100)} %)` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/10">
                <span className="text-white/60">Prix appliqué</span>
                <span className="font-bold text-white text-sm">{formatPrice(totalNum)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span>Soit à la journée</span>
                <span className="font-semibold">{formatPrice(effectiveDaily)} / jour</span>
              </div>
            </>
          )}

          {mode === 'total' && discount < 0 && (
            <>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-white/10">
                <span className="text-white/60">Prix appliqué (majoré)</span>
                <span className="font-bold text-white text-sm">{formatPrice(totalNum)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span>Soit à la journée</span>
                <span className="font-semibold">{formatPrice(effectiveDaily)} / jour</span>
              </div>
            </>
          )}

          {newTotal !== currentTotal && (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${delta > 0 ? 'text-emerald-300' : 'text-orange-300'}`}>
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
        <div className="flex items-start gap-2 text-xs text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Location en cours — la modification recalculera le total et mettra à jour le calendrier.</span>
        </div>
      )}

      {isLocked && (
        <div className="flex items-start gap-2 text-xs text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>La réservation est {reservationStatus === 'terminee' ? 'terminée' : 'annulée'}. La modification est à but correctif uniquement.</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading || !canSave}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
            saved
              ? 'bg-emerald-400/15 text-emerald-300'
              : 'bg-white text-[#111111] hover:bg-white/90'
          }`}
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Check className="w-3.5 h-3.5" />}
          {saved ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
        <button
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-white/20 text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </div>
  )
}
