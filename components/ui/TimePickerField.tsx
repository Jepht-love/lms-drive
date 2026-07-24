'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Sélecteur d'heure 100 % maison, assorti à DatePickerField (même popover clair).
 *
 * Remplace l'`<input type="time">` natif : sur iOS il ouvre une roue système qui
 * détonne à côté de notre calendrier français (un demi-champ natif, un demi-champ
 * maison). Ici deux colonnes défilantes (heures 00-23 · minutes 00-59) dans un
 * popover cohérent avec le reste. Format 24 h, aucune ambiguïté AM/PM.
 *
 * Valeur échangée : chaîne « HH:mm » (identique à un input time natif).
 * - Mode contrôlé : `value` + `onChange`.
 * - Mode formulaire : `name` (+ `defaultValue`) → input caché lisible côté serveur.
 */
interface Props {
  value?: string
  onChange?: (value: string) => void
  name?: string
  defaultValue?: string
  required?: boolean
  disabled?: boolean
  tone?: 'light' | 'dark'
  className?: string
  placeholder?: string
  id?: string
  'aria-label'?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function parseHm(s?: string): { h: number | null; m: number | null } {
  if (!s) return { h: null, m: null }
  const [hh, mm] = s.slice(0, 5).split(':')
  const h = Number(hh)
  const m = Number(mm)
  return {
    h: Number.isInteger(h) && h >= 0 && h <= 23 ? h : null,
    m: Number.isInteger(m) && m >= 0 && m <= 59 ? m : null,
  }
}

export default function TimePickerField({
  value,
  onChange,
  name,
  defaultValue,
  required,
  disabled,
  tone = 'light',
  className = '',
  placeholder = '--:--',
  id,
  'aria-label': ariaLabel,
}: Props) {
  const controlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue ?? '')
  const current = controlled ? (value ?? '') : internal
  const { h, m } = parseHm(current)
  const dark = tone === 'dark'

  const [open, setOpen] = useState(false)
  const hourRef = useRef<HTMLButtonElement | null>(null)
  const minRef = useRef<HTMLButtonElement | null>(null)

  // À l'ouverture, centre l'heure et la minute sélectionnées dans leur colonne.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      hourRef.current?.scrollIntoView({ block: 'center' })
      minRef.current?.scrollIntoView({ block: 'center' })
    }, 0)
    return () => clearTimeout(t)
  }, [open])

  function emit(nextH: number, nextM: number) {
    const v = `${pad(nextH)}:${pad(nextM)}`
    if (!controlled) setInternal(v)
    onChange?.(v)
  }

  const colCls = 'flex flex-col gap-0.5 max-h-[220px] overflow-y-auto py-1 px-1 [scrollbar-width:thin]'
  const cellCls = (on: boolean) =>
    cn(
      'w-11 py-1.5 rounded-md text-sm text-center transition-colors',
      on ? 'bg-[#111111] text-white font-semibold' : 'text-gray-700 hover:bg-gray-100',
    )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel ?? 'Choisir une heure'}
          disabled={disabled}
          className={className}
        >
          {h != null && m != null
            ? `${pad(h)}:${pad(m)}`
            : <span className={dark ? 'text-white/40' : 'text-gray-400'}>{placeholder}</span>}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        className="w-auto p-2 bg-white text-gray-900 border border-gray-200 rounded-xl shadow-lg"
      >
        <div className="flex items-stretch gap-1">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              <Clock className="w-3 h-3" /> Heures
            </div>
            <div className={colCls}>
              {HOURS.map((hour) => {
                const on = h === hour
                return (
                  <button
                    key={hour}
                    ref={on ? hourRef : undefined}
                    type="button"
                    onClick={() => emit(hour, m ?? 0)}
                    className={cellCls(on)}
                  >
                    {pad(hour)}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="w-px bg-gray-200 my-6" aria-hidden />

          <div className="flex flex-col items-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 mt-0.5">Minutes</div>
            <div className={colCls}>
              {MINUTES.map((min) => {
                const on = m === min
                return (
                  <button
                    key={min}
                    ref={on ? minRef : undefined}
                    type="button"
                    onClick={() => emit(h ?? 0, min)}
                    className={cellCls(on)}
                  >
                    {pad(min)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </PopoverContent>

      {name ? <input type="hidden" name={name} value={current} required={required} /> : null}
    </Popover>
  )
}
