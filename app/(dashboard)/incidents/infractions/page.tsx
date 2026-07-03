import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Plus, ChevronRight, FileWarning } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice, formatDate } from '@/lib/utils'
import { INFRACTION_STATUS, infractionTypeLabel } from '@/lib/incidents'
import VehicleFilter from '@/components/incidents/VehicleFilter'

export default async function InfractionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vehicle?: string }>
}) {
  const { status, vehicle } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  if (!profile || !['gerant', 'associe'].includes(profile.role)) redirect('/')

  let query = supabase
    .from('infractions')
    .select('*, vehicles(plate, brand, model), clients(first_name, last_name)')
    .order('infraction_date', { ascending: false })
  if (status) query = query.eq('status', status)
  if (vehicle) query = query.eq('vehicle_id', vehicle)

  const [{ data: infractions }, { data: vehicles }] = await Promise.all([
    query,
    supabase.from('vehicles').select('id, plate, brand, model').eq('is_active', true).order('brand'),
  ])

  const vQ = vehicle ? `&vehicle=${vehicle}` : ''
  const pill = (active: boolean) =>
    `px-3.5 py-2 min-h-[44px] flex items-center rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
      active ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
    }`

  return (
    <div className="space-y-4">
      <BackButton fallbackHref="/incidents" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Incidents
      </BackButton>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">Infractions</h1>
        <Link href="/incidents/infractions/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors active:scale-[.98]">
          <Plus className="w-4 h-4" /> Déclarer
        </Link>
      </div>

      {/* Filtres statut */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <Link href={`/incidents/infractions${vehicle ? `?vehicle=${vehicle}` : ''}`} className={pill(!status)}>Tous</Link>
        {Object.entries(INFRACTION_STATUS).map(([s, cfg]) => (
          <Link key={s} href={`/incidents/infractions?status=${s}${vQ}`} className={pill(status === s)}>{cfg.label}</Link>
        ))}
      </div>

      {/* Filtre véhicule */}
      <VehicleFilter vehicles={vehicles ?? []} />

      {/* Liste */}
      {!infractions || infractions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <FileWarning className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">Aucune infraction</p>
          <Link href="/incidents/infractions/new" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
            Déclarer une infraction →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {infractions.map(inf => {
            const v = Array.isArray(inf.vehicles) ? inf.vehicles[0] : inf.vehicles
            const c = Array.isArray(inf.clients) ? inf.clients[0] : inf.clients
            const st = INFRACTION_STATUS[inf.status] ?? INFRACTION_STATUS.en_attente
            return (
              <Link key={inf.id} href={`/incidents/infractions/${inf.id}`} className="block">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all active:scale-[.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                        <span className="text-sm font-black text-gray-900">{v ? `${v.brand} ${v.model}` : '—'}</span>
                        {v?.plate && <span className="text-xs font-mono text-gray-400">{v.plate}</span>}
                      </div>
                      <p className="text-sm text-gray-700">{infractionTypeLabel(inf.type)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(inf.infraction_date)}
                        {c ? ` · ${c.first_name} ${c.last_name}` : ' · Utilisation interne'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-gray-900">{formatPrice(inf.amount)}</p>
                      <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-1" />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
