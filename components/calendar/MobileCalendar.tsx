'use client'

import { useEffect, useRef } from 'react'
import { addDays, addMonths, subMonths, format, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bell, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, Users } from 'lucide-react'
import type { CalendarEvent, CalendarResource, CalendarView } from '@/types/calendar'
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  HOUR_HEIGHT_PX,
  UNASSIGNED_RESOURCE_ID,
  couleurEvenement,
} from '@/lib/calendar/constants'
import MonthView from './MonthView'
import DayEventsPanel from './DayEventsPanel'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const TOTAL_HOURS = CALENDAR_END_HOUR - CALENDAR_START_HOUR
const TOTAL_H = TOTAL_HOURS * HOUR_HEIGHT_PX

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dayBounds(day: Date) {
  const start = new Date(day)
  start.setHours(CALENDAR_START_HOUR, 0, 0, 0)
  const end = new Date(start.getTime() + TOTAL_HOURS * 3_600_000)
  return { start, end }
}

function toMin(iso: string, dayStart: Date): number {
  const ms = new Date(iso).getTime() - dayStart.getTime()
  return Math.max(0, Math.min(TOTAL_HOURS * 60, ms / 60_000))
}

function eventColor(ev: CalendarEvent, resources: CalendarResource[]): string {
  if (ev.color_override) return ev.color_override
  if (ev.assigned_to) return resources.find(r => r.id === ev.assigned_to)?.color ?? ''
  if (ev.assigned_team_id) return resources.find(r => r.id === ev.assigned_team_id)?.color ?? ''
  return couleurEvenement(ev)
}

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

function getVisibleIds(resources: CalendarResource[]) {
  return new Set(resources.filter(r => r.visible).map(r => r.id))
}

function isVisible(ev: CalendarEvent, visibleIds: Set<string>) {
  if (ev.assigned_to) return visibleIds.has(ev.assigned_to)
  if (ev.assigned_team_id) return visibleIds.has(ev.assigned_team_id)
  return visibleIds.has(UNASSIGNED_RESOURCE_ID)
}

interface Positioned {
  ev: CalendarEvent
  top: number
  height: number
  left: string
  width: string
  color: string
}

function layoutEvents(evs: CalendarEvent[], dayStart: Date, resources: CalendarResource[]): Positioned[] {
  const sorted = [...evs].sort((a, b) =>
    new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )

  const laneEnds: number[] = []
  const laneOf = new Map<string, number>()

  for (const ev of sorted) {
    const s = new Date(ev.start_at).getTime()
    const e = new Date(ev.end_at).getTime()
    let lane = laneEnds.findIndex(end => end <= s)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = e
    laneOf.set(ev.id, lane)
  }

  const totalOf = new Map<string, number>()
  for (const ev of sorted) {
    const s = new Date(ev.start_at).getTime()
    const e = new Date(ev.end_at).getTime()
    let max = laneOf.get(ev.id)!
    for (const other of sorted) {
      if (other.id === ev.id) continue
      if (new Date(other.start_at).getTime() < e && s < new Date(other.end_at).getTime()) {
        max = Math.max(max, laneOf.get(other.id)!)
      }
    }
    totalOf.set(ev.id, max + 1)
  }

  return sorted.map(ev => {
    const lane = laneOf.get(ev.id)!
    const total = totalOf.get(ev.id)!
    const startMin = toMin(ev.start_at, dayStart)
    const endMin = toMin(ev.end_at, dayStart)
    return {
      ev,
      top: (startMin / 60) * HOUR_HEIGHT_PX,
      height: Math.max(HOUR_HEIGHT_PX * 0.5, ((endMin - startMin) / 60) * HOUR_HEIGHT_PX),
      left: `${(lane / total) * 100}%`,
      width: `calc(${(1 / total) * 100}% - 4px)`,
      color: eventColor(ev, resources),
    }
  })
}

// ─── NowLine ─────────────────────────────────────────────────────────────────

function NowLine({ day }: { day: Date }) {
  const { start } = dayBounds(day)
  const now = new Date()
  if (!sameDay(now, day)) return null
  const top = (toMin(now.toISOString(), start) / 60) * HOUR_HEIGHT_PX
  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top }}
    >
      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
      <div className="flex-1 h-[1.5px] bg-red-500" />
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface MobileCalendarProps {
  currentDate: Date
  view: CalendarView
  events: CalendarEvent[]
  resources: CalendarResource[]
  alertCount: number
  onSelectDate: (d: Date) => void
  onViewChange: (v: CalendarView) => void
  onToggleResource: (id: string) => void
  onSelectAll: () => void
  onShowAlerts: () => void
  onCreateNew: () => void
  onOpenPanel: () => void
  onEventClick: (ev: CalendarEvent) => void
  onSlotClick: (resource: CalendarResource, date: Date, hour: number) => void
}

