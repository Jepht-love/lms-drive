import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ChevronRight, CarFront } from 'lucide-react'
import SmartSearch from '@/components/ui/SmartSearch'
import { formatPrice, formatDate } from '@/lib/utils'
import { SINISTRE_STATUS } from '@/lib/incidents'
import VehicleFilter from '@/components/incidents/VehicleFilter'

/**
 * Onglet « Sinistres » de la page /suivi (ancienne page /incidents/sinistres).
 * Réservé aux managers (le filtrage de rôle est fait en amont dans /suivi).
 */
export default async function SinistresSection({
  status,
  vehicle,
}: {
  status?: string
  vehicle?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('accidents')
    .select('*, vehicles(plate, brand, model), clients(first_name, last_name)')
    .order('accident_date', { ascending: false })
  if (status) query = query.eq('status', status)
  if (vehicle) query = query.eq('vehicle_id', vehicle)

  const [{ data: accidents }, { data: vehicles }] = await Promise.all([
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
      <div className="flex items-center justify-end">
        <Link href="/incidents/sinistres/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors active:scale-[.98]">
          <Plus className="w-4 h-4" /> Déclarer
        </Link>
      </div>

      {/* Recherche */}
      <SmartSearch scope="sinistres" placeholder="Véhicule ou client…" />

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <Link href={`/suivi?tab=sinistres${vehicle ? `&vehicle=${vehicle}` : ''}`} className={pill(!status)}>Tous</Link>
        {Object.entries(SINISTRE_STATUS).map(([s, cfg]) => (
          <Link key={s} href={`/suivi?tab=sinistres&status=${s}${vQ}`} className={pill(status === s)}>{cfg.label}</Link>
        ))}
      </div>

      <VehicleFilter vehicles={vehicles ?? []} />

      {!accidents || accidents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <CarFront className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">Aucun sinistre</p>
          <Link href="/incidents/sinistres/new" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">
            Déclarer un sinistre →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {accidents.map(acc => {
            const v = Array.isArray(acc.vehicles) ? acc.vehicles[0] : acc.vehicles
            const c = Array.isArray(acc.clients) ? acc.clients[0] : acc.clients
            const st = SINISTRE_STATUS[acc.status] ?? SINISTRE_STATUS.declare
            return (
              <Link key={acc.id} href={`/incidents/sinistres/${acc.id}`} className="block">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all active:scale-[.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                        <span className="text-sm font-black text-gray-900">{v ? `${v.brand} ${v.model}` : '—'}</span>
                        {v?.plate && <span className="text-xs font-mono text-gray-400">{v.plate}</span>}
                      </div>
                      <p className="text-sm text-gray-700 truncate">{acc.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(acc.accident_date)}
                        {c ? ` · ${c.first_name} ${c.last_name}` : ' · Utilisation interne'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {acc.repair_cost > 0 && <p className="text-sm font-black text-gray-900">{formatPrice(acc.repair_cost)}</p>}
                      {acc.deposit_retained > 0 && <p className="text-[11px] text-orange-500 font-semibold">caution {formatPrice(acc.deposit_retained)}</p>}
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
