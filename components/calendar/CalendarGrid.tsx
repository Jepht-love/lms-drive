'use client'

import type { CalendarEvent, CalendarResource, CalendarView } from '@/types/calendar'
import { getWeekDates } from '@/lib/calendar/dateUtils'
import { UNASSIGNED_RESOURCE_ID } from '@/lib/calendar/constants'
import ResourceColumn from './ResourceColumn'

interface CalendarGridProps {
  view: Exclude<CalendarView, 'month'>
  currentDate: Date
  resources: CalendarResource[]
  events: CalendarEvent[]
  onEventClick: (e: CalendarEvent) => void
  onSlotClick: (resource: CalendarResource, date: Date, hour: number) => void
  onCloseResource: (resource: CalendarResource) => void
}

export default function CalendarGrid({ view, currentDate, resources, events, onEventClick, onSlotClick, onCloseResource }: CalendarGridProps) {
  const dates = view === 'day' ? [currentDate] : getWeekDates(currentDate, view)
  // Un événement Terminé n'est plus actionnable — la grille ne doit montrer
  // que ce qui reste à faire (l'historique reste consultable depuis la fiche
  // réservation/véhicule concernée, pas depuis le planning).
  const visibleEvents = events.filter(e => e.status !== 'termine')

  return (
    <div className="flex-1 overflow-auto" style={{ paddingBottom: '56px' }}>
      <div className="flex">
        {resources.map(resource => {
          const resourceEvents = resource.id === UNASSIGNED_RESOURCE_ID
            ? visibleEvents.filter(e => !e.assigned_to && !e.assigned_team_id)
            : resource.type === 'team'
              ? visibleEvents.filter(e => e.assigned_team_id === resource.id)
              : visibleEvents.filter(e => e.assigned_to === resource.id)
          return (
            <ResourceColumn
              key={resource.id}
              resource={resource}
              events={resourceEvents}
              dates={dates}
              onEventClick={onEventClick}
              onSlotClick={onSlotClick}
              onClose={onCloseResource}
            />
          )
        })}
        {resources.length === 0 && (
          <div className="flex items-center justify-center text-[13px] text-gray-400 min-w-[400px] p-8">
            Aucun collaborateur sélectionné dans la sidebar.
          </div>
        )}
      </div>
    </div>
  )
}
