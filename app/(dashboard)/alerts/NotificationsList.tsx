'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelative } from '@/lib/utils'
import { Bell, Clock, AlertTriangle, Wrench, FileText, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import type { Notification } from '@/types/database'
import { useToast } from '@/components/Toast'

const ICONS: Record<string, React.ElementType> = {
  departure_soon: Clock,
  return_late: AlertTriangle,
  maintenance_due: Wrench,
  contract_unsigned: FileText,
  incident_open: AlertTriangle,
}

const COLORS: Record<string, string> = {
  departure_soon: 'bg-blue-50 text-blue-600',
  return_late: 'bg-red-50 text-red-600',
  maintenance_due: 'bg-yellow-50 text-yellow-600',
  contract_unsigned: 'bg-amber-50 text-amber-600',
  incident_open: 'bg-orange-50 text-orange-600',
}

function entityLink(n: Notification): string {
  if (!n.entity_type || !n.entity_id) return '#'
  const map: Record<string, string> = {
    reservations: `/reservations/${n.entity_id}`,
    contracts: `/contracts/${n.entity_id}`,
    vehicles: `/vehicles/${n.entity_id}`,
    incidents: `/incidents`,
  }
  return map[n.entity_type] ?? '#'
}

export default function NotificationsList({ initialNotifications }: { initialNotifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const supabase = createClient()
  const { show: toast } = useToast()

  useEffect(() => {
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    toast(`${unreadIds.length} notification${unreadIds.length > 1 ? 's' : ''} marquée${unreadIds.length > 1 ? 's' : ''} comme lue${unreadIds.length > 1 ? 's' : ''}`)
  }

  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
        <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Aucune notification</p>
      </div>
    )
  }

  const hasUnread = notifications.some(n => !n.is_read)

  return (
    <div className="space-y-3">
      {hasUnread && (
        <button
          onClick={markAllRead}
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline ml-auto"
        >
          <CheckCheck className="w-4 h-4" /> Tout marquer comme lu
        </button>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
        {notifications.map(n => {
          const Icon = ICONS[n.type] ?? Bell
          const color = COLORS[n.type] ?? 'bg-slate-50 text-slate-600'
          return (
            <Link
              key={n.id}
              href={entityLink(n)}
              onClick={() => !n.is_read && markAsRead(n.id)}
              className={`flex items-start gap-3 px-4 py-4 hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-blue-50/30' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 text-sm">{n.title}</p>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                </div>
                {n.body && <p className="text-sm text-slate-500 mt-0.5">{n.body}</p>}
                <p className="text-xs text-slate-400 mt-1">{formatRelative(n.created_at)}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
