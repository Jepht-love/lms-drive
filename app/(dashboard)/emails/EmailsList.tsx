'use client'

import { useState } from 'react'
import { Mail, MailWarning, ChevronDown, User, Clock, AtSign, FileText } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  contrat_location: 'Contrat de location',
  contrat_restitution: 'Contrat de restitution',
  facture_restitution: 'Facture de restitution',
  avis_infraction: 'Avis de contravention',
  autre: 'Autre',
}

// Les corps d'email ne sont pas stockés (ce sont des modèles) : on décrit ce que
// l'email contenait selon son type, le PDF étant en pièce jointe quand il y en a.
const TYPE_CONTENT: Record<string, string> = {
  contrat_location: 'Transmission du contrat de location au client, avec le PDF du contrat en pièce jointe.',
  contrat_restitution: 'Transmission du contrat de restitution au client, avec le PDF en pièce jointe.',
  facture_restitution: 'Transmission de la facture de restitution au client (frais complémentaires constatés au retour), PDF en pièce jointe.',
  avis_infraction: "Transmission de l'avis de contravention au client identifié comme conducteur au moment de l'infraction.",
  autre: 'Email envoyé au client.',
}

interface EmailLog {
  id: string
  type: string
  recipient: string
  subject: string
  status: string
  error: string | null
  created_at: string
  clients?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  sender?: { full_name: string } | { full_name: string }[] | null
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export default function EmailsList({ logs }: { logs: EmailLog[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
        <Mail className="w-12 h-12 text-gray-200 mx-auto mb-4" />
        <p className="text-gray-400 font-medium text-sm">Aucun email envoyé pour ce filtre</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {logs.map(log => {
        const c = one(log.clients)
        const sender = one(log.sender)
        const failed = log.status === 'echec'
        const open = openId === log.id
        return (
          <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenId(open ? null : log.id)}
              className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {TYPE_LABELS[log.type] ?? log.type}
                </span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-gray-400">{formatDateTime(log.created_at)}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900 truncate">{log.subject}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {c ? `${c.first_name} ${c.last_name} — ` : ''}{log.recipient}
              </p>
              {failed && (
                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                  <MailWarning className="w-3.5 h-3.5" /> Échec d'envoi{log.error ? ` — ${log.error}` : ''}
                </p>
              )}
            </button>

            {open && (
              <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-2.5">
                <Detail icon={AtSign} label="Destinataire" value={`${c ? `${c.first_name} ${c.last_name} · ` : ''}${log.recipient}`} />
                <Detail icon={FileText} label="Objet" value={log.subject} />
                <Detail icon={Clock} label="Envoyé le" value={formatDateTime(log.created_at)} />
                <Detail icon={User} label="Envoyé par" value={sender?.full_name ?? 'Système'} />
                <Detail
                  icon={failed ? MailWarning : Mail}
                  label="Statut"
                  value={failed ? `Échec${log.error ? ` — ${log.error}` : ''}` : 'Envoyé avec succès'}
                  valueClass={failed ? 'text-red-600' : 'text-emerald-600'}
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Contenu</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{TYPE_CONTENT[log.type] ?? TYPE_CONTENT.autre}</p>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Detail({ icon: Icon, label, value, valueClass = 'text-gray-800' }: {
  icon: typeof Mail; label: string; value: string; valueClass?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
        <p className={`text-sm ${valueClass} break-words`}>{value}</p>
      </div>
    </div>
  )
}
