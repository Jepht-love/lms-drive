'use client'

import Link from 'next/link'
import { X, Clock } from 'lucide-react'
import type { CalendarEvent, CalendarResource } from '@/types/calendar'
import MiniCalendar from './MiniCalendar'
import ResourceList from './ResourceList'

// Version mobile de la barre latérale du calendrier (`CalendarSidebar`).
// Sur grand écran, ce panneau (mini-calendrier des dates + choix des
// calendriers à afficher + lien Disponibilités) est toujours visible à gauche.
// En dessous de md (≤ 767 px), l'app bascule sur `MobileCalendar` qui n'a pas
// de barre latérale → ce drawer coulissant ramène les mêmes éléments,
// déclenché par le bouton « Calendriers ». `md:hidden` : jamais rendu sur
// desktop, aucun impact sur la vue actuelle qui fonctionne.
interface MobileCalendarPanelProps {
  open: boolean
  onClose: () => void
  currentDate: Date
  onSelectDate: (d: Date) => void
  events: CalendarEvent[]
  resources: CalendarResource[]
  onToggleResource: (id: string) => void
  onSelectOnlyResource: (id: string) => void
  canManageTeams: boolean
  onRenameTeam: (id: string, name: string) => void
  onDeleteTeam: (id: string) => void
}

export default function MobileCalendarPanel({
  open, onClose, currentDate, onSelectDate, events,
  resources, onToggleResource, onSelectOnlyResource,
  canManageTeams, onRenameTeam, onDeleteTeam,
}: MobileCalendarPanelProps) {
  return (
    <>
      {/* Fond semi-transparent — clic = fermer */}
      <div
        className={[
          'fixed inset-0 z-40 bg-black/30 transition-opacity md:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden={!open}
      />

      {/* Panneau coulissant depuis la gauche */}
      <div
        className={[
          'fixed top-0 left-0 z-50 h-full w-[280px] max-w-[85vw] bg-white shadow-xl',
          'flex flex-col overflow-y-auto transition-transform md:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        role="dialog"
        aria-label="Options du calendrier"
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Calendrier
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pb-4">
          <MiniCalendar
            selectedDate={currentDate}
            onSelectDate={(d) => { onSelectDate(d); onClose() }}
            events={events}
          />

          <Link
            href="/calendrier/disponibilites"
            onClick={onClose}
            className="flex items-center gap-1.5 px-2 py-2 mt-2 rounded-xl text-[12px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Clock size={14} /> Disponibilités
          </Link>

          <hr className="border-gray-100 my-3" />

          <span className="block px-1 mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Collaborateurs
          </span>
          <ResourceList
            resources={resources}
            onToggle={onToggleResource}
            onSelectOnly={(id) => { onSelectOnlyResource(id); onClose() }}
            canManageTeams={canManageTeams}
            onRenameTeam={onRenameTeam}
            onDeleteTeam={onDeleteTeam}
          />
        </div>
      </div>
    </>
  )
}
