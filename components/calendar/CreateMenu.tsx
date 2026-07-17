'use client'

import { useRouter } from 'next/navigation'
import { CalendarPlus, ClipboardList, UserPlus, Wrench, CircleDot, CalendarClock } from 'lucide-react'
import type { EventType } from '@/types/calendar'
import { EVENT_COLORS } from '@/lib/calendar/constants'

interface CreateMenuProps {
  open: boolean
  onClose: () => void
  // Ouvre le tiroir de création avec un type pré-rempli.
  onPickType: (type: EventType) => void
}

// Menu contextuel du bouton "+" : au lieu d'ouvrir un formulaire vide, on propose
// les créations les plus fréquentes. "Nouvelle réservation" part vers le module
// dédié (source de vérité) ; les autres ouvrent le tiroir avec le bon type.
const OPTIONS: { key: string; label: string; sub: string; Icon: typeof ClipboardList; type?: EventType; color: string }[] = [
  { key: 'reservation', label: 'Nouvelle réservation', sub: 'Créer un contrat de location', Icon: CalendarPlus, color: EVENT_COLORS.reservation },
  { key: 'tache',       label: 'Tâche',                sub: 'À faire, rappel, préparation',  Icon: ClipboardList, type: 'tache',        color: EVENT_COLORS.tache },
  { key: 'rdv_client',  label: 'RDV client',           sub: 'Rendez-vous, signature, remise', Icon: UserPlus,     type: 'rdv_client',   color: EVENT_COLORS.rdv_client },
  { key: 'rdv_garage',  label: 'RDV garage',           sub: 'Entretien, réparation',          Icon: Wrench,       type: 'rdv_garage',   color: EVENT_COLORS.rdv_garage },
  { key: 'rdv_autre',   label: 'RDV autre',            sub: 'Autre rendez-vous, titre libre', Icon: CalendarClock, type: 'rdv_autre',   color: EVENT_COLORS.rdv_autre },
  { key: 'disponibilite', label: 'Disponibilité',      sub: 'Créneau collaborateur',          Icon: CircleDot,    type: 'disponibilite', color: '#64748B' },
]

export default function CreateMenu({ open, onClose, onPickType }: CreateMenuProps) {
  const router = useRouter()
  if (!open) return null

  const pick = (opt: (typeof OPTIONS)[number]) => {
    onClose()
    if (opt.type) onPickType(opt.type)
    // from=/calendrier → le bouton retour de la page « Nouvelle réservation »
    // ramène au calendrier (et non à la liste des réservations).
    else router.push('/reservations/new?from=/calendrier')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full md:w-[360px] bg-white rounded-t-2xl md:rounded-2xl shadow-sm border border-gray-100 p-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="md:hidden flex justify-center pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">Créer</p>
        <div className="flex flex-col gap-1">
          {OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => pick(opt)}
              className="flex items-center gap-3 px-2.5 h-14 rounded-xl hover:bg-gray-50 active:scale-[.99] transition text-left"
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${opt.color}1A` }}
              >
                <opt.Icon className="w-[18px] h-[18px]" style={{ color: opt.color }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-gray-900 leading-tight">{opt.label}</span>
                <span className="block text-[12px] text-gray-400 leading-tight">{opt.sub}</span>
              </span>
              <span className="text-gray-300 text-[18px] leading-none">›</span>
            </button>
          ))}
        </div>

        {/* Mobile : dégage la barre de navigation basse (60px + safe-area) pour
            que la dernière option ne soit pas masquée derrière. */}
        <div className="md:hidden" aria-hidden style={{ height: 'calc(60px + env(safe-area-inset-bottom))' }} />
      </div>
    </div>
  )
}
