'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fr } from 'date-fns/locale'
import {
  format, addMonths, subMonths, startOfMonth, startOfWeek, addDays,
  isSameDay, isSameMonth, isBefore, startOfDay, parse,
} from 'date-fns'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Sélecteur de date 100 % maison, rendu EN FRANÇAIS sur tous les appareils.
 *
 * Pourquoi : le `<input type="date">` natif ouvre, sur iOS/Safari, une roue de
 * mois affichée en ANGLAIS (« July », « August »…) même quand l'iPhone est en
 * français — bug WebKit qu'aucun réglage web ne corrige de façon fiable (constaté
 * en prod le 24/07/2026 sur la fiche résa : champ fermé « 24 juil. 2026 » FR, mais
 * roue ouverte EN). Ici le calendrier est un simple popover rendu par nos soins
 * avec la locale `fr` de date-fns → français garanti, quel que soit l'appareil.
 *
 * L'HEURE reste sur l'`<input type="time">` natif : elle n'affiche que des chiffres,
 * donc aucun problème de langue.
 *
 * Valeur échangée : chaîne « YYYY-MM-DD » (identique à un input date natif).
 * - Mode contrôlé : `value` + `onChange`.
 * - Mode formulaire : `name` (+ `defaultValue`) → un input caché porte la valeur,
 *   lisible côté serveur exactement comme l'ancien `<input type="date" name>`.
 */
interface Props {
  value?: string
  onChange?: (value: string) => void
  name?: string
  defaultValue?: string
  /** Borne basse « YYYY-MM-DD » : les jours antérieurs sont désactivés. */
  min?: string
  required?: boolean
  disabled?: boolean
  /** Palette claire (défaut) ou sombre (déclencheur sur panneau foncé). */
  tone?: 'light' | 'dark'
  /** Classes du bouton déclencheur (bordure, padding, focus…). */
  className?: string
  placeholder?: string
  id?: string
  'aria-label'?: string
}

const WEEKDAYS = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di']

function parseYmd(s?: string): Date | null {
  if (!s) return null
  const d = parse(s.slice(0, 10), 'yyyy-MM-dd', new Date())
  return isNaN(d.getTime()) ? null : d
}

export default function DatePickerField({
  value,
  onChange,
  name,
  defaultValue,
  min,
  required,
  disabled,
  tone = 'light',
  className = '',
  placeholder = 'jj/mm/aaaa',
  id,
  'aria-label': ariaLabel,
}: Props) {
  const controlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue ?? '')
  const current = controlled ? (value ?? '') : internal
  const selectedDate = parseYmd(current)
  const minDate = parseYmd(min)
  const dark = tone === 'dark'

  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(selectedDate ?? new Date()))

  function handleOpenChange(o: boolean) {
    // À l'ouverture, recale le calendrier sur le mois de la date sélectionnée
    // (ou le mois courant) pour ne pas rouvrir sur un mois éloigné.
    if (o) setViewMonth(startOfMonth(parseYmd(current) ?? new Date()))
    setOpen(o)
  }

  function pick(day: Date) {
    const v = format(day, 'yyyy-MM-dd')
    if (!controlled) setInternal(v)
    onChange?.(v)
    setOpen(false)
  }

  // Grille fixe de 6 semaines (42 cases) démarrant un lundi : hauteur stable,
  // pas de saut de mise en page quand on change de mois.
  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 })
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const today = startOfDay(new Date())

  const monthLabel = format(viewMonth, 'MMMM yyyy', { locale: fr })

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel ?? 'Choisir une date'}
          disabled={disabled}
          className={cn('text-left', className)}
        >
          {selectedDate
            ? format(selectedDate, 'd MMM yyyy', { locale: fr })
            : <span className={dark ? 'text-white/40' : 'text-gray-400'}>{placeholder}</span>}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-auto p-3 bg-white text-gray-900 border border-gray-200 rounded-xl shadow-lg"
      >
        <div className="w-[252px]">
          {/* En-tête : navigation entre les mois */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-semibold text-gray-900 capitalize">{monthLabel}</div>
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* En-têtes des jours (lundi en premier) */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="text-center text-[11px] font-medium text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day, i) => {
              const inMonth = isSameMonth(day, viewMonth)
              const isSel = selectedDate != null && isSameDay(day, selectedDate)
              const isToday = isSameDay(day, today)
              const isDisabled = minDate != null && isBefore(startOfDay(day), startOfDay(minDate))
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => pick(day)}
                  className={cn(
                    'h-9 w-9 mx-auto flex items-center justify-center rounded-md text-sm transition-colors',
                    isSel
                      ? 'bg-[#111111] text-white font-semibold hover:bg-[#111111]'
                      : isToday
                        ? 'bg-gray-100 text-gray-900 font-semibold hover:bg-gray-200'
                        : inMonth
                          ? 'text-gray-800 hover:bg-gray-100'
                          : 'text-gray-300 hover:bg-gray-50',
                    isDisabled && 'opacity-30 cursor-not-allowed hover:bg-transparent',
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>

      {name ? <input type="hidden" name={name} value={current} required={required} /> : null}
    </Popover>
  )
}
