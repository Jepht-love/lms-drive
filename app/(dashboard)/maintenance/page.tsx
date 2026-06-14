import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Wrench, ChevronRight } from 'lucide-react'
import { formatPrice, formatDate } from '@/lib/utils'
import { maintenanceType } from '@/lib/maintenance'

export default async function MaintenancePage() {
  const supabase = await createClient()

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, status, current_km, next_service_km, next_service_date')
    .eq('is_active', true)
    .order('brand')

  const { data: records } = await supabase
    .from('maintenance_records')
    .select('vehicle_id, type, date, amount')
    .order('date', { ascending: false })

  // Agrégation par véhicule (records déjà triés date desc → 1er vu = dernier)
  const byVehicle = new Map<string, { total: number; count: number; last?: { type: string; date: string } }>()
  for (const r of records ?? []) {
    const agg = byVehicle.get(r.vehicle_id) ?? { total: 0, count: 0 }
    agg.total += r.amount ?? 0
    agg.count += 1
    if (!agg.last) agg.last = { type: r.type, date: r.date }
    byVehicle.set(r.vehicle_id, agg)
  }

  const fleetTotal = (records ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Entretien</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Suivi des interventions par véhicule
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total flotte</p>
          <p className="text-lg font-black text-gray-900">{formatPrice(fleetTotal)}</p>
        </div>
      </div>

      {/* Liste véhicules */}
      {!vehicles || vehicles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Wrench className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">Aucun véhicule dans la flotte</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vehicles.map(v => {
            const agg       = byVehicle.get(v.id)
            const kmLeft    = v.next_service_km != null && v.current_km != null
              ? v.next_service_km - v.current_km : null
            const revisionSoon = kmLeft != null && kmLeft <= 1000

            return (
              <Link
                key={v.id}
                href={`/maintenance/${v.id}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all active:scale-[.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="bg-[#111111] text-white text-xs font-mono font-bold px-2 py-0.5 rounded-md tracking-wider">
                        {v.plate}
                      </span>
                      <span className="text-sm font-bold text-gray-900 truncate">{v.brand} {v.model}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                      {agg?.last ? (
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${maintenanceType(agg.last.type).dot}`} />
                          {maintenanceType(agg.last.type).label} · {formatDate(agg.last.date)}
                        </span>
                      ) : (
                        <span>Aucune intervention</span>
                      )}
                      {agg && <span>· {agg.count} interv.</span>}
                    </div>
                    {revisionSoon && (
                      <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-lg">
                        ⚠ Révision {kmLeft! <= 0 ? 'dépassée' : `dans ${kmLeft!.toLocaleString('fr-FR')} km`}
                      </span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-gray-900">{formatPrice(agg?.total ?? 0)}</p>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-1" />
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
