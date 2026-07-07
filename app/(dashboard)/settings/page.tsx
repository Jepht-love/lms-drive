import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Settings, Users, FileClock, Building2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { getAgencySettings } from '@/lib/contracts/agency'
import AgencySettingsForm from './AgencySettingsForm'
import AuditLogList from './AuditLogList'
import NotificationSettings from '@/components/settings/NotificationSettings'
import { roleLabel } from '@/lib/roles'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  // Gerant only
  if (profile?.role !== 'gerant') redirect('/')

  const [{ data: profiles }, { data: auditLogs }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('audit_logs').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(100),
  ])

  const agency = await getAgencySettings(supabase)

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors mb-4">
        <ArrowLeft className="w-4 h-4" /> Retour
      </Link>

      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-gray-700" />
        <div>
          <h1 className="text-xl font-black text-gray-900">Paramètres</h1>
          <p className="text-gray-500 mt-0.5">Administration — Gérant uniquement</p>
        </div>
      </div>

      {/* Informations agence */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Informations agence
        </h3>
        <AgencySettingsForm settings={agency} />
      </div>

      {/* Team */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" /> Équipe ({profiles?.length ?? 0})
        </h3>
        <div className="space-y-2">
          {profiles?.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-700 font-bold text-sm">{(p.full_name ?? '?').charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{p.full_name}</p>
                {p.phone && <p className="text-xs text-gray-400">{p.phone}</p>}
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                p.role === 'gerant' ? 'bg-purple-100 text-purple-700' :
                p.role === 'associe' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {roleLabel(p.role)}
              </span>
              {!p.is_active && <span className="text-xs text-red-500">Inactif</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Notifications push */}
      <NotificationSettings />

      {/* Journal d'audit — français lisible, filtrable par employé */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FileClock className="w-4 h-4" /> Journal d'audit
        </h3>
        <AuditLogList logs={auditLogs ?? []} profiles={profiles ?? []} />
      </div>
    </div>
  )
}
