'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  format, addDays, addWeeks, subWeeks, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isToday, parseISO,
  getHours, getMinutes, differenceInMinutes, differenceInDays, startOfDay
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const HOUR_START = 0
const HOUR_END   = 24
const HOUR_PX    = 60
const TOTAL_PX   = HOUR_END * HOUR_PX

const ALL_HOURS = Array.from({ length: HOUR_END }, (_, i) => i)

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  depart:             { bg: '#dcfce7', border: '#16a34a', text: '#15803d' },
  retour:             { bg: '#fff7ed', border: '#f97316', text: '#c2410c' },
  retard:             { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c' },
  lavage:             { bg: '#faf5ff', border: '#a855f7', text: '#7e22ce' },
  preparation:        { bg: '#faf5ff', border: '#a855f7', text: '#7e22ce' },
  rendez_vous_client: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  rendez_vous_garage: { bg: '#fff7ed', border: '#f97316', text: '#c2410c' },
  livraison:          { bg: '#f0fdfa', border: '#14b8a6', text: '#0f766e' },
  recuperation:       { bg: '#ecfeff', border: '#06b6d4', text: '#0e7490' },
  entretien:          { bg: '#fff7ed', border: '#ea580c', text: '#c2410c' },
  marketing:          { bg: '#fdf2f8', border: '#ec4899', text: '#be185d' },
  autre:              { bg: '#f9fafb', border: '#9ca3af', text: '#374151' },
}

const TASK_LABELS: Record<string, string> = {
  lavage: 'Lavage', preparation: 'Prépa', rendez_vous_client: 'RDV Client',
  rendez_vous_garage: 'RDV Garage', livraison: 'Livraison',
  recuperation: 'Récupération', entretien: 'Entretien', marketing: 'Marketing', autre: 'Tâche',
}

