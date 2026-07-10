'use client'

import { useEffect, useRef } from 'react'
import { addDays, addMonths, subMonths, format, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bell, ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react'
import type { CalendarEvent, CalendarResource, CalendarView } from '@/types/calendar'
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  EVENT_COLORS,
  HOUR_HEIGHT_PX,
  UNASSIGNED_RESOURCE_ID,
} from '@/lib/calendar/constants'
import MonthView from './MonthView'

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
  return EVENT_COLORS[ev.event_type] ?? '#94A3B8'
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
  onEventClick: (ev: CalendarEvent) => void
  onSlotClick: (resource: CalendarResource, date: Date, hour: number) => void
}

export default function MobileCalendar({
  currentDate, view, events, resources, alertCount,
  onSelectDate, onViewChange, onToggleResource, onSelectAll, onShowAlerts,
  onCreateNew, onEventClick, onSlotClick,
}: MobileCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = new Date()

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { start: dayStart, end: dayEnd } = dayBounds(currentDate)
  const visibleIds = getVisibleIds(resources)
  const allVisible = resources.every(r => r.visible)
  const namedResources = resources.filter(r => r.id !== UNASSIGNED_RESOURCE_ID)
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
      <div className="flex-shrink-0 px-3 pt-2 pb-1.5 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleHeaderNav(-1)}
            className="w-8 h-8 flex items-center justify-center text-gray-400"
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
            onClick={() => handleHeaderNav(1)}
            className="w-8 h-8 flex items-center justify-center text-gray-400"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1">
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
            className="relative w-8 h-8 flex items-center justify-center"
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
            onClick={onCreateNew}
            className="w-8 h-8 bg-[#111111] rounded-full flex items-center justify-center"
          >
            <Plus size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── View tabs ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex px-3 gap-1 py-2 border-b border-gray-100">
        {([['day', 'Jour'], ['month', 'Mois']] as [CalendarView, string][]).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={[
              'px-4 h-7 rounded-lg text-[12px] font-semibold transition-colors',
              view === v ? 'bg-[#111111] text-white' : 'bg-gray-100 text-gray-500',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
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
          <div className="flex-shrink-0 bg-white border-b border-gray-100 py-2">
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
              <div className="flex gap-2 px-3 py-2 w-max">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className={[
                    'px-3 h-7 rounded-full text-[12px] font-semibold flex-shrink-0 border transition-colors',
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
                      'flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[12px] font-semibold flex-shrink-0 border transition-colors',
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

          {/* ── Timeline ─────────────────────────────────────────────────── */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto"
            style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom) + 16px)' }}
          >
            <div className="flex" style={{ height: TOTAL_H, minHeight: TOTAL_H }}>
              {/* Hour labels */}
              <div className="w-12 flex-shrink-0 relative select-none">
                {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                  const h = CALENDAR_START_HOUR + i
                  const label = h < 24 ? `${String(h).padStart(2, '0')}h` : `0${h - 24}h`
                  return (
                    <div
                      key={h}
                      className="absolute w-full pr-2 text-right"
                      style={{ top: i * HOUR_HEIGHT_PX - 8 }}
                    >
                      <span className="text-[10px] text-gray-400">{label}</span>
                    </div>
                  )
                })}
              </div>

              {/* Grid + events */}
              <div
                className="flex-1 relative border-l border-gray-100"
                onClick={e => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const hour = Math.floor((e.clientY - rect.top) / HOUR_HEIGHT_PX) + CALENDAR_START_HOUR
                  if (defaultResource) onSlotClick(defaultResource, currentDate, Math.min(hour, 23))
                }}
              >
                {/* Hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: i * HOUR_HEIGHT_PX }}
                  />
                ))}
                {/* Half-hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={`half-${i}`}
                    className="absolute left-0 right-0 border-t border-gray-50"
                    style={{ top: i * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
                  />
                ))}

                <NowLine day={currentDate} />

                {positioned.map(p => (
                  <button
                    key={p.ev.id}
                    type="button"
                    onClick={e => { e.stopPropagation(); onEventClick(p.ev) }}
                    className="absolute rounded-lg px-2 py-1 text-left overflow-hidden"
                    style={{
                      top: p.top + 1,
                      height: p.height - 2,
                      left: p.left,
                      width: p.width,
                      backgroundColor: p.color,
                      zIndex: 2,
                    }}
                  >
                    <p className="text-white text-[11px] font-semibold leading-tight line-clamp-1">{p.ev.title}</p>
                    {p.height >= 36 && (
                      <p className="text-white/75 text-[10px] leading-tight mt-0.5 line-clamp-1">
                        {format(new Date(p.ev.start_at), 'HH:mm')}
                        {' – '}
                        {format(new Date(p.ev.end_at), 'HH:mm')}
                        {p.ev.client ? ` · ${p.ev.client.first_name}` : ''}
                      </p>
                    )}
                  </button>
                ))}

                {positioned.length === 0 && dayEvs.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-[13px] text-gray-300 font-medium">Aucun événement</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
