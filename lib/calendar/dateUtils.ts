import {
  startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth,
  differenceInCalendarDays, format,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { CALENDAR_START_HOUR, CALENDAR_END_HOUR, HOUR_HEIGHT_PX } from './constants'
import type { CalendarEvent } from '@/types/calendar'

export const DAY_ABBR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

export function getWeekDates(date: Date, mode: 'week_5d' | 'week_7d'): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const count = mode === 'week_5d' ? 5 : 7
  return Array.from({ length: count }, (_, i) => addDays(start, i))
}

export function getMonthDates(date: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(date), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(date), { weekStartsOn: 1 })
  const days = differenceInCalendarDays(gridEnd, gridStart) + 1
  return Array.from({ length: days }, (_, i) => addDays(gridStart, i))
}

/** "lun 01 (août)" — abréviation maison (sans point) pour coller exactement à la maquette. */
export function formatDateHeader(date: Date): string {
  const day = DAY_ABBR[date.getDay()]
  const dayNum = format(date, 'dd')
  const month = format(date, 'MMMM', { locale: fr })
  return `${day} ${dayNum} (${month})`
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

/**
 * Fenêtre "journée métier" d'une colonne : de CALENDAR_START_HOUR (7h) le jour
 * J à CALENDAR_END_HOUR (3h, soit 27 sur l'échelle continue 24+3) le jour J+1.
 * Calculée en millisecondes réels plutôt qu'en arithmétique d'heure-du-jour,
 * pour gérer le passage de minuit sans cas particulier.
 */
export function getColumnWindow(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  start.setHours(CALENDAR_START_HOUR, 0, 0, 0)
  const end = new Date(start.getTime() + (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 3_600_000)
  return { start, end }
}

export function getEventPosition(
  event: CalendarEvent,
  windowStart: Date,
): { top: number; height: number } {
  const start = new Date(event.start_at)
  const end   = new Date(event.end_at)
  const topMs = start.getTime() - windowStart.getTime()
  const durationMs = end.getTime() - start.getTime()
  return {
    top:    (topMs / 3_600_000) * HOUR_HEIGHT_PX,
    height: Math.max((durationMs / 3_600_000) * HOUR_HEIGHT_PX, 24), // minimum 24px
  }
}

/**
 * Regroupe les événements qui se chevauchent en clusters, puis assigne à chacun
 * une colonne (algorithme glouton classique d'agenda) et le nombre total de
 * colonnes du cluster — pour calculer ensuite width/left en pourcentage.
 */
export function detectOverlaps(
  events: CalendarEvent[]
): Map<string, { column: number; totalColumns: number }> {
  const result = new Map<string, { column: number; totalColumns: number }>()
  if (events.length === 0) return result

  const sorted = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  )

  let cluster: CalendarEvent[] = []
  let clusterEnd = -Infinity

  const flushCluster = () => {
    if (cluster.length === 0) return
    const columnEnds: number[] = []
    const columnOf = new Map<string, number>()

    for (const ev of cluster) {
      const start = new Date(ev.start_at).getTime()
      const end = new Date(ev.end_at).getTime()
      let col = columnEnds.findIndex(endTime => endTime <= start)
      if (col === -1) {
        col = columnEnds.length
        columnEnds.push(end)
      } else {
        columnEnds[col] = end
      }
      columnOf.set(ev.id, col)
    }

    const totalColumns = columnEnds.length
    for (const ev of cluster) {
      result.set(ev.id, { column: columnOf.get(ev.id)!, totalColumns })
    }
    cluster = []
    clusterEnd = -Infinity
  }

  for (const ev of sorted) {
    const start = new Date(ev.start_at).getTime()
    const end = new Date(ev.end_at).getTime()
    if (cluster.length > 0 && start >= clusterEnd) {
      flushCluster()
    }
    cluster.push(ev)
    clusterEnd = Math.max(clusterEnd, end)
  }
  flushCluster()

  return result
}