// Couleurs des réservations selon leur statut (barres multi-jours)
const RESA_STATUS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  en_cours:   { bg: '#dcfce7', border: '#16a34a', text: '#14532d', label: 'En cours' },
  confirmee:  { bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a', label: 'Confirmée' },
  reservee:   { bg: '#dbeafe', border: '#2563eb', text: '#1e3a8a', label: 'Réservée' },
  en_attente: { bg: '#fef9c3', border: '#ca8a04', text: '#713f12', label: 'En attente' },
  en_retard:  { bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d', label: 'En retard' },
}
function resaCfg(status: string) {
  return RESA_STATUS[status] ?? RESA_STATUS.confirmee
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function normalize<T>(x: T | T[]): T { return Array.isArray(x) ? x[0] : x }

function toPx(dateStr: string): number {
  const d = parseISO(dateStr)
  return (getHours(d) * 60 + getMinutes(d)) * (HOUR_PX / 60)
}

function durPx(start: string, end: string): number {
  const mins = differenceInMinutes(parseISO(end), parseISO(start))
  return Math.max(20, mins * (HOUR_PX / 60))
}

function fmtHour(dateStr: string): string {
  return format(parseISO(dateStr), 'HH:mm')
}

type CalEvent = {
  id: string; type: string; title: string; subtitle: string
  start: string; end: string; href: string; allDay: boolean
}

function computeColumns(events: CalEvent[]) {
  if (!events.length) return [] as Array<{ evt: CalEvent; col: number; totalCols: number }>
  const result: Array<{ evt: CalEvent; col: number; totalCols: number }> =
    events.map(evt => ({ evt, col: 0, totalCols: 1 }))
  const columns: CalEvent[][] = []

  for (let i = 0; i < events.length; i++) {
    const evt = events[i]
    const s = toPx(evt.start)
    const e2 = s + durPx(evt.start, evt.end)
    let col = 0
    for (;;) {
      if (!columns[col]) { columns[col] = []; break }
      const overlaps = columns[col].some(o => {
        const os = toPx(o.start); const oe = os + durPx(o.start, o.end)
        return s < oe && e2 > os
      })
      if (!overlaps) break
      col++
    }
    if (!columns[col]) columns[col] = []
    columns[col].push(evt)
    result[i].col = col
  }

  for (const item of result) {
    const s = toPx(item.evt.start)
    const e2 = s + durPx(item.evt.start, item.evt.end)
    item.totalCols = Math.max(...result.map(o => {
      const os = toPx(o.evt.start); const oe = os + durPx(o.evt.start, o.evt.end)
      return s < oe && e2 > os ? o.col + 1 : 0
    }))
  }

  return result
}

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const router = useRouter()
  const supabase = createClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [view, setView] = useState<'semaine' | 'jour'>('semaine')
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [reservations, setReservations] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      const h = getHours(new Date())
      const target = Math.max(0, (h - 1) * HOUR_PX)
      scrollRef.current.scrollTop = target
    }
  }, [view])

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const start = currentWeekStart.toISOString()
      const end = addDays(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 1).toISOString()

      const [{ data: r }, { data: t }] = await Promise.all([
        supabase.from('reservations')
          .select(`id,status,start_datetime,end_datetime,
                   vehicles(id,plate,brand,model),
                   clients(first_name,last_name)`)
          .not('status', 'in', '(annulee,terminee)')
          .gte('start_datetime', addDays(currentWeekStart, -1).toISOString())
          .lte('end_datetime', end),
        supabase.from('tasks')
          .select(`id,title,type,status,due_datetime,
                   vehicles(plate),
                   profiles!tasks_assigned_to_fkey(full_name)`)
          .neq('status', 'annule')
          .gte('due_datetime', start)
          .lte('due_datetime', end)
      ])

      setReservations(r ?? [])
      setTasks(t ?? [])
      setLoading(false)
    }
    load()
  }, [currentWeekStart])

  function prevWeek() { setCurrentWeekStart(d => subWeeks(d, 1)) }
  function nextWeek() { setCurrentWeekStart(d => addWeeks(d, 1)) }
  function goToday() {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
    setSelectedDay(new Date())
  }

  // Seules les tâches ponctuelles vont dans la grille horaire (lavage, RDV, etc.)
  function getTasksForDay(day: Date) {
    const events: CalEvent[] = []
    tasks.forEach(t => {
      if (!isSameDay(parseISO(t.due_datetime), day)) return
      const v = normalize(t.vehicles)
      const a = normalize(t.profiles)
      const end = new Date(parseISO(t.due_datetime).getTime() + 60 * 60 * 1000)
      events.push({
        id: `task-${t.id}`, type: t.type ?? 'autre',
        title: `${TASK_LABELS[t.type] ?? 'Tâche'} — ${t.title}`,
        subtitle: [(v as any)?.plate, (a as any)?.full_name].filter(Boolean).join(' · '),
        start: t.due_datetime, end: end.toISOString(),
        href: `/calendar/tasks/${t.id}`, allDay: false,
      })
    })
    return events.sort((a, b) => a.start.localeCompare(b.start))
  }

  function getAllDayForDay(day: Date) {
    return reservations.filter(r => {
      const s = startOfDay(parseISO(r.start_datetime))
      const e = startOfDay(parseISO(r.end_datetime))
      const d = startOfDay(day)
      return d >= s && d <= e
    })
  }

  function resaLabel(r: any) {
    const c = normalize(r.clients)
    const v = normalize(r.vehicles)
    const client  = c ? `${(c as any).first_name ?? ''} ${(c as any).last_name ?? ''}`.trim() : ''
    const vehicle = [(v as any)?.brand, (v as any)?.model].filter(Boolean).join(' ') || (v as any)?.plate || ''
    return { client, vehicle }
  }

  // Barres de réservation continues multi-jours pour la vue semaine
  function getWeekReservationBars() {
    const weekStart = startOfDay(weekDays[0])
    const weekEnd   = startOfDay(weekDays[6])
    const bars = reservations
      .map(r => {
        const rs = startOfDay(parseISO(r.start_datetime))
        const re = startOfDay(parseISO(r.end_datetime))
        if (re < weekStart || rs > weekEnd) return null
        return {
          r,
          startCol: Math.max(0, differenceInDays(rs, weekStart)),
          endCol:   Math.min(6, differenceInDays(re, weekStart)),
          startsBeforeWeek: rs < weekStart,
          endsAfterWeek:    re > weekEnd,
          lane: 0,
        }
      })
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol)

    const laneEnds: number[] = []
    bars.forEach(bar => {
      let lane = 0
      while (lane < laneEnds.length && laneEnds[lane] >= bar.startCol) lane++
      laneEnds[lane] = bar.endCol
      bar.lane = lane
    })
    return { bars, laneCount: Math.max(1, laneEnds.length) }
  }

  const nowPx = (getHours(now) * 60 + getMinutes(now)) * (HOUR_PX / 60)

  // ── VUE JOUR ─────────────────────────────────────────────────────────────
  function DayView({ day }: { day: Date }) {
    const events = getTasksForDay(day)
    const allDayResas = getAllDayForDay(day)
    const placed = computeColumns(events)

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* En-tête du jour */}
        <div className="flex border-b-2 border-gray-200 bg-white flex-shrink-0">
          <div className="w-16 flex-shrink-0" />
          <div className={`flex-1 py-3 text-center ${isToday(day) ? 'bg-black' : ''}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              {format(day, 'EEEE', { locale: fr })}
            </p>
            <p className={`text-4xl font-black ${isToday(day) ? 'text-white' : 'text-gray-900'}`}>
              {format(day, 'd')}
            </p>
          </div>
        </div>

        {/* Bandeau horizontal des réservations actives */}
        {allDayResas.length > 0 && (
          <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
            <div style={{ width: 64, flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
              <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Locations</span>
            </div>
            <div style={{ flex: 1, overflowX: 'auto', padding: '8px 12px 8px 8px', scrollbarWidth: 'none' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {allDayResas.map(r => {
                  const v = normalize(r.vehicles)
                  const c = normalize(r.clients)
                  const isStart  = isSameDay(parseISO(r.start_datetime), day)
                  const isEnd    = isSameDay(parseISO(r.end_datetime), day)
                  const isLate   = r.status === 'en_retard'
                  const cfg      = resaCfg(r.status)
                  const badge = isStart
                    ? { label: 'Départ', color: '#15803d', bg: '#dcfce7' }
                    : isEnd
                    ? { label: isLate ? 'Retard' : 'Retour', color: isLate ? '#b91c1c' : '#c2410c', bg: isLate ? '#fef2f2' : '#fff7ed' }
                    : { label: 'En cours', color: '#1e3a8a', bg: '#dbeafe' }
                  return (
                    <Link key={r.id} href={`/reservations/${r.id}`}
                      style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 12px', borderRadius: 12,
                        border: `1px solid ${cfg.border}`, borderLeftWidth: 3,
                        fontSize: 12, fontWeight: 500, textDecoration: 'none',
                        backgroundColor: cfg.bg, color: cfg.text,
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      {badge && (
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, backgroundColor: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      )}
                      <span style={{ fontWeight: 700 }}>
                        {(c as any)?.first_name} {(c as any)?.last_name}
                      </span>
                      <span style={{ opacity: 0.7 }}>
                        {[(v as any)?.brand, (v as any)?.model].filter(Boolean).join(' ') || (v as any)?.plate}
                      </span>
                      {(isStart || isEnd) && (
                        <span style={{ fontSize: 11, opacity: 0.55 }}>
                          {isStart ? fmtHour(r.start_datetime) : fmtHour(r.end_datetime)}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Grille horaire */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="flex relative" style={{ height: `${TOTAL_PX}px` }}>
            <div className="w-16 flex-shrink-0 relative border-r border-gray-200">
              {ALL_HOURS.map(h => (
                <div key={h} className="absolute right-0 left-0 flex items-start justify-end pr-2"
                  style={{ top: `${h * HOUR_PX - 8}px` }}>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 relative"
              onClick={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const scrollTop = (e.currentTarget.closest('.overflow-y-auto') as HTMLElement)?.scrollTop ?? 0
                const y = e.clientY - rect.top + scrollTop
                const hour = Math.floor(y / HOUR_PX)
                const mins = Math.round(((y % HOUR_PX) / HOUR_PX) * 60)
                router.push(`/calendar/tasks/new?date=${format(day, 'yyyy-MM-dd')}&hour=${hour}&min=${mins}`)
              }}
            >
              {ALL_HOURS.map(h => (
                <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: `${h * HOUR_PX}px` }} />
              ))}
              {ALL_HOURS.map(h => (
                <div key={`${h}h`} className="absolute left-0 right-0 border-t border-gray-50"
                  style={{ top: `${h * HOUR_PX + HOUR_PX / 2}px` }} />
              ))}

              {isToday(day) && (
                <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                  style={{ top: `${nowPx}px` }}>
                  <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                  <div className="flex-1 h-[2px] bg-red-500" />
                </div>
              )}

              {placed.map(({ evt, col, totalCols }) => {
                const cfg = EVENT_COLORS[evt.type] ?? EVENT_COLORS.autre
                const pct = 100 / totalCols
                return (
                  <Link key={evt.id} href={evt.href}
                    className="absolute rounded-lg px-2 py-1 z-10 overflow-hidden shadow-sm border-l-[3px]"
                    style={{
                      top: `${toPx(evt.start)}px`,
                      height: `${durPx(evt.start, evt.end)}px`,
                      left: `${col * pct + 0.5}%`,
                      width: `calc(${pct}% - 4px)`,
                      backgroundColor: cfg.bg,
                      borderLeftColor: cfg.border,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="text-[11px] font-bold leading-tight truncate" style={{ color: cfg.text }}>
                      {fmtHour(evt.start)} {evt.title}
                    </p>
                    {evt.subtitle && durPx(evt.start, evt.end) > 32 && (
                      <p className="text-[10px] truncate" style={{ color: cfg.text, opacity: 0.7 }}>
                        {evt.subtitle}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── VUE SEMAINE ──────────────────────────────────────────────────────────
  function WeekView() {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex border-b-2 border-gray-200 bg-white flex-shrink-0">
          <div className="w-16 flex-shrink-0 border-r border-gray-100" />
          {weekDays.map((day, i) => (
            <button key={i}
              className={`flex-1 py-2 text-center border-r border-gray-100 last:border-0 transition-colors
                ${isToday(day) ? 'bg-black hover:bg-gray-900' : 'hover:bg-gray-50'}`}
              onClick={() => { setSelectedDay(day); setView('jour') }}
            >
              <p className={`text-[11px] font-bold uppercase tracking-widest ${isToday(day) ? 'text-gray-400' : 'text-gray-400'}`}>
                {format(day, 'EEE', { locale: fr })}
              </p>
              <p className={`text-2xl font-black leading-tight ${isToday(day) ? 'text-white' : 'text-gray-900'}`}>
                {format(day, 'd')}
              </p>
              {getAllDayForDay(day).length > 0 && (
                <div className="flex justify-center gap-0.5 mt-1 min-h-[6px]">
                  {getAllDayForDay(day).slice(0, 3).map((r, ei) => (
                    <div key={ei} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: resaCfg(r.status).border }} />
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>

        {(() => {
          const { bars, laneCount } = getWeekReservationBars()
          const bandHeight = laneCount * 26 + 6
          return (
            <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
              <div className="w-16 flex-shrink-0 border-r border-gray-100 flex items-center justify-end pr-2">
                <span className="text-[10px] text-gray-400 leading-tight text-right">Locations</span>
              </div>
              <div className="flex-1 relative" style={{ height: bandHeight }}>
                {/* fond du jour courant */}
                {weekDays.map((d, i) => isToday(d) ? (
                  <div key={`bg-${i}`} className="absolute top-0 bottom-0 bg-blue-50/50"
                    style={{ left: `${(i * 100) / 7}%`, width: `${100 / 7}%` }} />
                ) : null)}
                {/* séparateurs de colonnes */}
                {weekDays.slice(0, 6).map((_, i) => (
                  <div key={`sep-${i}`} className="absolute top-0 bottom-0 border-r border-gray-100"
                    style={{ left: `${((i + 1) * 100) / 7}%` }} />
                ))}
                {bars.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] text-gray-300">Aucune location cette semaine</span>
                  </div>
                )}
                {bars.map(bar => {
                  const cfg = resaCfg(bar.r.status)
                  const { client, vehicle } = resaLabel(bar.r)
                  const leftPct  = (bar.startCol * 100) / 7
                  const widthPct = ((bar.endCol - bar.startCol + 1) * 100) / 7
                  return (
                    <Link key={bar.r.id} href={`/reservations/${bar.r.id}`}
                      className="absolute flex items-center gap-1.5 px-2 overflow-hidden"
                      style={{
                        left: `calc(${leftPct}% + 3px)`,
                        width: `calc(${widthPct}% - 6px)`,
                        top: bar.lane * 26 + 3,
                        height: 22,
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderLeft: `3px solid ${cfg.border}`,
                        borderRadius: 6,
                        color: '#374151',
                        textDecoration: 'none',
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      {bar.startsBeforeWeek && <span style={{ opacity: 0.5, flexShrink: 0 }}>‹</span>}
                      <span style={{ width: 7, height: 7, borderRadius: 9999, backgroundColor: cfg.border, flexShrink: 0 }} />
                      <span className="text-[11px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                        {client}{vehicle ? ` · ${vehicle}` : ''}
                      </span>
                      {bar.endsAfterWeek && <span style={{ opacity: 0.5, flexShrink: 0, marginLeft: 'auto' }}>›</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="flex relative" style={{ height: `${TOTAL_PX}px` }}>
            <div className="w-16 flex-shrink-0 relative border-r border-gray-200 bg-white sticky left-0 z-20">
              {ALL_HOURS.map(h => (
                <div key={h} className="absolute right-0 left-0 flex items-start justify-end pr-2"
                  style={{ top: `${h * HOUR_PX - 8}px` }}>
                  <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">
                    {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
                  </span>
                </div>
              ))}
            </div>

            {weekDays.map((day, di) => {
              const events = getTasksForDay(day)
              return (
                <div key={di}
                  className={`flex-1 border-r border-gray-100 last:border-0 relative ${isToday(day) ? 'bg-blue-50/10' : 'bg-white'}`}
                  onClick={e => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0)
                    const hour = Math.floor(y / HOUR_PX)
                    const mins = Math.round(((y % HOUR_PX) / HOUR_PX) * 60)
                    router.push(`/calendar/tasks/new?date=${format(day, 'yyyy-MM-dd')}&hour=${hour}&min=${mins}`)
                  }}
                >
                  {ALL_HOURS.map(h => (
                    <div key={h} className="absolute left-0 right-0 border-t border-gray-100"
                      style={{ top: `${h * HOUR_PX}px` }} />
                  ))}
                  {ALL_HOURS.map(h => (
                    <div key={`${h}h`} className="absolute left-0 right-0 border-t border-gray-50"
                      style={{ top: `${h * HOUR_PX + HOUR_PX / 2}px` }} />
                  ))}

                  {isToday(day) && (
                    <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                      style={{ top: `${nowPx}px` }}>
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 -ml-1.5" />
                      <div className="flex-1 h-[2px] bg-red-500" />
                    </div>
                  )}

                  {computeColumns(events).map(({ evt, col, totalCols }) => {
                    const cfg = EVENT_COLORS[evt.type] ?? EVENT_COLORS.autre
                    const pct = 100 / totalCols
                    return (
                      <Link key={evt.id} href={evt.href}
                        className="absolute rounded px-1.5 py-1 z-10 overflow-hidden border-l-[3px] shadow-sm"
                        style={{
                          top: `${toPx(evt.start)}px`,
                          height: `${durPx(evt.start, evt.end)}px`,
                          left: `${col * pct}%`,
                          width: `calc(${pct}% - 2px)`,
                          backgroundColor: cfg.bg,
                          borderLeftColor: cfg.border,
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="text-[10px] font-bold leading-tight truncate" style={{ color: cfg.text }}>
                          {fmtHour(evt.start)} {evt.title}
                        </p>
                        {evt.subtitle && durPx(evt.start, evt.end) > 30 && (
                          <p className="text-[9px] truncate" style={{ color: cfg.text, opacity: 0.7 }}>
                            {evt.subtitle}
                          </p>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      onDragEnd={(_e, info) => {
        if (info.offset.x < -80) nextWeek()
        else if (info.offset.x > 80) prevWeek()
      }}
      style={{
        display: 'flex', flexDirection: 'column',
        // 100dvh - safe-area-top (notch/Dynamic Island) - safe-area-bottom (home indicator) - header content (84px) - bottom nav bar (60px)
        height: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 144px)',
        backgroundColor: 'white', overflow: 'hidden',
        // Casser hors du padding px-4 py-5 du layout
        marginLeft: '-1rem', marginRight: '-1rem', marginTop: '-1.25rem',
        touchAction: 'pan-y',
      }}
    >
      {/* TOOLBAR */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 16px', borderBottom: '1px solid #e5e7eb',
        backgroundColor: 'white', flexShrink: 0,
      }}>
        <button onClick={goToday} style={{
          padding: '6px 16px', border: '1px solid #dadce0', borderRadius: '4px',
          backgroundColor: 'white', fontSize: '13px', fontWeight: '500',
          color: '#3c4043', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          Aujourd'hui
        </button>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={prevWeek} style={{
            width: '32px', height: '32px', borderRadius: '50%', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', fontSize: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4043',
          }}>‹</button>
          <button onClick={nextWeek} style={{
            width: '32px', height: '32px', borderRadius: '50%', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', fontSize: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3c4043',
          }}>›</button>
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: '400', color: '#3c4043', flex: 1 }}>
          {view === 'semaine'
            ? `${format(weekDays[0], 'd MMM', { locale: fr })} – ${format(weekDays[6], 'd MMM yyyy', { locale: fr })}`
            : format(selectedDay, 'EEEE d MMMM yyyy', { locale: fr })}
        </h2>

        <div style={{ display: 'flex', border: '1px solid #dadce0', borderRadius: '4px', overflow: 'hidden' }}>
          {(['semaine', 'jour'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 16px', border: 'none',
              backgroundColor: view === v ? '#e8f0fe' : 'white',
              color: view === v ? '#1a73e8' : '#3c4043',
              fontWeight: view === v ? '600' : '400',
              fontSize: '13px', cursor: 'pointer',
              borderRight: v === 'semaine' ? '1px solid #dadce0' : 'none',
            }}>
              {v === 'semaine' ? 'Semaine' : 'Jour'}
            </button>
          ))}
        </div>

        <Link href="/calendar/tasks" style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: '8px',
          textDecoration: 'none', fontSize: '12px', fontWeight: '500', color: '#374151', backgroundColor: 'white',
        }}>
          ☰ Tâches
        </Link>
        <Link href="/calendar/tasks/new" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 16px', backgroundColor: '#111111', color: 'white',
          borderRadius: '24px', textDecoration: 'none', fontSize: '13px', fontWeight: '600',
        }}>
          + Créer
        </Link>
      </div>

      {/* CONTENU */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>Chargement...</p>
        </div>
      ) : view === 'semaine' ? (
        <WeekView />
      ) : (
        <DayView day={selectedDay} />
      )}
    </motion.div>
  )
}
