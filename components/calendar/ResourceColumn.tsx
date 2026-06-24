'use client'

import { Printer, X } from 'lucide-react'
import type { CalendarEvent, CalendarResource } from '@/types/calendar'
import { CALENDAR_START_HOUR, CALENDAR_END_HOUR, HOUR_HEIGHT_PX } from '@/lib/calendar/constants'
import { detectOverlaps, getEventPosition, getColumnWindow, formatDateHeader } from '@/lib/calendar/dateUtils'
import EventBlock from './EventBlock'

interface ResourceColumnProps {
  resource: CalendarResource
  events: CalendarEvent[]
  dates: Date[]
  onEventClick: (e: CalendarEvent) => void
  onSlotClick: (resource: CalendarResource, date: Date, hour: number) => void
  onClose: (resource: CalendarResource) => void
}

const HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, i) => CALENDAR_START_HOUR + i
)

export default function ResourceColumn({ resource, events, dates, onEventClick, onSlotClick, onClose }: ResourceColumnProps) {
  const bodyHeight = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX
  const today = new Date()
  // 660px était calé sur 5 colonnes (Sem.5J) et ne suffit plus en Sem.7J
  // (48 + 7×120 = 888px) : en dessous de la largeur réelle nécessaire, les
  // colonnes se font écraser et un événement peut déborder sur le panneau
  // voisin — toujours calculer la largeur minimale sur le nombre de jours
  // réellement affichés plutôt qu'une valeur figée.
  const panelMinWidth = 48 + dates.length * 120

  return (
    <div className="flex flex-col flex-1 border-r border-gray-100" style={{ minWidth: `${panelMinWidth}px` }}>
      <div className="h-[36px] flex items-center justify-between px-2 bg-gray-100 border-b border-gray-200 flex-shrink-0">
        <button type="button" onClick={() => window.print()} className="text-gray-400 hover:text-gray-600">
          <Printer size={13} />
        </button>
        <span
          className="text-[11px] font-bold uppercase tracking-wide"
          style={{ color: resource.color }}
        >
          {resource.full_name}
        </span>
        <button type="button" onClick={() => onClose(resource)} className="text-gray-400 hover:text-gray-600">
          <X size={13} />
        </button>
      </div>

      <div className="flex">
        <div className="w-[48px] flex-shrink-0">
          <div className="h-[32px]" />
          {HOURS.map(hour => (
            <div key={hour} style={{ height: `${HOUR_HEIGHT_PX}px` }} className="text-[11px] text-gray-400 pl-1">
              {String(hour % 24).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex border-b border-gray-100 bg-white flex-shrink-0">
            {dates.map(date => (
              <div
                key={date.toISOString()}
                className="h-[32px] flex-1 min-w-[120px] flex items-center justify-center text-[11px] text-gray-600 border-l border-gray-50"
              >
                {formatDateHeader(date)}
              </div>
            ))}
          </div>

          <div className="flex relative" style={{ height: `${bodyHeight}px` }}>
            {dates.map(date => {
              const colWindow = getColumnWindow(date)
              const dayEvents = events.filter(e => {
                const t = new Date(e.start_at).getTime()
                return t >= colWindow.start.getTime() && t < colWindow.end.getTime()
              })
              const overlaps = detectOverlaps(dayEvents)
              const nowInWindow = today.getTime() >= colWindow.start.getTime() && today.getTime() < colWindow.end.getTime()
              const nowTop = (today.getTime() - colWindow.start.getTime()) / 3_600_000 * HOUR_HEIGHT_PX

              return (
                <div key={date.toISOString()} className="relative flex-1 min-w-[120px] border-l border-gray-50">
                  {HOURS.map(hour => (
                    <div key={hour} style={{ height: `${HOUR_HEIGHT_PX}px` }}>
                      <button
                        type="button"
                        onClick={() => onSlotClick(resource, date, hour)}
                        className="w-full block"
                        style={{ height: `${HOUR_HEIGHT_PX / 2}px`, borderBottom: '1px dashed #F1F5F9' }}
                      />
                      <button
                        type="button"
                        onClick={() => onSlotClick(resource, date, hour)}
                        className="w-full block"
                        style={{ height: `${HOUR_HEIGHT_PX / 2}px`, borderBottom: '1px solid #F1F5F9' }}
                      />
                    </div>
                  ))}

                  {nowInWindow && nowTop >= 0 && nowTop <= bodyHeight && (
                    <div
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{ top: `${nowTop}px`, height: '2px', backgroundColor: '#EF4444' }}
                    />
                  )}

                  {dayEvents.map(ev => {
                    const { top, height } = getEventPosition(ev, colWindow.start)
                    const overlap = overlaps.get(ev.id)
                    const width = overlap && overlap.totalColumns > 1 ? `${100 / overlap.totalColumns}%` : undefined
                    const left = overlap && overlap.totalColumns > 1 ? `${(overlap.column / overlap.totalColumns) * 100}%` : undefined
                    return (
                      <EventBlock
                        key={ev.id}
                        event={ev}
                        top={top}
                        height={height}
                        width={width}
                        left={left}
                        onClick={onEventClick}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
