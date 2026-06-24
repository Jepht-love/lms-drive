'use client'

import type { CSSProperties } from 'react'
import { CheckCircle2, X, Clock, User } from 'lucide-react'
import type { CalendarEvent } from '@/types/calendar'
import { EVENT_COLORS } from '@/lib/calendar/constants'

interface EventBlockProps {
  event: CalendarEvent
  top: number
  height: number
  width?: string
  left?: string
  onClick: (event: CalendarEvent) => void
}

const STATUS_ICON = {
  termine: CheckCircle2,
  annule: X,
  en_cours: Clock,
} as const

export default function EventBlock({ event, top, height, width, left, onClick }: EventBlockProps) {
  const fullColor = event.color_override ?? EVENT_COLORS[event.event_type]
  const isDisponibilite = event.event_type === 'disponibilite'
  const textColor = isDisponibilite ? '#64748B' : 'white'
  // Départ/retour synchronisés : le titre contient déjà le modèle du véhicule
  // (ex. "Départ — BMW Série 1 Blanc") → pas besoin de répéter la plaque en
  // sous-titre, ça fait doublon. Les autres types d'événements gardent
  // plaque/nom client en sous-titre, utile quand le titre ne les mentionne pas.
  const isVehicleSync = event.event_type === 'depart_vehicule' || event.event_type === 'retour_vehicule'
  const subtitle = isVehicleSync
    ? null
    : (event.vehicles && event.vehicles.length > 0)
      ? event.vehicles.map(v => `${v.brand} ${v.model}`).join(', ')
      : (event.client ? `${event.client.first_name} ${event.client.last_name}` : null)

  // Fond plein (pas de translucide) — calé sur l'exemple visuel fourni par l'utilisateur.
  const lightBg = `${fullColor}40`

  const statusStyle: CSSProperties = (() => {
    switch (event.status) {
      case 'en_cours':
        return { boxShadow: `0 0 0 2px ${fullColor}`, backgroundColor: fullColor }
      case 'termine':
        return { opacity: 0.7, backgroundColor: fullColor }
      case 'reporte':
        return { border: `2px dashed ${fullColor}`, backgroundColor: lightBg }
      case 'annule':
        return {
          opacity: 0.5,
          backgroundColor: fullColor,
          backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 8px)',
        }
      default:
        return { backgroundColor: fullColor }
    }
  })()

  const Icon = STATUS_ICON[event.status as keyof typeof STATUS_ICON]

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className="absolute rounded-md px-2 py-1.5 overflow-hidden text-left"
      style={{
        position: 'absolute',
        top: `${top}px`,
        height: `${height}px`,
        width: width ?? '92%',
        left: left ?? '4%',
        ...statusStyle,
      }}
    >
      <p
        className="text-[12px] font-bold leading-snug line-clamp-2"
        style={{ color: textColor, textDecoration: event.status === 'annule' ? 'line-through' : 'none' }}
      >
        {event.title}
      </p>
      {subtitle && (
        <p
          className="text-[10px] truncate flex items-center gap-1"
          style={{ color: isDisponibilite ? '#64748B' : 'rgba(255,255,255,0.85)' }}
        >
          {event.client && <User size={9} className="flex-shrink-0" />}
          {subtitle}
        </p>
      )}
      {Icon && (
        <Icon size={12} className="absolute bottom-1 right-1" style={{ color: isDisponibilite ? '#64748B' : 'white' }} />
      )}
    </button>
  )
}
