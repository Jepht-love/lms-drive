'use client'

import { useState } from 'react'
import DatePickerField from '@/components/ui/DatePickerField'

/**
 * Champ date + heure SÉPARÉS — remplace partout input[type=datetime-local].
 *
 * Pourquoi : sur Safari, un datetime-local a une largeur incompressible qui
 * déborde de son conteneur (constaté en prod le 23/07/2026 sur la fiche résa).
 * Deux contrôles compacts (date | heure) tiennent partout, sur tous les moteurs.
 *
 * Deux modes :
 * - contrôlé : `value` + `onChange` (valeur combinée « YYYY-MM-DDTHH:mm ») ;
 * - formulaire : `name` (+ `defaultValue`) — un input caché porte la valeur
 *   combinée, lisible côté serveur exactement comme l'ancien datetime-local.
 *
 * `grouped` (opt-in) : date + heure dans UN seul champ bordé avec un séparateur
 * fin — aspect shadcn cohérent (les deux ne ressemblent plus à deux boîtes qui
 * s'entrechoquent). Le rendu par défaut (deux boîtes) est inchangé.
 */
interface Props {
  value?: string
  onChange?: (combined: string) => void
  name?: string
  defaultValue?: string
  required?: boolean
  disabled?: boolean
  /** Borne basse « YYYY-MM-DDTHH:mm » — seule la partie date est appliquée. */
  min?: string
  /** Classes des deux inputs visibles (bordure, padding, focus…) — sans largeur. Ignoré en mode `grouped`. */
  className?: string
  /** Regroupe date + heure dans un seul champ bordé (séparateur fin) — style shadcn. */
  grouped?: boolean
  /** En mode `grouped` : palette claire (défaut) ou sombre (panneaux sur fond foncé). */
  tone?: 'light' | 'dark'
}

export default function DateTimeField({
  value,
  onChange,
  name,
  defaultValue,
  required,
  disabled,
  min,
  className = '',
  grouped = false,
  tone = 'light',
}: Props) {
  const controlled = value !== undefined
  const init = (controlled ? value : defaultValue) ?? ''
  // État interne TOUJOURS présent : une saisie partielle (date sans heure)
  // ne doit pas être perdue quand le parent contrôlé reçoit encore ''.
  const [date, setDate] = useState(init.slice(0, 10))
  const [time, setTime] = useState(init.slice(11, 16))

  // Resynchronisation si la valeur contrôlée change de l'extérieur
  // (reset de formulaire, préremplissage async…).
  const [lastValue, setLastValue] = useState(value)
  if (controlled && value !== lastValue) {
    setLastValue(value)
    const combined = date && time ? `${date}T${time}` : ''
    if ((value ?? '') !== combined) {
      setDate((value ?? '').slice(0, 10))
      setTime((value ?? '').slice(11, 16))
    }
  }

  function emit(d: string, t: string) {
    onChange?.(d && t ? `${d}T${t}` : '')
  }

  const combined = date && time ? `${date}T${time}` : ''
  const hidden = name ? <input type="hidden" name={name} value={combined} /> : null
  const minDate = min ? min.slice(0, 10) : undefined

  // ── Mode groupé : un seul champ pro (date | séparateur | heure) ──────────────
  if (grouped) {
    const dark = tone === 'dark'
    // color-scheme:dark → les widgets natifs date/heure de WebKit s'affichent en clair.
    const inner = dark
      ? 'bg-transparent border-0 outline-none px-3 py-2.5 text-sm text-white [color-scheme:dark] disabled:text-white/40'
      : 'bg-transparent border-0 outline-none px-3 py-2.5 text-sm text-gray-900 disabled:text-gray-400'
    const container = dark
      ? 'flex items-stretch rounded-xl border border-white/15 bg-white/5 overflow-hidden transition focus-within:border-white/25 focus-within:ring-2 focus-within:ring-white/10'
      : 'flex items-stretch rounded-xl border border-gray-200 bg-white overflow-hidden transition focus-within:border-gray-300 focus-within:ring-2 focus-within:ring-black/15'
    const sep = dark ? 'w-px bg-white/15 my-1.5 flex-none' : 'w-px bg-gray-200 my-1.5 flex-none'
    return (
      <div className={`${container} ${disabled ? 'opacity-60' : ''}`}>
        <DatePickerField
          value={date}
          onChange={d => { setDate(d); emit(d, time) }}
          required={required}
          disabled={disabled}
          min={minDate}
          tone={dark ? 'dark' : 'light'}
          className={`flex-1 min-w-0 ${inner}`}
        />
        <div className={sep} aria-hidden />
        <input
          type="time"
          value={time}
          onChange={e => { setTime(e.target.value); emit(date, e.target.value) }}
          required={required}
          disabled={disabled}
          className={`w-[100px] flex-none text-center ${inner}`}
        />
        {hidden}
      </div>
    )
  }

  // ── Mode par défaut : deux boîtes séparées (inchangé) ────────────────────────
  const inputCls = `w-full min-w-0 ${className}`
  return (
    <div className="flex gap-2">
      <div className="flex-1 min-w-0">
        <DatePickerField
          value={date}
          onChange={d => { setDate(d); emit(d, time) }}
          required={required}
          disabled={disabled}
          min={minDate}
          className={inputCls}
        />
      </div>
      <div className="w-[104px] flex-none">
        <input
          type="time"
          value={time}
          onChange={e => { setTime(e.target.value); emit(date, e.target.value) }}
          required={required}
          disabled={disabled}
          className={inputCls}
        />
      </div>
      {hidden}
    </div>
  )
}
