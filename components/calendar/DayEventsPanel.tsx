'use client'

import { format, isSameDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import type { CalendarEvent, CalendarResource, EventType } from '@/types/calendar'
import { EVENT_COLORS, EVENT_TYPE_LABELS, EVENT_STATUS_LABELS ,
  couleurEvenement,
} from '@/lib/calendar/constants'
import { roleLabel } from '@/lib/roles'

interface Props {
  currentDate: Date
  events: CalendarEvent[]
  resources: CalendarResource[]
  onEventClick: (e: CalendarEvent) => void
  onBack: () => void
  /** Masque la ligne de date : sur téléphone elle est déjà dans l.en-tête. */
  hideHeader?: boolean
}

// Les types d'évènement qui attendent quelqu'un. Un blocage ou une indisponibilité
// n'est porté par personne : lui écrire « Non attribué » serait un faux manque.
// Même liste que la vue semaine du tableau de bord, à garder identique.
const ASSIGNABLE: EventType[] = [
  'depart_vehicule', 'retour_vehicule', 'tache',
  'rdv_client', 'rdv_garage', 'rdv_autre', 'livraison', 'recuperation',
]

export default function DayEventsPanel({ currentDate, events, resources, onEventClick, onBack, hideHeader = false }: Props) {
  const dayEvents = events
    .filter(e => isSameDay(new Date(e.start_at), currentDate))
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  const resourceMap = new Map(resources.map(r => [r.id, r]))

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#F2F2F7]">
      {/* Header */}
      {/* Une seule ligne, compacte : ces bandeaux mangeaient la moitié de l'écran
          du téléphone et il ne restait presque rien pour les tâches (remarque 32
          de Jeff, 01/08/2026).

          Sur téléphone, cette ligne ne s'affiche pas du tout (`hideHeader`) : la
          date est déjà dans l'en-tête du calendrier juste au-dessus, la répéter
          coûtait un bandeau pour rien. */}
      {!hideHeader && (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-white border-b border-gray-100">
        <button type="button" aria-label="Retour"
          onClick={onBack}
          className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <p className="text-[13px] font-bold text-gray-900 capitalize">
          {format(currentDate, 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
      </div>
      )}

      {/* Event list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 font-medium">Aucun événement ce jour</p>
          </div>
        ) : (
          dayEvents.map(ev => {
            const color = couleurEvenement(ev)
            const assignee = ev.assigned_to ? resourceMap.get(ev.assigned_to) : null
            const startTime = format(new Date(ev.start_at), 'HH:mm')
            const endTime = format(new Date(ev.end_at), 'HH:mm')

            return (
              <button
                key={ev.id}
                type="button"
                aria-label={`${ev.title}, de ${startTime} à ${endTime}`}
                onClick={() => onEventClick(ev)}
                className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow active:scale-[.99]"
              >
                <div className="flex items-stretch gap-0">
                  {/* Color bar */}
                  <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ backgroundColor: color }} />

                  <div className="flex-1 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{ev.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {ev.vehicles.map(v => `${v.brand} ${v.model} · ${v.plate}`).join(', ')}
                          </p>
                        )}
                        {ev.client && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {ev.client.first_name} {ev.client.last_name}
                          </p>
                        )}
                        {/* Qui porte la tâche, sur sa propre ligne et avec son poste :
                            sans le poste, un nom collé à celui du client ne disait pas
                            lequel des deux était le salarié (remarque 19 de Jeff, point
                            4, corrigée le 30/07/2026). Personne dessus se dit en gras,
                            c'est une action à prendre, pas une information. */}
                        {assignee ? (
                          // Le nom porte la COULEUR DE CALENDRIER de la personne
                          // (01/08/2026, remarque 31 de Jeff) : sur une journée à dix
                          // tâches, on repère d'un coup d'œil qui a quoi sans lire
                          // chaque ligne. Le poste reste en gris, il n'identifie personne.
                          <p className="text-xs mt-0.5 truncate font-semibold" style={{ color: assignee.color }}>
                            {assignee.full_name}
                            {assignee.role && (
                              <span className="text-gray-400 font-normal"> · {roleLabel(assignee.role)}</span>
                            )}
                          </p>
                        ) : ASSIGNABLE.includes(ev.event_type) && !ev.assigned_team_id ? (
                          // Noir, comme la pastille de filtre « Non attribué »
                          // (remarque 33 de Jeff, 01/08/2026). Aucun profil ne peut
                          // prendre cette couleur : voir RESOURCE_PALETTE.
                          <p className="text-xs font-bold text-[#111111] mt-0.5 truncate">
                            Non attribué
                          </p>
                        ) : null}
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
