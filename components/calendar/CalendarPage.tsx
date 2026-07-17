'use client'

import { useCallback, useEffect, useState } from 'react'
import { addDays, addMonths, addWeeks, subDays, subMonths, subWeeks } from 'date-fns'
import type { CalendarEvent, CalendarResource, CalendarView, EventType } from '@/types/calendar'
import type { UserRole } from '@/types/database'
import { RESOURCE_PALETTE, UNASSIGNED_RESOURCE_ID } from '@/lib/calendar/constants'
import { getWeekDates, getMonthDates, getColumnWindow } from '@/lib/calendar/dateUtils'
import CalendarSidebar from './CalendarSidebar'
import MobileCalendar from './MobileCalendar'
import MobileCalendarPanel from './MobileCalendarPanel'
import CalendarGrid from './CalendarGrid'
import MonthView from './MonthView'
import DayEventsPanel from './DayEventsPanel'
import EventDrawer, { type CreatePrefill } from './EventDrawer'
import AlertPanel from './AlertPanel'
import CalendarBottomBar from './CalendarBottomBar'
import CreateMenu from './CreateMenu'

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
  const [view, setView] = useState<CalendarView>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [resources, setResources] = useState<CalendarResource[]>([])
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [slotContext, setSlotContext] = useState<SlotContext | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [presetType, setPresetType] = useState<EventType | null>(null)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)

  const [alertCount, setAlertCount] = useState(0)
  const [alertPanelOpen, setAlertPanelOpen] = useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)

  // Ouverture ciblée depuis un lien externe (ex. tableau de bord « À assigner ») :
  //  - /calendrier?event=<id>  → ouvre le tiroir de l'événement existant à affecter
  //  - /calendrier?create=…    → ouvre un tiroir de création pré-rempli (tâche à
  //    assigner) quand l'événement n'existe pas encore
  // Lu une fois au montage via window (évite la contrainte Suspense de
  // useSearchParams), puis l'URL est nettoyée.
  const [pendingEventId, setPendingEventId] = useState<string | null>(null)
  const [createPrefill, setCreatePrefill] = useState<CreatePrefill | null>(null)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const ev = p.get('event')
    if (ev) {
      setPendingEventId(ev)
      window.history.replaceState(null, '', '/calendrier')
      return
    }
    if (p.get('create')) {
      const prefill: CreatePrefill = {
        title: p.get('title') ?? undefined,
        eventType: 'tache',
        start: p.get('date') ?? undefined,
        vehicleIds: p.get('vehicle') ? [p.get('vehicle') as string] : undefined,
        clientId: p.get('client') ?? undefined,
      }
      if (prefill.start) setCurrentDate(new Date(prefill.start))
      setSelectedEvent(null)
      setSlotContext(null)
      setPresetType('tache')
      setCreatePrefill(prefill)
      setDrawerOpen(true)
      window.history.replaceState(null, '', '/calendrier')
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    if (mq.matches) setView('day')
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
      if (e.matches) setView('day')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const loadResources = useCallback(() => {
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
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
        setResources([
          unassigned,
          ...body.resources.map((r, i) => ({
            id: r.id,
            full_name: r.full_name,
            role: r.role,
            type: r.type,
            color: r.color ?? RESOURCE_PALETTE[i % RESOURCE_PALETTE.length],
            // Mobile : tous visibles par défaut. Desktop : seulement le gérant.
            visible: mobile ? true : r.role === 'gerant',
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

  // Quand les événements sont chargés, ouvre le tiroir de l'événement ciblé par
  // /calendrier?event=<id> (assignation depuis le tableau de bord). On cale aussi
  // la date/vue sur ce jour pour qu'il soit visible derrière le tiroir.
  useEffect(() => {
    if (!pendingEventId || events.length === 0) return
    const ev = events.find(e => e.id === pendingEventId)
    if (ev) {
      setCurrentDate(new Date(ev.start_at))
      setSelectedEvent(ev)
      setSlotContext(null)
      setPresetType(null)
      setDrawerOpen(true)
      setPendingEventId(null)
    }
  }, [pendingEventId, events])

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

  const handleSelectAll = () => {
    setResources(rs => rs.map(r => ({ ...r, visible: true })))
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
    setPresetType(null)
    setSlotContext({ resource, date, hour })
    setDrawerOpen(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setPresetType(null)
    setSlotContext(null)
    setDrawerOpen(true)
  }

  // "+" → menu contextuel (Réservation / Tâche / RDV…) plutôt qu'un formulaire vide.
  const handleCreateNew = () => {
    setCreateMenuOpen(true)
  }

  const handlePickCreateType = (type: EventType) => {
    setSelectedEvent(null)
    setSlotContext(null)
    setPresetType(type)
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
    <div className="flex h-full overflow-hidden bg-[#F2F2F7]">
      {!isMobile && (
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
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        {isMobile ? (
          <MobileCalendar
            currentDate={currentDate}
            view={view}
            events={events}
            resources={resources}
            alertCount={alertCount}
            onSelectDate={setCurrentDate}
            onViewChange={setView}
            onToggleResource={handleToggleResource}
            onSelectAll={handleSelectAll}
            onShowAlerts={() => setAlertPanelOpen(true)}
            onCreateNew={handleCreateNew}
            onOpenPanel={() => setMobilePanelOpen(true)}
            onEventClick={handleEventClick}
            onSlotClick={handleSlotClick}
          />
        ) : view === 'month' ? (
          <MonthView
            currentDate={currentDate}
            events={events}
            resources={visibleResources}
            onEventClick={handleEventClick}
            onDayClick={d => { setCurrentDate(d); setView('day') }}
          />
        ) : view === 'day' ? (
          <DayEventsPanel
            currentDate={currentDate}
            events={events}
            resources={visibleResources}
            onEventClick={handleEventClick}
            onBack={() => setView('month')}
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
        presetType={presetType}
        prefill={createPrefill}
        onClose={() => { setDrawerOpen(false); setCreatePrefill(null) }}
        onSave={() => { loadEvents(); loadAlertCount() }}
        onDelete={() => { loadEvents(); setSelectedEvent(null) }}
      />

      <CreateMenu
        open={createMenuOpen}
        onClose={() => setCreateMenuOpen(false)}
        onPickType={handlePickCreateType}
      />

      <AlertPanel
        open={alertPanelOpen}
        onClose={() => setAlertPanelOpen(false)}
        onOpenEvent={handleOpenEventFromAlert}
        onDismissed={loadAlertCount}
      />

      {isMobile && (
        <MobileCalendarPanel
          open={mobilePanelOpen}
          onClose={() => setMobilePanelOpen(false)}
          currentDate={currentDate}
          onSelectDate={setCurrentDate}
          events={events}
          resources={resources}
          onToggleResource={handleToggleResource}
          onSelectOnlyResource={handleSelectOnlyResource}
          canManageTeams={canManageTeams}
          onRenameTeam={handleRenameTeam}
          onDeleteTeam={handleDeleteTeam}
        />
      )}

      {!isMobile && (
        <CalendarBottomBar
          events={events}
          onCreateNew={handleCreateNew}
          onPickEvent={handleEventClick}
        />
      )}
    </div>
  )
}
