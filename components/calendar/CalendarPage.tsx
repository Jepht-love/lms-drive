'use client'

import { useCallback, useEffect, useState } from 'react'
import { addDays, addMonths, addWeeks, subDays, subMonths, subWeeks } from 'date-fns'
import type { CalendarEvent, CalendarResource, CalendarView } from '@/types/calendar'
import type { UserRole } from '@/types/database'
import { RESOURCE_PALETTE, UNASSIGNED_RESOURCE_ID } from '@/lib/calendar/constants'
import { getWeekDates, getMonthDates, getColumnWindow } from '@/lib/calendar/dateUtils'
import CalendarSidebar from './CalendarSidebar'
import CalendarGrid from './CalendarGrid'
import MonthView from './MonthView'
import EventDrawer from './EventDrawer'
import AlertPanel from './AlertPanel'
import CalendarBottomBar from './CalendarBottomBar'

interface SlotContext {
  resource: CalendarResource
  date: Date
  hour: number
}

function rangeFor(view: CalendarView, currentDate: Date): [Date, Date] {
  let first: Date
  let last: Date
  if (view === 'day') {
    first = currentDate
    last = currentDate
  } else if (view === 'month') {
    const dates = getMonthDates(currentDate)
    first = dates[0]
    last = dates[dates.length - 1]
  } else {
    const dates = getWeekDates(currentDate, view)
    first = dates[0]
    last = dates[dates.length - 1]
  }
  const start = new Date(first)
  start.setHours(0, 0, 0, 0)
  // Vue mois : journées calendaires simples. Vue jour/semaine : chaque colonne
  // s'étend jusqu'à 3h le lendemain (journée métier) → la plage de fetch doit
  // couvrir cette fin de fenêtre, sinon les événements entre minuit et 3h du
  // dernier jour visible ne seraient jamais récupérés.
  const end = view === 'month'
    ? (() => { const d = new Date(last); d.setHours(23, 59, 59, 999); return d })()
    : getColumnWindow(last).end
  return [start, end]
}

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>('week_5d')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [resources, setResources] = useState<CalendarResource[]>([])
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [slotContext, setSlotContext] = useState<SlotContext | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const [alertCount, setAlertCount] = useState(0)
  const [alertPanelOpen, setAlertPanelOpen] = useState(false)

  const loadResources = useCallback(() => {
    fetch('/api/calendar/resources')
      .then(r => r.json())
      .then((body: { me: { id: string; role: UserRole } | null; resources: any[] }) => {
        setMyRole(body.me?.role ?? null)
        const unassigned: CalendarResource = {
          id: UNASSIGNED_RESOURCE_ID,
          full_name: 'Non assigné',
          role: null,
          type: 'profile',
          color: '#94A3B8',
          visible: false,
        }
        // Vue par défaut : uniquement le planning du gérant — les collaborateurs
        // sont consultés en détail un par un via le clic sur leur nom (voir
        // handleSelectOnlyResource), pas tous affichés simultanément.
        setResources([
          unassigned,
          ...body.resources.map((r, i) => ({
            id: r.id,
            full_name: r.full_name,
            role: r.role,
            type: r.type,
            color: r.color ?? RESOURCE_PALETTE[i % RESOURCE_PALETTE.length],
            visible: r.role === 'gerant',
          })),
        ])
      })
      .catch(() => setResources([]))
  }, [])

  useEffect(() => { loadResources() }, [loadResources])

  const loadEvents = useCallback(() => {
    const [start, end] = rangeFor(view, currentDate)
    setLoading(true)
    fetch(`/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [view, currentDate])

  useEffect(() => { loadEvents() }, [loadEvents])

  const loadAlertCount = useCallback(() => {
    fetch('/api/calendar/alerts?count=true&pending=true')
      .then(r => r.json())
      .then(d => setAlertCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadAlertCount()
    const interval = setInterval(loadAlertCount, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadAlertCount])

  const handleNavigate = (dir: 'prev' | 'next' | 'today') => {
    if (dir === 'today') {
      setCurrentDate(new Date())
      return
    }
    setCurrentDate(d => {
      if (view === 'day') return dir === 'next' ? addDays(d, 1) : subDays(d, 1)
      if (view === 'month') return dir === 'next' ? addMonths(d, 1) : subMonths(d, 1)
      return dir === 'next' ? addWeeks(d, 1) : subWeeks(d, 1)
    })
  }

  const handleToggleResource = (id: string) => {
    setResources(rs => rs.map(r => (r.id === id ? { ...r, visible: !r.visible } : r)))
  }

  // Clic sur le nom d'un collaborateur : vue exclusive (son planning détaillé
  // seul), distincte du clic sur la pastille couleur (ajout/retrait au comparatif).
  const handleSelectOnlyResource = (id: string) => {
    setResources(rs => rs.map(r => ({ ...r, visible: r.id === id })))
  }

  const handleCreateTeam = async (name: string, color: string) => {
    await fetch('/api/calendar/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    loadResources()
  }

  const handleRenameTeam = async (id: string, name: string) => {
    await fetch('/api/calendar/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    })
    loadResources()
  }

  const handleDeleteTeam = async (id: string) => {
    await fetch(`/api/calendar/teams?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    loadResources()
  }

  const handleSlotClick = (resource: CalendarResource, date: Date, hour: number) => {
    setSelectedEvent(null)
    setSlotContext({ resource, date, hour })
    setDrawerOpen(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setSlotContext(null)
    setDrawerOpen(true)
  }

  const handleCreateNew = () => {
    setSelectedEvent(null)
    setSlotContext(null)
    setDrawerOpen(true)
  }

  const handleOpenEventFromAlert = (eventId: string) => {
    const ev = events.find(e => e.id === eventId)
    setAlertPanelOpen(false)
    if (ev) {
      setSelectedEvent(ev)
      setSlotContext(null)
      setDrawerOpen(true)
    }
  }

  const visibleResources = resources.filter(r => r.visible)
  const canManageTeams = myRole === 'gerant' || myRole === 'associe'

  return (
    <div className="flex h-screen overflow-hidden bg-[#F2F2F7]">
      <CalendarSidebar
        currentDate={currentDate}
        onSelectDate={setCurrentDate}
        view={view}
        onViewChange={setView}
        onNavigate={handleNavigate}
        events={events}
        resources={resources}
        onToggleResource={handleToggleResource}
        onSelectOnlyResource={handleSelectOnlyResource}
        onCreateTeam={handleCreateTeam}
        onRenameTeam={handleRenameTeam}
        onDeleteTeam={handleDeleteTeam}
        canManageTeams={canManageTeams}
        alertCount={alertCount}
        onShowAlerts={() => setAlertPanelOpen(true)}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {view === 'month' ? (
          <MonthView
            currentDate={currentDate}
            events={events}
            onEventClick={handleEventClick}
            onDayClick={d => { setCurrentDate(d); setView('day') }}
          />
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-gray-400">
            Chargement…
          </div>
        ) : (
          <CalendarGrid
            view={view}
            currentDate={currentDate}
            resources={visibleResources}
            events={events}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
            onCloseResource={r => handleToggleResource(r.id)}
          />
        )}
      </div>

      <EventDrawer
        open={drawerOpen}
        event={selectedEvent}
        slotContext={slotContext}
        resources={resources}
        onClose={() => setDrawerOpen(false)}
        onSave={() => { loadEvents(); loadAlertCount() }}
        onDelete={() => { loadEvents(); setSelectedEvent(null) }}
      />

      <AlertPanel
        open={alertPanelOpen}
        onClose={() => setAlertPanelOpen(false)}
        onOpenEvent={handleOpenEventFromAlert}
        onDismissed={loadAlertCount}
      />

      <CalendarBottomBar
        events={events}
        onCreateNew={handleCreateNew}
        onPickEvent={handleEventClick}
      />
    </div>
  )
}
