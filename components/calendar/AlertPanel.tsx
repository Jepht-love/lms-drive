'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bell, X } from 'lucide-react'
import type { CalendarAlert } from '@/types/calendar'
import { ALERT_RULES } from '@/lib/calendar/constants'

// Chaque alerte pointe vers l'action qui la résout (EDL, caution, documents…)
// plutôt que d'ouvrir un événement vide : le calendrier devient actionnable.
function alertActionLink(alert: CalendarAlert): { href: string; label: string } | null {
  const ev = alert.event
  if (!ev) return null
  const resa = ev.reservation_id
  const clientId = ev.client_id
  const vehId = ev.vehicles?.[0]?.id ?? ev.vehicle_ids?.[0] ?? null

  switch (alert.alert_type) {
    case 'depart_1h':
    case 'etat_lieux':
      if (resa) return { href: `/inspections/departure/${resa}`, label: "Faire l'EDL" }
      break
    case 'retour_today':
      if (resa) return { href: `/reservations/${resa}`, label: 'Ouvrir la réservation' }
      break
    case 'paiement_caution':
      if (resa) return { href: `/reservations/${resa}`, label: 'Régler la caution' }
      break
    case 'document_manquant':
      if (clientId) return { href: `/clients/${clientId}`, label: 'Compléter les documents' }
      break
    case 'rdv_client_30min':
      if (clientId) return { href: `/clients/${clientId}`, label: 'Fiche client' }
      break
    case 'lavage_prerental':
    case 'rdv_garage_today':
      if (vehId) return { href: `/vehicles/${vehId}`, label: 'Fiche véhicule' }
      break
  }
  if (resa) return { href: `/reservations/${resa}`, label: 'Ouvrir' }
  if (clientId) return { href: `/clients/${clientId}`, label: 'Fiche client' }
  if (vehId) return { href: `/vehicles/${vehId}`, label: 'Fiche véhicule' }
  return null
}

interface AlertPanelProps {
  open: boolean
  onClose: () => void
  onOpenEvent: (eventId: string) => void
  onDismissed: () => void
}

export default function AlertPanel({ open, onClose, onOpenEvent, onDismissed }: AlertPanelProps) {
  const [alerts, setAlerts] = useState<CalendarAlert[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/calendar/alerts?pending=true')
      .then(r => r.json())
      .then(data => setAlerts(Array.isArray(data) ? data : []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  if (!open) return null

  const dismiss = async (id: string) => {
    await fetch(`/api/calendar/alerts/${id}/dismiss`, { method: 'PATCH' })
    setAlerts(a => a.filter(al => al.id !== id))
    onDismissed()
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/10" />
      <div className="absolute top-3 left-3 w-[320px] bg-white rounded-2xl border border-gray-100 shadow-sm p-3 max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Bell size={14} /> Alertes
          </span>
          <button type="button" onClick={onClose}><X size={14} className="text-gray-400" /></button>
        </div>

        {loading && <p className="text-[12px] text-gray-400 px-1 py-2">Chargement…</p>}
        {!loading && alerts.length === 0 && (
          <p className="text-[12px] text-gray-400 px-1 py-2">Aucune alerte en attente.</p>
        )}

        {alerts.map(alert => (
          <div key={alert.id} className="border-b border-gray-50 last:border-0 py-2 px-1">
            <p className="text-[12px] font-medium">{ALERT_RULES[alert.alert_type]?.label ?? alert.alert_type}</p>
            <p className="text-[11px] text-gray-400 mb-1.5">
              {format(new Date(alert.trigger_at), "dd MMM 'à' HH:mm", { locale: fr })}
              {alert.event?.title ? ` — ${alert.event.title}` : ''}
            </p>
            <div className="flex items-center gap-2">
              {(() => {
                const action = alertActionLink(alert)
                return action ? (
                  <Link
                    href={action.href}
                    onClick={onClose}
                    className="text-[11px] font-semibold text-white bg-[#111111] rounded-full px-2.5 h-6 flex items-center"
                  >
                    {action.label}
                  </Link>
                ) : null
              })()}
              {alert.event && (
                <button
                  type="button"
                  onClick={() => onOpenEvent(alert.event!.id)}
                  className="text-[11px] text-gray-500 font-medium"
                >
                  Détails
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(alert.id)}
                className="text-[11px] text-gray-400 ml-auto"
              >
                Ignorer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
