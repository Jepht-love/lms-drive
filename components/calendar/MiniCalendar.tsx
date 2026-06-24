'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CalendarEvent } from '@/types/calendar'
import { EVENT_COLORS } from '@/lib/calendar/constants'
import { getMonthDates, isSameDay } from '@/lib/calendar/dateUtils'

interface MiniCalendarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  events: CalendarEvent[]
}

const DAY_HEADERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function MiniCalendar({ selectedDate, onSelectDate, events }: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = useState(selectedDate)
  const today = new Date()

  useEffect(() => {
    setViewMonth(selectedDate)
  }, [selectedDate.getFullYear(), selectedDate.getMonth()])

  const days = getMonthDates(viewMonth)

  const dotColorFor = (day: Date) => {
    const ev = events.find(e => isSameDay(new Date(e.start_at), day))
    return ev ? EVENT_COLORS[ev.event_type] : null
  }

  return (
    <div>
      <div className="flex items-center justify-between px-1 mb-2">
        <button
          type="button"
          onClick={() => setViewMonth(m => subMonths(m, 1))}
          className="p-1 text-gray-400 hover:text-[#111111]"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-semibold capitalize">
          {format(viewMonth, 'MMMM yyyy', { locale: fr })}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth(m => addMonths(m, 1))}
          className="p-1 text-gray-400 hover:text-[#111111]"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DAY_HEADERS.map((d, i) => (
          <div key={i} className="w-[32px] h-[20px] flex items-center justify-center text-[10px] text-gray-400 uppercase">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map(day => {
          const outOfMonth = day.getMonth() !== viewMonth.getMonth()
          const isSelected = isSameDay(day, selectedDate)
          const isToday = isSameDay(day, today)
          const dotColor = dotColorFor(day)

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className="w-[32px] h-[32px] flex flex-col items-center justify-center"
            >
              <span
                className={[
                  'w-[26px] h-[26px] rounded-full flex items-center justify-center text-[12px]',
                  isSelected ? 'bg-[#111111] text-white' : '',
                  !isSelected && isToday ? 'border border-[#111111]' : '',
                  !isSelected && outOfMonth ? 'text-gray-300' : '',
                  !isSelected && !outOfMonth ? 'text-gray-700' : '',
                ].join(' ')}
              >
                {day.getDate()}
              </span>
              <span
                className="w-1 h-1 rounded-full -mt-0.5"
                style={{ backgroundColor: dotColor ?? 'transparent' }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
