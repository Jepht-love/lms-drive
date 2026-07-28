'use client'

import { useRef, useState } from 'react'
import { HandCoins, Check, X, Loader2, Plus, Trash2 } from 'lucide-react'
import { createReceivable } from '@/lib/actions/dueDates'
import { formatPrice } from '@/lib/utils'
import DatePickerField from '@/components/ui/DatePickerField'

interface ReservationChoice {
  id: string
  /** « RES-2607-9768 — Mohamed-amine Baazaoui · BMW Série 1 » */
  label: string
  /** Reste dû de cette réservation, créances déjà ouvertes déduites. */
  remaining: number
  /** Prix total de la location. */
  totalPrice: number
  /** Déjà encaissé. */
  paid: number
  /** Déjà placé en créance, non encore encaissé. */
  alreadyDue: number
  /** Échéance par défaut (YYYY-MM-DD) = date de retour. */
  defaultDueDate: string
}

interface Props {
  /** Fiche réservation : la créance est rattachée à CETTE réservation. */
  reservationId?: string
  /** Reste dû = total − déjà encaissé. Pré-remplit le montant de la 1re échéance. */
  remaining?: number
  /** Échéance par défaut (YYYY-MM-DD). */
  defaultDueDate?: string
  /**
   * Écran Créances : aucune réservation n'est imposée, on la choisit dans la
   * liste. Demande du gérant du 27/07/2026 — il ne voulait plus avoir à passer
   * par une fiche réservation pour enregistrer une créance.
   */
  reservations?: ReservationChoice[]
}

interface Echeance {
  /** Identité de la ligne, stable tant qu'elle existe : sans elle, supprimer
   *  une échéance ferait glisser le contenu saisi des lignes suivantes. */
  id: number
  amount: string
  dueDate: string
}

