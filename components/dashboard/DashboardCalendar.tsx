'use client'

/**
 * Calendrier du tableau de bord — façon « semaine » iOS.
 * On fait défiler les semaines au doigt (drag horizontal) ou avec les flèches ;
 * un clic sur un jour affiche, en dessous, les tâches de ce jour (à faire /
 * à assigner). Chaque tâche ouvre le tiroir de l'événement sur le calendrier
 * (/calendrier?event=<id>) où l'on peut l'attribuer PUIS ouvrir la réservation.
 *
 * Auto-alimenté : charge les événements de la semaine visible via
 * GET /api/calendar/events?start&end (même source que la page Calendrier),
 * donc on peut remonter/descendre sur n'importe quelle semaine.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays, addWeeks, startOfWeek, isSameDay, isToday, format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CalendarEvent, EventType } from '@/types/calendar'

// Types d'événements réellement « à faire / à assigner » (surface le travail).
const ASSIGNABLE: EventType[] = [
  'depart_vehicule', 'retour_vehicule', 'tache',
  'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation',
]

// Libellé + pastille par type (charte dashboard existante).
const TYPE_META: Record<string, { label: string; dot: string; badge: string }> = {
  depart_vehicule: { label: 'Départ',       dot: 'bg-gray-900',   badge: 'bg-gray-900 text-white' },
  retour_vehicule: { label: 'Retour',       dot: 'bg-blue-500',   badge: 'bg-blue-500 text-white' },
  reservation:     { label: 'Réservation',  dot: 'bg-gray-900',   badge: 'bg-gray-900 text-white' },
  rdv_client:      { label: 'RDV',          dot: 'bg-pink-500',   badge: 'bg-pink-500 text-white' },
  rdv_garage:      { label: 'RDV garage',   dot: 'bg-pink-500',   badge: 'bg-pink-500 text-white' },
  rdv_autre:       { label: 'RDV',          dot: 'bg-pink-500',   badge: 'bg-pink-500 text-white' },
  livraison:       { label: 'Livraison',    dot: 'bg-purple-500', badge: 'bg-purple-500 text-white' },
  recuperation:    { label: 'Récupération', dot: 'bg-purple-500', badge: 'bg-purple-500 text-white' },
  tache:           { label: 'Tâche',        dot: 'bg-purple-500', badge: 'bg-purple-500 text-white' },
}
const DEFAULT_META = { label: 'Tâche', dot: 'bg-gray-400', badge: 'bg-gray-500 text-white' }
const metaFor = (t: string) => TYPE_META[t] ?? DEFAULT_META

function assigneeName(e: CalendarEvent): string | null {
  return e.assigned_profile?.full_name ?? e.team?.name ?? null
}
function needsAssignee(e: CalendarEvent): boolean {
  return ASSIGNABLE.includes(e.event_type) && !e.assigned_to && !e.assigned_team_id
}
function eventTitle(e: CalendarEvent): string {
  if (e.client) return `${e.client.first_name} ${e.client.last_name}`.trim()
  return e.title
}
function eventSubtitle(e: CalendarEvent): string | null {
  const v = e.vehicles?.[0]
  if (v) return `${v.brand} ${v.model} · ${v.plate}`
  return null
}

export default function DashboardCalendar() {
  // Ancrage : lundi de la semaine courante. weekOffset = décalage en semaines.
  const baseMonday = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])
  const [weekOffset, setWeekOffset] = useState(0)
  const [slideDir, setSlideDir] = useState(0)
  const [selected, setSelected] = useState<Date>(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = useMemo(() => addWeeks(baseMonday, weekOffset), [baseMonday, weekOffset])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // La sélection reste toujours dans la semaine visible → le détail est cohérent
  // et les données de la sélection sont toujours chargées.
  const paginate = useCallback((dir: number) => {
    setSlideDir(dir)
    setWeekOffset(o => o + dir)
    setSelected(s => addDays(s, dir * 7))
  }, [])

  const goToday = useCallback(() => {
    setSlideDir(weekOffset > 0 ? -1 : 1)
    setWeekOffset(0)
    setSelected(new Date())
  }, [weekOffset])

  // Charge les événements de la semaine visible.
  useEffect(() => {
    const start = weekStart
    const end = addDays(weekStart, 7)
    let cancelled = false
    setLoading(true)
    fetch(`/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setEvents(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setEvents([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [weekStart])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = format(new Date(e.start_at), 'yyyy-MM-dd')
      ;(map.get(key) ?? map.set(key, []).get(key)!).push(e)
    }
    return map
  }, [events])

  const dayEvents = useCallback(
    (d: Date) => (eventsByDay.get(format(d, 'yyyy-MM-dd')) ?? [])
      .slice()
      .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [eventsByDay],
  )

  const selectedEvents = dayEvents(selected)
  const monthLabel = format(weekStart, 'MMMM yyyy', { locale: fr })
  const isThisWeek = weekOffset === 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {/* En-tête : mois + navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => paginate(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-gray-900 capitalize">{monthLabel}</span>
          {!isThisWeek && (
            <button
              type="button"
              onClick={goToday}
              className="text-[10px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors"
            >
              Aujourd&apos;hui
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => paginate(1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Bande de jours — glisser à gauche/droite pour changer de semaine */}
      <div className="overflow-hidden touch-pan-y">
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) paginate(1)
            else if (info.offset.x > 50) paginate(-1)
          }}
        >
          <motion.div
            key={weekOffset}
            initial={{ x: slideDir * 36, opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-7 gap-1"
          >
            {days.map(day => {
              const evs = dayEvents(day)
              const hasUnassigned = evs.some(needsAssignee)
              const selectedDay = isSameDay(day, selected)
              const today = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelected(day)}
                  className="flex flex-col items-center gap-1 py-1 select-none"
                >
                  <span className={`text-[9px] font-bold uppercase capitalize ${selectedDay ? 'text-gray-900' : 'text-gray-400'}`}>
                    {format(day, 'EEE', { locale: fr })}
                  </span>
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                      selectedDay ? 'bg-black text-white'
                      : today ? 'bg-gray-100 text-gray-900 ring-1 ring-gray-900/20'
                      : 'text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {/* Pastille de charge : ambre si au moins une tâche à assigner */}
                  <span className="h-1.5 flex items-center">
                    {evs.length > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${hasUnassigned ? 'bg-amber-500' : selectedDay ? 'bg-gray-900' : 'bg-gray-300'}`} />
                    )}
                  </span>
                </button>
              )
            })}
          </motion.div>
        </motion.div>
      </div>

      {/* Détail du jour sélectionné */}
      <div className="mt-4 pt-3 border-t border-gray-50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">
            {isSameDay(selected, new Date()) ? "Aujourd'hui" : format(selected, 'EEEE d MMMM', { locale: fr })}
          </p>
          {selectedEvents.length > 0 && (
            <span className="text-[10px] font-bold text-gray-400">
              {selectedEvents.length} tâche{selectedEvents.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 py-1">
            {[0, 1].map(i => <div key={i} className="h-9 rounded-lg bg-gray-50 animate-pulse" />)}
          </div>
        ) : selectedEvents.length === 0 ? (
          <p className="text-xs text-gray-300 py-3 text-center">Rien de prévu ce jour</p>
        ) : (
          <div className="space-y-1">
            {selectedEvents.map(e => {
              const meta = metaFor(e.event_type)
              const name = assigneeName(e)
              const toAssign = !name && needsAssignee(e)
              const subtitle = eventSubtitle(e)
              return (
                <Link
                  key={e.id}
                  href={`/calendrier?event=${e.id}`}
                  className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="w-10 text-[11px] font-mono font-bold text-gray-500 flex-shrink-0 text-center">
                    {format(new Date(e.start_at), 'HH:mm')}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 inline-flex items-center justify-center min-w-[76px] ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-gray-900 font-semibold block truncate">{eventTitle(e)}</span>
                    {subtitle && <span className="text-[10px] text-gray-400 block truncate">{subtitle}</span>}
                  </div>
                  {name ? (
                    <span className="text-[10px] text-gray-400 flex-shrink-0 max-w-[64px] truncate">{name}</span>
                  ) : toAssign ? (
                    <span className="text-[10px] font-bold text-amber-600 flex-shrink-0">À assigner</span>
                  ) : null}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
