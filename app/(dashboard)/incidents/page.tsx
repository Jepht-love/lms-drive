import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, FileWarning, CarFront } from 'lucide-react'

export default async function IncidentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user?.id).single()

  // Accès managers uniquement
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  // Compteurs (les tables peuvent être vides ; retournent 0 si absentes)
  const [openInfractions, urgentInfractions, openSinistres] = await Promise.all([
    supabase.from('infractions').select('*', { count: 'exact', head: true })
      .not('status', 'in', '(regle,cloture)').then(r => r.count ?? 0),
    supabase.from('infractions').select('*', { count: 'exact', head: true })
      .eq('status', 'en_attente').then(r => r.count ?? 0),
    supabase.from('accidents').select('*', { count: 'exact', head: true })
      .neq('status', 'cloture').then(r => r.count ?? 0),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900">Incidents</h1>
        <p className="text-sm text-gray-400 mt-0.5">Infractions routières & sinistres</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Infractions */}
        <Link href="/incidents/infractions" className="block">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all active:scale-[.99] h-full">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Infractions</p>
              <FileWarning className="w-4 h-4 text-gray-300" />
            </div>
            <p className="text-4xl font-black text-[#111111] leading-none">{openInfractions}</p>
            <p className="text-xs text-gray-400 mt-1.5">en cours</p>
            {urgentInfractions > 0 && (
              <p className="text-[11px] text-red-500 font-semibold mt-1.5">{urgentInfractions} non transmise(s)</p>
            )}
          </div>
        </Link>

        {/* Sinistres */}
        <Link href="/incidents/sinistres" className="block">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all active:scale-[.99] h-full">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Sinistres</p>
              <CarFront className="w-4 h-4 text-gray-300" />
            </div>
            <p className="text-4xl font-black text-[#111111] leading-none">{openSinistres}</p>
            <p className="text-xs text-gray-400 mt-1.5">en cours</p>
          </div>
        </Link>
      </div>

      {/* Accès rapides */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <Link href="/incidents/infractions/new" className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50">
          <FileWarning className="w-4 h-4 text-gray-400" />
          <span className="flex-1 text-sm font-medium text-gray-900">Déclarer une infraction</span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </Link>
        <Link href="/incidents/sinistres/new" className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
          <CarFront className="w-4 h-4 text-gray-400" />
          <span className="flex-1 text-sm font-medium text-gray-900">Déclarer un sinistre</span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </Link>
      </div>
    </div>
  )
}
