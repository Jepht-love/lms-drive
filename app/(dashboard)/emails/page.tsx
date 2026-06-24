import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Mail, MailWarning } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  contrat_location: 'Contrat de location',
  contrat_restitution: 'Contrat de restitution',
  facture_restitution: 'Facture de restitution',
  avis_infraction: 'Avis de contravention',
  autre: 'Autre',
}

const TYPES = ['contrat_location', 'contrat_restitution', 'facture_restitution', 'avis_infraction']

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  let query = supabase
    .from('email_logs')
    .select('*, clients(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (type) query = query.eq('type', type)
  const { data: logs } = await query

  const counts: Record<string, number> = {}
  const { data: allLogs } = await supabase.from('email_logs').select('type')
  for (const l of allLogs ?? []) counts[l.type] = (counts[l.type] ?? 0) + 1

  const pill = (active: boolean) =>
    `px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
      active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
    }`

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900">Emails</h1>
        <p className="text-sm text-gray-400 mt-0.5">Historique des envois automatiques (contrats, factures, avis)</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <Link href="/emails" className={pill(!type)}>Tous ({allLogs?.length ?? 0})</Link>
        {TYPES.map(t => (
          <Link key={t} href={`/emails?type=${t}`} className={pill(type === t)}>
            {TYPE_LABELS[t]} ({counts[t] ?? 0})
          </Link>
        ))}
      </div>

      {!logs || logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Mail className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">Aucun email envoyé pour ce filtre</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const c = Array.isArray(log.clients) ? log.clients[0] : log.clients
            const failed = log.status === 'echec'
            return (
              <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {TYPE_LABELS[log.type] ?? log.type}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(log.created_at)}</span>
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