export default function CreateReceivableButton({
  reservationId,
  remaining = 0,
  defaultDueDate = '',
  reservations,
}: Props) {
  const [open, setOpen] = useState(false)
  // Mode « choix libre » quand la liste est fournie (écran Créances).
  const picking = Array.isArray(reservations)
  const [chosenId, setChosenId] = useState(reservationId ?? '')
  // Une créance peut être découpée en plusieurs échéances (paiement échelonné).
  // On démarre avec une seule ligne pré-remplie au reste dû.
  const nextEcheanceId = useRef(1)
  const [echeances, setEcheances] = useState<Echeance[]>([
    { id: 0, amount: remaining > 0 ? String(remaining) : '', dueDate: defaultDueDate },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const choisie = reservations?.find(r => r.id === chosenId)
  const total = echeances.reduce((s, e) => s + (e.amount === '' ? 0 : Number(e.amount)), 0)
  const valid = !!chosenId && echeances.every(e => Number(e.amount) > 0 && e.dueDate)

  // Choisir une réservation pré-remplit la première échéance avec son reste dû
  // et sa date de retour, comme le fait la fiche réservation.
  function chooseReservation(id: string) {
    setChosenId(id)
    const r = reservations?.find(x => x.id === id)
    if (!r) return
    setEcheances([{ id: 0, amount: r.remaining > 0 ? String(r.remaining) : '', dueDate: r.defaultDueDate }])
  }

  function updateEcheance(i: number, patch: Partial<Echeance>) {
    setEcheances(prev => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }
  function addEcheance() {
    setEcheances(prev => [...prev, { id: nextEcheanceId.current++, amount: '', dueDate: defaultDueDate }])
  }
  function removeEcheance(i: number) {
    setEcheances(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    setError(null)
    setLoading(true)
    const fd = new FormData()
    fd.set('reservation_id', chosenId)
    fd.set('echeances', JSON.stringify(
      echeances.map(e => ({ amount: Number(e.amount), due_date: e.dueDate }))
    ))
    try {
      const res = await createReceivable(fd)
      if (res?.error) { setError(res.error); return }
      setSaved(true)
      setTimeout(() => { setSaved(false); setOpen(false) }, 1400)
    } catch {
      setError('Erreur réseau : la créance n’a pas été créée. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // Même langage visuel que « Modifier les dates & tarif » (EditDatesPanel) :
  // carte SOMBRE, champs bg-white/5 bordés blancs, texte blanc, bouton primaire
  // blanc, accent émeraude. La Créance étant sur une section blanche, la carte
  // est un #111 PLEIN (le bg-black/40 translucide n'a de sens que sur le hero).
  const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-white/50 mb-1.5'
  const fieldCls = 'flex items-center rounded-xl border border-white/15 bg-white/5 transition focus-within:border-white/25 focus-within:ring-2 focus-within:ring-white/10'
  const numCls = 'flex-1 min-w-0 bg-transparent border-0 outline-none px-3 py-2.5 text-sm text-white [color-scheme:dark] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  if (!open) {
    return (
      <button type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-black transition-colors"
      >
        <HandCoins className="w-4 h-4 text-emerald-300" />
        {picking ? 'Ajouter une créance' : 'Enregistrer une créance (paiement à recevoir)'}
      </button>
    )
  }

  const multi = echeances.length > 1

  return (
    // Carte sombre pleine (#111) — même style que « Modifier tarif ».
    <div className="mt-3 p-4 bg-[#111111] border border-white/10 rounded-2xl space-y-4">
      <div className="flex items-center gap-2">
        <HandCoins className="w-4 h-4 text-white/60 flex-shrink-0" />
        <p className="text-sm font-bold text-white">Créance client</p>
        <button type="button"
          onClick={() => setOpen(false)}
          className="ml-auto p-1.5 rounded-lg text-white/50 hover:bg-white/10 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-white/50 leading-relaxed">
        Le service est rattaché à la date de la réservation. Chaque échéance figure
        en « à recevoir » et entre au chiffre d&apos;affaires une fois encaissée. Ajoutez
        plusieurs échéances pour un paiement échelonné.
      </p>

      {picking && (
        <div>
          <label className={labelCls} htmlFor="creance-reservation">Réservation</label>
          <div className={fieldCls}>
            <select
              id="creance-reservation"
              value={chosenId}
              onChange={ev => chooseReservation(ev.target.value)}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none px-3 py-2.5 text-sm text-white [color-scheme:dark]"
            >
              <option value="">— Choisir une réservation —</option>
              {reservations!.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Le reste dû était calculé puis pré-rempli en silence : quand il
              tombait à 0, rien ne disait si la location était soldée ou si le
              calcul s'était trompé. On montre donc les trois chiffres qui le
              produisent. Demande du 27/07/2026. */}
          {choisie && (
            <div className="mt-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span>Prix de la location</span>
                <span className="font-semibold text-white/70">{formatPrice(choisie.totalPrice)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span>Déjà encaissé</span>
                <span className="font-semibold text-white/70">− {formatPrice(choisie.paid)}</span>
              </div>
              {choisie.alreadyDue > 0 && (
                <div className="flex items-center justify-between text-[11px] text-white/50">
                  <span>Déjà en créance</span>
                  <span className="font-semibold text-white/70">− {formatPrice(choisie.alreadyDue)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                <span className="text-xs font-bold text-white">Reste à payer</span>
                <span className={`text-sm font-black ${choisie.remaining > 0 ? 'text-emerald-300' : 'text-white/50'}`}>
                  {choisie.remaining > 0 ? formatPrice(choisie.remaining) : 'Rien à réclamer'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {echeances.map((e, i) => (
          <div key={e.id} className="grid grid-cols-2 gap-3">
            <div>
              {i === 0
                ? <label className={labelCls} htmlFor={`echeance-amount-${i}`}>Montant dû</label>
                : <label className="sr-only" htmlFor={`echeance-amount-${i}`}>Montant dû — échéance {i + 1}</label>}
              <div className={fieldCls}>
                <input
                  id={`echeance-amount-${i}`}
                  type="number" min="0" step="0.01" inputMode="decimal" placeholder="0"
                  value={e.amount} onChange={ev => updateEcheance(i, { amount: ev.target.value })}
                  className={numCls}
                />
                <span className="pr-3 text-xs font-semibold text-white/45">€</span>
              </div>
            </div>
            <div>
              {/* En-tête de colonne, pas un libellé de champ : chaque ligne a son propre
                  sélecteur de date, nommé juste en dessous. */}
              {i === 0 && <p className={labelCls}>Échéance</p>}
              <div className="flex items-center gap-1.5">
                <div className={`${fieldCls} flex-1`}>
                  <DatePickerField
                    aria-label={`Échéance ${i + 1}`}
                    value={e.dueDate}
                    onChange={v => updateEcheance(i, { dueDate: v })}
                    tone="dark"
                    className={numCls}
                  />
                </div>
                {multi && (
                  <button type="button"
                    onClick={() => removeEcheance(i)}
                    className="p-2 rounded-lg text-white/40 hover:text-red-300 hover:bg-white/10 transition-colors flex-shrink-0"
                    aria-label="Retirer cette échéance"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button type="button"
          onClick={addEcheance}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter une échéance
        </button>
        {multi && (
          <p className="text-[11px] text-white/50">
            Total : <span className="font-bold text-white">{formatPrice(total)}</span>
          </p>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="button"
          onClick={handleSave}
          disabled={loading || !valid || !(total > 0)}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
            saved ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white text-[#111111] hover:bg-white/90'
          }`}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saved
            ? multi ? 'Créances créées ✓' : 'Créance créée ✓'
            : multi ? `Créer ${echeances.length} échéances · ${formatPrice(total)}` : `Créer · ${formatPrice(total)}`}
        </button>
        <button type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-white/20 text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Annuler
        </button>
      </div>
    </div>
  )
}
