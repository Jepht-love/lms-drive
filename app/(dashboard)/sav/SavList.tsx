'use client'

import { useState, useTransition } from 'react'
import { Bug, ExternalLink, Camera } from 'lucide-react'
import { updateSavStatus } from '@/lib/actions/sav'
import { SAV_STATUS_LABELS, type SavStatus, type SavTicket } from '@/lib/sav/admin'
import { useToast } from '@/components/Toast'

type Ticket = SavTicket & { signedUrl: string | null; onTelegram?: boolean }

const STATUS_STYLE: Record<SavStatus, { bg: string; text: string }> = {
  nouveau:  { bg: '#FEE2E2', text: '#B91C1C' },
  en_cours: { bg: '#FEF3C7', text: '#B45309' },
  resolu:   { bg: '#DCFCE7', text: '#15803D' },
}

const FILTERS: { key: SavStatus | 'tous'; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'nouveau', label: 'Nouveaux' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'resolu', label: 'Résolus' },
]

export default function SavList({ tickets }: { tickets: Ticket[] }) {
  const [filter, setFilter] = useState<SavStatus | 'tous'>('tous')
  const [pending, startTransition] = useTransition()
  const { show: toast } = useToast()

  const visible = filter === 'tous' ? tickets : tickets.filter(t => t.status === filter)
  const newCount = tickets.filter(t => t.status === 'nouveau').length

  function setStatus(id: string, status: SavStatus) {
    startTransition(async () => {
      try {
        await updateSavStatus(id, status)
        toast('Statut mis à jour', 'success')
      } catch {
        toast('Mise à jour impossible', 'error')
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto py-2">
      {/* En-tête */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[#111111] flex items-center justify-center">
          <Bug className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#111111] leading-none">SAV — Tickets</h1>
          <p className="text-xs text-gray-400 mt-1">{newCount} nouveau{newCount > 1 ? 'x' : ''} · {tickets.length} au total</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              filter === f.key ? 'bg-[#111111] text-white' : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {visible.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-16">Aucun ticket.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(t => {
            const s = STATUS_STYLE[t.status]
            const context = [t.module, t.section].filter(Boolean).join(' › ') || '—'
            const when = new Date(t.created_at).toLocaleString('fr-FR', {
              day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
            })
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#111111]">{context}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.reporter_name ?? 'Utilisateur'}{t.reporter_role ? ` · ${t.reporter_role}` : ''} · {when}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: s.bg, color: s.text }}>
                    {SAV_STATUS_LABELS[t.status]}
                  </span>
                </div>

                <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.description}</p>

                {t.page_path && (
                  <p className="text-[11px] text-gray-400 mt-2 font-mono">{t.page_path}</p>
                )}

                {t.onTelegram ? (
                  <span className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-gray-400">
                    <Camera size={13} /> Capture envoyée sur Telegram
                  </span>
                ) : t.signedUrl && (
                  <a href={t.signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-[#C4A35A] hover:underline">
                    <ExternalLink size={13} /> Voir la capture
                  </a>
                )}

                {/* Changement de statut */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  {(['nouveau', 'en_cours', 'resolu'] as SavStatus[]).map(st => (
                    <button
                      key={st}
                      disabled={pending || t.status === st}
                      onClick={() => setStatus(t.id, st)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-100 ${
                        t.status === st ? 'bg-[#111111] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-50'
                      }`}
                    >
                      {SAV_STATUS_LABELS[st]}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
