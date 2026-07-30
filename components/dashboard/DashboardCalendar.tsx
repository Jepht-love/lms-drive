'use client'

/**
 * Calendrier du tableau de bord — façon « semaine » iOS.
 * Vrai carrousel : trois panneaux (semaine précédente / courante / suivante)
 * glissent sous le doigt ; au relâcher, on s'aligne (spring) sur la semaine la
 * plus proche. Flèches ‹ › aussi. Un clic sur un jour affiche, en dessous, les
 * tâches de ce jour (à faire / à assigner). Chaque tâche ouvre le tiroir de
 * l'événement (/calendrier?event=<id>) : attribuer un membre PUIS ouvrir la résa.
 *
 * Auto-alimenté : charge une fenêtre de 3 semaines via
 * GET /api/calendar/events?start&end (même source que la page Calendrier).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useMotionValue, animate } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays, addWeeks, startOfWeek, isSameDay, isToday, format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CalendarEvent, EventType } from '@/types/calendar'
import LoadErrorBanner from '@/components/ui/LoadErrorBanner'

const ASSIGNABLE: EventType[] = [
  'depart_vehicule', 'retour_vehicule', 'tache',
  'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation',
]

const TYPE_META: Record<string, { label: string; badge: string }> = {
  depart_vehicule: { label: 'Départ',       badge: 'bg-gray-900 text-white' },
  retour_vehicule: { label: 'Retour',       badge: 'bg-blue-500 text-white' },
  reservation:     { label: 'Réservation',  badge: 'bg-gray-900 text-white' },
  rdv_client:      { label: 'RDV',          badge: 'bg-pink-500 text-white' },
  rdv_garage:      { label: 'RDV garage',   badge: 'bg-pink-500 text-white' },
  rdv_autre:       { label: 'RDV',          badge: 'bg-pink-500 text-white' },
  livraison:       { label: 'Livraison',    badge: 'bg-purple-500 text-white' },
  recuperation:    { label: 'Récupération', badge: 'bg-purple-500 text-white' },
  tache:           { label: 'Tâche',        badge: 'bg-purple-500 text-white' },
}
const DEFAULT_META = { label: 'Tâche', badge: 'bg-gray-500 text-white' }
const metaFor = (t: string) => TYPE_META[t] ?? DEFAULT_META

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

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
// Le véhicule et sa couleur d'abord, la plaque ensuite (remarque 20 de Jeff,
// 30/07/2026). La couleur est un champ libre de la fiche : elle manque souvent,
// la ligne doit tenir sans elle.
function eventSubtitle(e: CalendarEvent): string | null {
  const v = e.vehicles?.[0]
  if (!v) return null
  return `${[v.brand, v.model, v.color].filter(Boolean).join(' ')} · ${v.plate}`
}

export default function DashboardCalendar() {
  const baseMonday = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])
  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState<Date>(() => new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  // Incrémenté par « Réessayer » : relance le chargement de la semaine affichée.
  const [reloadKey, setReloadKey] = useState(0)

  // Carrousel : largeur mesurée du conteneur + position (px) de la piste 3×.
  const containerRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const x = useMotionValue(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setW(el.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Position de repos : panneau du milieu centré → x = -w.
  useEffect(() => { x.set(-w) }, [w, x])

  const weekStart = useMemo(() => addWeeks(baseMonday, weekOffset), [baseMonday, weekOffset])

  // Aligne la piste sur la semaine voisine (spring), puis bascule les données
  // du milieu sans saut visuel (le panneau cible == nouveau panneau central).
  const commit = useCallback((dir: number) => {
    if (!w) return
    const target = dir > 0 ? -2 * w : 0
    animate(x, target, {
      type: 'spring', stiffness: 550, damping: 45,
      onComplete: () => {
        setWeekOffset(o => o + dir)
        setSelected(s => addDays(s, dir * 7))
        x.set(-w)
      },
    })
  }, [w, x])

  const goToday = useCallback(() => {
    setWeekOffset(0)
    setSelected(new Date())
    x.set(-w)
  }, [w, x])

  // Fenêtre chargée : 3 semaines (panneau précédent → suivant), pour que les
  // pastilles des semaines voisines soient déjà là pendant le glissement.
  useEffect(() => {
    const start = addDays(weekStart, -7)
    const end = addDays(weekStart, 14)
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)
    fetch(`/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then(r => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then(data => { if (!cancelled) setEvents(Array.isArray(data) ? data : []) })
      // Une semaine vide et une semaine non chargée se ressemblent : on le dit,
      // sinon le tableau de bord laisse croire qu'il n'y a rien de prévu.
      .catch(() => { if (!cancelled) setLoadFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [weekStart, reloadKey])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = dayKey(new Date(e.start_at))
      const arr = map.get(key)
      if (arr) arr.push(e); else map.set(key, [e])
    }
    return map
  }, [events])

  const dayEvents = useCallback(
    (d: Date) => (eventsByDay.get(dayKey(d)) ?? [])
      .slice()
      .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [eventsByDay],
  )

  const selectedEvents = dayEvents(selected)
  const monthLabel = format(weekStart, 'MMMM yyyy', { locale: fr })
  const isThisWeek = weekOffset === 0

  const renderDay = (day: Date) => {
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
            : 'text-gray-900'
          }`}
        >
          {format(day, 'd')}
        </span>
        <span className="h-1.5 flex items-center">
          {evs.length > 0 && (
            <span className={`w-1.5 h-1.5 rounded-full ${hasUnassigned ? 'bg-amber-500' : selectedDay ? 'bg-gray-900' : 'bg-gray-300'}`} />
          )}
        </span>
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      {loadFailed && (
        <LoadErrorBanner
          className="mb-3"
          message="Semaine non chargée — les pastilles peuvent manquer."
          onRetry={() => setReloadKey(k => k + 1)}
        />
      )}
      {/* En-tête : mois + navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => commit(-1)}
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
          onClick={() => commit(1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Carrousel : 3 panneaux (préc./courant/suivant) glissent sous le doigt */}
      <div ref={containerRef} className="overflow-hidden">
        <motion.div
          className="flex"
          style={{ x, width: w * 3 }}
          drag={w > 0 ? 'x' : false}
          dragConstraints={{ left: -2 * w, right: 0 }}
          dragElastic={0.08}
          onDragEnd={(_, info) => {
            const cur = x.get()
            const thresh = w * 0.28
            if (cur <= -w - thresh || info.velocity.x < -450) commit(1)
            else if (cur >= -w + thresh || info.velocity.x > 450) commit(-1)
            else animate(x, -w, { type: 'spring', stiffness: 550, damping: 45 })
          }}
        >
          {[-1, 0, 1].map(panelOffset => {
            const start = addWeeks(baseMonday, weekOffset + panelOffset)
            const wdays = Array.from({ length: 7 }, (_, i) => addDays(start, i))
            return (
              <div key={panelOffset} style={{ width: w }} className="shrink-0">
                <div className="grid grid-cols-7 gap-1">
                  {wdays.map(renderDay)}
                </div>
              </div>
            )
          })}
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
