'use client'

import { format, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import type { CalendarEvent, CalendarResource } from '@/types/calendar'
import { EVENT_COLORS, EVENT_TYPE_LABELS, EVENT_STATUS_LABELS } from '@/lib/calendar/constants'

interface Props {
  currentDate: Date
  events: CalendarEvent[]
  resources: CalendarResource[]
  onEventClick: (e: CalendarEvent) => void
  onBack: () => void
}

export default function DayEventsPanel({ currentDate, events, resources, onEventClick, onBack }: Props) {
  const dayEvents = events
    .filter(e => isSameDay(new Date(e.start_at), currentDate))
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  const resourceMap = new Map(resources.map(r => [r.id, r]))

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#F2F2F7]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button
          onClick={onBack}
          className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 capitalize">
            {format(currentDate, 'EEEE', { locale: fr })}
          </p>
          <p className="text-lg font-black text-gray-900">
            {format(currentDate, 'd MMMM yyyy', { locale: fr })}
          </p>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 font-medium">Aucun événement ce jour</p>
          </div>
        ) : (
          dayEvents.map(ev => {
            const color = ev.color_override ?? EVENT_COLORS[ev.event_type] ?? '#94A3B8'
            const assignee = ev.assigned_to ? resourceMap.get(ev.assigned_to) : null
            const startTime = format(new Date(ev.start_at), 'HH:mm')
            const endTime = format(new Date(ev.end_at), 'HH:mm')

            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onEventClick(ev)}
                className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow active:scale-[.99]"
              >
                <div className="flex items-stretch gap-0">
                  {/* Color bar */}
                  <div className="w-1.5 flex-shrink-0 rounded-l-2xl" style={{ backgroundColor: color }} />

                  <div className="flex-1 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{ev.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span
                            className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: color }}
                          >
                            {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                          </span>
                          {ev.status && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              {EVENT_STATUS_LABELS[ev.status] ?? ev.status}
                            </span>
                          )}
                        </div>
                        {ev.vehicles && ev.vehicles.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1 truncate">
                            {ev.vehicles.map(v => `${v.brand} ${v.model} · ${v.plate}`).join(', ')}
                          </p>
                        )}
                        {(ev.client || assignee) && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {ev.client ? `${ev.client.first_name} ${ev.client.last_name}` : ''}
                            {ev.client && assignee ? ' · ' : ''}
                            {assignee ? assignee.full_name : ''}
                          </p>
                        )}
                      </div>

                      {/* Time */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-mono font-bold text-gray-700">{startTime}</p>
                        {endTime !== startTime && (
                          <p className="text-[11px] font-mono text-gray-400">{endTime}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
