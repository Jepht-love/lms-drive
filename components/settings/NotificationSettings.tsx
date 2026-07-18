'use client'

import { useEffect, useState } from 'react'
import { Bell, Clock, AlertTriangle } from 'lucide-react'
import UiToggle from '@/components/ui/Toggle'
import {
  NOTIFICATION_TYPES, NOTIFICATION_DEFAULTS, type NotificationType,
} from '@/lib/push/notificationTypes'

type Settings = Record<NotificationType, boolean> & {
  alert_window_start: number
  alert_window_end: number
  late_return_threshold_minutes: number
}

const DEFAULTS: Settings = {
  ...NOTIFICATION_DEFAULTS,
  alert_window_start: 7,
  alert_window_end: 22,
  late_return_threshold_minutes: 30,
}

// Catégories dans l'ordre du catalogue, sans doublon.
const CATEGORIES = NOTIFICATION_TYPES.reduce<string[]>((acc, t) => {
  if (!acc.includes(t.category)) acc.push(t.category)
  return acc
}, [])

export default function NotificationSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then(r => r.json())
      .then(d => setSettings({ ...DEFAULTS, ...d }))
      .catch(() => {})
  }, [])

  async function save(patch: Partial<Settings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Types d'alertes, groupés par catégorie */}
      {CATEGORIES.map(cat => (
        <div key={cat} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4" /> {cat}
          </h3>
          {NOTIFICATION_TYPES.filter(t => t.category === cat).map(t => (
            <div key={t.key} className="py-2.5 border-b border-gray-50 last:border-0">
              <UiToggle
                label={t.label}
                checked={settings[t.key]}
                onChange={v => save({ [t.key]: v } as Partial<Settings>)}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Fenêtre horaire */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Fenêtre de réception
        </h3>
        <p className="text-xs text-gray-400 mb-3">Aucune notification ne sera envoyée en dehors de cette plage horaire.</p>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">De</label>
            <select
              value={settings.alert_window_start}
              onChange={e => save({ alert_window_start: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">À</label>
            <select
              value={settings.alert_window_end}
              onChange={e => save({ alert_window_end: Number(e.target.value) })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Seuil retard */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Seuil retour en retard
        </h3>
        <p className="text-xs text-gray-400 mb-3">Délai après lequel un retour non effectué déclenche une alerte.</p>
        <select
          value={settings.late_return_threshold_minutes}
          onChange={e => save({ late_return_threshold_minutes: Number(e.target.value) })}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
        >
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>1 heure</option>
          <option value={120}>2 heures</option>
        </select>
      </div>

      {saving && <p className="text-xs text-gray-400 text-center">Enregistrement…</p>}
      {saved && <p className="text-xs text-green-600 text-center font-medium">Paramètres sauvegardés ✓</p>}
    </div>
  )
}
