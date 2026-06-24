'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Bell, X } from 'lucide-react'
import type { CalendarAlert } from '@/types/calendar'
import { ALERT_RULES } from '@/lib/calendar/constants'

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
            <div className="flex gap-2">
              {alert.event && (
                <button
                  type="button"
                  onClick={() => onOpenEvent(alert.event!.id)}
                  className="text-[11px] text-[#111111] font-medium"
                >
                  Voir l&apos;événement
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(alert.id)}
                className="text-[11px] text-gray-400"
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
