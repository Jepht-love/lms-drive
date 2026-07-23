'use client'

import { useState } from 'react'

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
  /** Classes des deux inputs visibles (bordure, padding, focus…) — sans largeur. */
  className?: string
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

  const inputCls = `w-full min-w-0 ${className}`
  const combined = date && time ? `${date}T${time}` : ''

  return (
    <div className="flex gap-2">
      <div className="flex-1 min-w-0">
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); emit(e.target.value, time) }}
          required={required}
          disabled={disabled}
          min={min ? min.slice(0, 10) : undefined}
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
      {name && <input type="hidden" name={name} value={combined} />}
    </div>
  )
}
