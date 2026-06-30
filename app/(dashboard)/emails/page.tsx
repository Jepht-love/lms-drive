import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EmailsList from './EmailsList'

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
    .select('*, clients(first_name, last_name), sender:profiles!sent_by(full_name)')
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

      <EmailsList logs={logs ?? []} />
    </div>
  )
}
