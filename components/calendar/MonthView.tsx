'use client'

import { startOfWeek } from 'date-fns'
import type { CalendarEvent } from '@/types/calendar'
import { EVENT_COLORS } from '@/lib/calendar/constants'
import { getMonthDates, isSameDay } from '@/lib/calendar/dateUtils'

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (e: CalendarEvent) => void
  onDayClick: (date: Date) => void
}

const DAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MAX_VISIBLE = 3

export default function MonthView({ currentDate, events, onEventClick, onDayClick }: MonthViewProps) {
  const days = getMonthDates(currentDate)
  const today = new Date()
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 }).getTime()

  return (
    <div className="flex-1 flex flex-col overflow-auto" style={{ paddingBottom: '56px' }}>
      <div className="grid grid-cols-7 flex-shrink-0">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-[10px] text-gray-400 uppercase text-center py-1.5 border-b border-gray-100">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(100px, 1fr))` }}>
        {days.map(day => {
          const isCurrentWeek = startOfWeek(day, { weekStartsOn: 1 }).getTime() === currentWeekStart
          const isToday = isSameDay(day, today)
          const dayEvents = events
            .filter(e => e.status !== 'termine' && isSameDay(new Date(e.start_at), day))
            .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
          const visible = dayEvents.slice(0, MAX_VISIBLE)
          const rest = dayEvents.length - visible.length

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick(day)}
              className="border-b border-r border-gray-100 p-1.5 text-left flex flex-col gap-1 overflow-hidden"
              style={{ backgroundColor: isCurrentWeek ? 'white' : '#F8FAFC' }}
            >
              <span
                className={[
                  'text-[12px] font-medium w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0',
                  isToday ? 'bg-[#111111] text-white' : 'text-gray-700',
                ].join(' ')}
              >
                {day.getDate()}
              </span>

              <div className="flex flex-col gap-0.5">
                {visible.map(ev => (
                  <span
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                    className="text-[10px] px-2 py-[1px] rounded-full text-white truncate"
                    style={{ backgroundColor: ev.color_override ?? EVENT_COLORS[ev.event_type] }}
                  >
                    {ev.title}
                  </span>
                ))}
                {rest > 0 && (
                  <span className="text-[10px] text-gray-500 px-2">+{rest} autres</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