export default function MobileCalendar({
  currentDate, view, events, resources, alertCount,
  onSelectDate, onViewChange, onToggleResource, onSelectAll, onShowAlerts,
  onCreateNew, onOpenPanel, onEventClick, onSlotClick,
}: MobileCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = new Date()

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { start: dayStart, end: dayEnd } = dayBounds(currentDate)
  const visibleIds = getVisibleIds(resources)
  const allVisible = resources.every(r => r.visible)
  const namedResources = resources.filter(r => r.id !== UNASSIGNED_RESOURCE_ID)

  // La personne dont on regarde le planning, quand il n'y en a qu'une d'affichée.
  // Sert au repère coloré de l'en-tête. Dès que plusieurs personnes sont visibles,
  // c'est un comparatif et le repère n'aurait plus de sens.
  const visiblesNommees = namedResources.filter(r => r.visible)
  const personneAffichee = visiblesNommees.length === 1 ? visiblesNommees[0] : null
  const defaultResource = resources.find(r => r.visible) ?? resources[0]

  const dayEvs = events.filter(ev => {
    if (ev.status === 'termine' || ev.all_day) return false
    if (!isVisible(ev, visibleIds)) return false
    return new Date(ev.start_at) < dayEnd && new Date(ev.end_at) > dayStart
  })

  const allDayEvs = events.filter(ev => {
    if (ev.status === 'termine' || !ev.all_day) return false
    if (!isVisible(ev, visibleIds)) return false
    const dS = new Date(currentDate); dS.setHours(0, 0, 0, 0)
    const dE = new Date(currentDate); dE.setHours(23, 59, 59, 999)
    return new Date(ev.start_at) <= dE && new Date(ev.end_at) >= dS
  })

  const positioned = layoutEvents(dayEvs, dayStart, resources)

  const handleHeaderNav = (dir: -1 | 1) => {
    if (view === 'month') {
      onSelectDate(dir === -1 ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    } else {
      onSelectDate(addDays(currentDate, dir))
    }
  }

  // Scroll to current time on day change
  useEffect(() => {
    if (!scrollRef.current || view !== 'day') return
    const now = new Date()
    const { start } = dayBounds(currentDate)
    const min = sameDay(now, currentDate) ? toMin(now.toISOString(), start) : 60
    scrollRef.current.scrollTop = Math.max(0, (min / 60) * HOUR_HEIGHT_PX - 100)
  }, [currentDate, view]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-3 py-0.5 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Période précédente"
            onClick={() => handleHeaderNav(-1)}
            className="w-6 h-6 flex items-center justify-center text-gray-400"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-[14px] font-semibold text-[#111111] capitalize min-w-[120px] text-center">
            {view === 'month'
              ? format(currentDate, 'MMMM yyyy', { locale: fr })
              : format(currentDate, 'EEE d MMMM', { locale: fr })}
          </span>
          <button
            type="button"
            aria-label="Période suivante"
            onClick={() => handleHeaderNav(1)}
            className="w-6 h-6 flex items-center justify-center text-gray-400"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* De qui on regarde le planning. Reste en haut à droite tant qu'une seule
              personne est affichée (demande de Jeff du 01/08/2026) : sans ce repère,
              on oublie qu'un filtre est actif et on croit que l'agenda est vide.
              « Non attribué » ne compte pas, elle accompagne toujours la sélection. */}
          {personneAffichee && (
            <span
              className="flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-full text-[11px] font-bold text-white max-w-[130px]"
              style={{ backgroundColor: personneAffichee.color }}
              title={personneAffichee.full_name}
            >
              <span className="w-[18px] h-[18px] rounded-full bg-white/30 text-[8px] flex items-center justify-center flex-shrink-0">
                {initials(personneAffichee.full_name)}
              </span>
              <span className="truncate">{personneAffichee.full_name.split(' ')[0]}</span>
            </span>
          )}
          {!sameDay(today, currentDate) && view !== 'month' && (
            <button
              type="button"
              onClick={() => onSelectDate(today)}
              className="text-[11px] font-semibold text-[#111111] border border-gray-200 rounded-lg px-2 h-7"
            >
              Auj.
            </button>
          )}
          <button
            type="button"
            onClick={onShowAlerts}
            className="relative w-6 h-6 flex items-center justify-center"
          >
            <Bell size={18} className="text-gray-600" />
            {alertCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center px-0.5">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>
          <button
            type="button"
            aria-label="Nouvel événement"
            onClick={onCreateNew}
            className="w-7 h-7 bg-[#111111] rounded-full flex items-center justify-center"
          >
            <Plus size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── View tabs + accès panneau (dates · calendriers · disponibilités) ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-0.5 border-b border-gray-100">
        <div className="flex gap-1">
          {([['day', 'Jour'], ['month', 'Mois']] as [CalendarView, string][]).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={[
                'px-3 h-6 rounded-lg text-[11px] font-semibold transition-colors',
                view === v ? 'bg-[#111111] text-white' : 'bg-gray-100 text-gray-500',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenPanel}
          className="flex items-center gap-1.5 px-2.5 h-6 rounded-lg text-[12px] font-semibold text-gray-600 bg-gray-100"
        >
          <SlidersHorizontal size={13} /> Calendriers
        </button>
      </div>

      {view === 'month' ? (
        <MonthView
          currentDate={currentDate}
          events={events}
          resources={resources.filter(r => r.visible)}
          onEventClick={onEventClick}
          onDayClick={d => { onSelectDate(d); onViewChange('day') }}
        />
      ) : (
        <>
          {/* ── Date strip ───────────────────────────────────────────────── */}
          <div className="flex-shrink-0 bg-white border-b border-gray-100 py-0.5">
            <div className="flex justify-around px-1">
              {weekDays.map((day, i) => {
                const isTd = sameDay(day, today)
                const isSel = sameDay(day, currentDate)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSelectDate(day)}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <span className={`text-[10px] font-medium ${isSel ? 'text-[#111111]' : 'text-gray-400'}`}>
                      {DAY_LETTERS[i]}
                    </span>
                    <span
                      className={[
                        'w-[30px] h-[30px] flex items-center justify-center rounded-full text-[13px] font-semibold',
                        isSel ? 'bg-[#111111] text-white' : isTd ? 'text-red-500 font-bold' : 'text-gray-700',
                      ].join(' ')}
                    >
                      {format(day, 'd')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Resource chips ───────────────────────────────────────────── */}
          {namedResources.length > 1 && (
            <div className="flex-shrink-0 border-b border-gray-100 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <div className="flex gap-1.5 px-3 py-1 w-max">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className={[
                    'px-2.5 h-6 rounded-full text-[11px] font-semibold flex-shrink-0 border transition-colors',
                    allVisible
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'bg-white text-gray-500 border-gray-200',
                  ].join(' ')}
                >
                  Tous
                </button>
                {namedResources.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onToggleResource(r.id)}
                    className={[
                      'flex items-center gap-1 px-2 h-6 rounded-full text-[11px] font-semibold flex-shrink-0 border transition-colors',
                      r.visible ? 'text-white border-transparent' : 'bg-white text-gray-500 border-gray-200',
                    ].join(' ')}
                    style={r.visible ? { backgroundColor: r.color, borderColor: r.color } : undefined}
                  >
                    {r.type === 'team' ? (
                      <Users size={11} />
                    ) : (
                      <span
                        className="w-[14px] h-[14px] rounded-full text-[8px] flex items-center justify-center font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: r.visible ? 'rgba(255,255,255,0.3)' : r.color }}
                      >
                        {initials(r.full_name)}
                      </span>
                    )}
                    <span className="truncate max-w-[72px]">{r.full_name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── All-day events ───────────────────────────────────────────── */}
          {allDayEvs.length > 0 && (
            <div className="flex-shrink-0 border-b border-gray-100 px-3 py-1.5 flex flex-col gap-1">
              {allDayEvs.map(ev => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick(ev)}
                  className="w-full text-left px-2 py-1 rounded-lg text-white text-[11px] font-semibold truncate"
                  style={{ backgroundColor: eventColor(ev, resources) }}
                >
                  {ev.title}
                </button>
              ))}
            </div>
          )}

          {/* La liste des tâches du jour, avec leur heure et qui doit les faire.
              Remplace la grille horaire depuis le 01/08/2026 (remarque de Jeff) :
              sur téléphone, taper un jour depuis le mois doit donner la même lecture
              simple que sur tablette, pas une timeline à faire défiler. */}
          <DayEventsPanel
            currentDate={currentDate}
            events={events}
            resources={resources.filter(r => r.visible)}
            onEventClick={onEventClick}
            onBack={() => onViewChange('month')}
          />
        </>
      )}
    </div>
  )
}
