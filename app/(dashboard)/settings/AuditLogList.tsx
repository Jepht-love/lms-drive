'use client'

import { useMemo, useState } from 'react'
import { Shield } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { auditActionLabel, auditActionTone, formatAuditDetail, type AuditTone } from '@/lib/audit/format'

interface AuditLog {
  id: string
  action: string
  entity_type: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  user_id: string | null
  user?: { full_name: string } | { full_name: string }[] | null
}
interface Profile { id: string; full_name: string }

const TONE_DOT: Record<AuditTone, string> = {
  create:  'bg-green-500',
  update:  'bg-blue-500',
  delete:  'bg-red-500',
  payment: 'bg-emerald-500',
  send:    'bg-indigo-500',
  status:  'bg-amber-500',
  neutral: 'bg-gray-300',
}

const userName = (log: AuditLog) => {
  const u = Array.isArray(log.user) ? log.user[0] : log.user
  return u?.full_name ?? 'Système'
}

export default function AuditLogList({ logs, profiles }: { logs: AuditLog[]; profiles: Profile[] }) {
  const [userId, setUserId] = useState<string>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return logs.filter(log => {
      if (userId !== 'all' && log.user_id !== userId) return false
      if (!q) return true
      const hay = `${auditActionLabel(log.action)} ${formatAuditDetail(log)} ${userName(log)}`.toLowerCase()
      return hay.includes(q)
    })
  }, [logs, userId, query])

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={userId}
          onChange={e => setUserId(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-gray-400 bg-white"
        >
          <option value="all">Tous les utilisateurs</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher (action, client, véhicule…)"
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-gray-400"
        />
      </div>

      <p className="text-xs text-gray-400">{filtered.length} action{filtered.length > 1 ? 's' : ''}</p>

      <div className="space-y-1 max-h-[28rem] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Aucune action ne correspond</p>
        ) : (
          filtered.map(log => {
            const tone = auditActionTone(log.action)
            const detail = formatAuditDetail(log)
            return (
              <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${TONE_DOT[tone]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{auditActionLabel(log.action)}</p>
                  {detail && <p className="text-xs text-gray-500 truncate">{detail}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-gray-300" /> {userName(log)} · {formatDateTime(log.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
