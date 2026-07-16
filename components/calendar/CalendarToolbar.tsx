'use client'

import { ChevronLeft, ChevronRight, HelpCircle, Bell } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { CalendarView } from '@/types/calendar'
import { DAY_ABBR, getWeekDates } from '@/lib/calendar/dateUtils'

interface CalendarToolbarProps {
  currentDate: Date
  view: CalendarView
  onViewChange: (v: CalendarView) => void
  onNavigate: (dir: 'prev' | 'next' | 'today') => void
  alertCount: number
  onShowAlerts: () => void
}


function rangeLabel(view: CalendarView, currentDate: Date): string {
  const monthYear = format(currentDate, 'MMMM yyyy', { locale: fr })

  if (view === 'month') return monthYear

  if (view === 'day') {
    const day = DAY_ABBR[currentDate.getDay()]
    return `${day} ${format(currentDate, 'dd')} (${monthYear})`
  }

  const dates = getWeekDates(currentDate, view)
  const first = dates[0]
  const last = dates[dates.length - 1]
  const lastMonthYear = format(last, 'MMMM yyyy', { locale: fr })
  return `${DAY_ABBR[first.getDay()]} ${format(first, 'dd')} — ${DAY_ABBR[last.getDay()]} ${format(last, 'dd')} (${lastMonthYear})`
}

/** Vue compacte, pensée pour vivre dans la sidebar (220px) plutôt qu'en barre pleine largeur. */
export default function CalendarToolbar({ currentDate, view, onViewChange, onNavigate, alertCount, onShowAlerts }: CalendarToolbarProps) {
  return (
    <div className="pb-2">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => onNavigate('prev')}
          className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[13px] font-semibold capitalize">{rangeLabel(view, currentDate)}</span>
        <button
          type="button"
          onClick={() => onNavigate('next')}
          className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg text-gray-500"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <button
          type="button"
          onClick={() => onNavigate('today')}
          className="flex-1 h-8 border border-gray-200 rounded-lg text-[12px] font-medium"
        >
          Aujourd&apos;hui
        </button>
        <button
          type="button"
          onClick={onShowAlerts}
          className="relative w-8 h-8 flex items-center justify-center text-gray-400 flex-shrink-0"
          title="Alertes"
        >
          <Bell size={14} />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-red-500 rounded-full text-white text-[9px] font-black flex items-center justify-center px-0.5">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className="w-8 h-8 flex items-center justify-center text-gray-400 flex-shrink-0"
          title="Aide"
        >
          <HelpCircle size={14} />
        </button>
      </div>

    </div>
  )
}
