'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Settings, X, Clock } from 'lucide-react'
import type { CalendarEvent, CalendarResource, CalendarView } from '@/types/calendar'
import { RESOURCE_PALETTE } from '@/lib/calendar/constants'
import MiniCalendar from './MiniCalendar'
import ResourceList from './ResourceList'
import CalendarToolbar from './CalendarToolbar'

interface CalendarSidebarProps {
  currentDate: Date
  onSelectDate: (date: Date) => void
  view: CalendarView
  onViewChange: (v: CalendarView) => void
  onNavigate: (dir: 'prev' | 'next' | 'today') => void
  events: CalendarEvent[]
  resources: CalendarResource[]
  onToggleResource: (id: string) => void
  onCreateTeam: (name: string, color: string) => void
  canManageTeams: boolean
  alertCount: number
  onShowAlerts: () => void
}

export default function CalendarSidebar({
  currentDate, onSelectDate, view, onViewChange, onNavigate, events,
  resources, onToggleResource, onCreateTeam, canManageTeams, alertCount, onShowAlerts,
}: CalendarSidebarProps) {
  const [addingTeam, setAddingTeam] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamColor, setTeamColor] = useState(RESOURCE_PALETTE[0])

  const submitTeam = () => {
    if (!teamName.trim()) return
    onCreateTeam(teamName.trim(), teamColor)
    setTeamName('')
    setAddingTeam(false)
  }

  return (
    <div className="hidden md:flex md:flex-col w-[220px] bg-white border-r border-gray-100 h-screen overflow-y-auto flex-shrink-0 p-3">
      <CalendarToolbar
        currentDate={currentDate} view={view} onViewChange={onViewChange} onNavigate={onNavigate}
        alertCount={alertCount} onShowAlerts={onShowAlerts}
      />

      <MiniCalendar selectedDate={currentDate} onSelectDate={onSelectDate} events={events} />

      <Link
        href="/calendrier/disponibilites"
        className="flex items-center gap-1.5 px-2 py-2 mt-2 rounded-xl text-[11px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <Clock size={13} /> Disponibilités
      </Link>

      <hr className="border-gray-100 my-3" />

      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          Collaborateurs
        </span>
        {canManageTeams && (
          <button type="button" onClick={() => setAddingTeam(v => !v)} title="Créer une équipe">
            <Settings size={14} className="text-gray-400" />
          </button>
        )}
      </div>

      {addingTeam && (
        <div className="border border-gray-100 rounded-lg p-2 mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold">Nouvelle équipe</span>
            <button type="button" onClick={() => setAddingTeam(false)}><X size={12} className="text-gray-400" /></button>
          </div>
          <input
            type="text"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="Ex : Équipe 1"
            className="w-full border border-gray-200 rounded-lg px-2 h-8 text-[12px] mb-1.5"
          />
          <div className="flex items-center gap-1 mb-1.5">
            {RESOURCE_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setTeamColor(c)}
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: c, boxShadow: teamColor === c ? `0 0 0 2px white, 0 0 0 3px ${c}` : 'none' }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={submitTeam}
            className="w-full h-7 bg-[#111111] text-white rounded-lg text-[11px] font-medium"
          >
            Créer
          </button>
        </div>
      )}

      <ResourceList resources={resources} onToggle={onToggleResource} />
    </div>
  )
}
