import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Wrench, ChevronRight } from 'lucide-react'
import { formatPrice, formatDate } from '@/lib/utils'
import { maintenanceType } from '@/lib/maintenance'
import {
  computeVehicleNeeds,
  buildLastByType,
  groupNeedsForBadges,
  worstSeverity,
  NEED_BADGE,
  type NeedSeverity,
} from '@/lib/maintenance-health'

const SEV_ORDER: Record<NeedSeverity, number> = { overdue: 0, urgent: 1, soon: 2, ok: 3 }

export default async function MaintenancePage() {
  const supabase = await createClient()

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, status, current_km, next_service_km, next_service_date, ct_date, maintenance_flags')
    .eq('is_active', true)
    .order('brand')

  const { data: records } = await supabase
    .from('maintenance_records')
    .select('vehicle_id, type, km_at_intervention, date, amount')
    .order('date', { ascending: false })

  // Agrégation par véhicule (records triés date desc → 1er vu = dernier)
  const byVehicle = new Map<string, { total: number; count: number; last?: { type: string; date: string } }>()
  const recordsByVehicle = new Map<string, { type: string; km_at_intervention: number | null; date: string }[]>()
  for (const r of records ?? []) {
    const agg = byVehicle.get(r.vehicle_id) ?? { total: 0, count: 0 }
    agg.total += r.amount ?? 0
    agg.count += 1
    if (!agg.last) agg.last = { type: r.type, date: r.date }
    byVehicle.set(r.vehicle_id, agg)

    const arr = recordsByVehicle.get(r.vehicle_id) ?? []
    arr.push(r)
    recordsByVehicle.set(r.vehicle_id, arr)
  }

  const fleetTotal = (records ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

  // Calcul des échéances + tri par urgence (overdue en tête)
  const now = new Date()
  const enriched = (vehicles ?? []).map(v => {
    const needs = computeVehicleNeeds(v, buildLastByType(recordsByVehicle.get(v.id) ?? []), now)
    return { v, agg: byVehicle.get(v.id), badges: groupNeedsForBadges(needs), worst: worstSeverity(needs) }
  })
  enriched.sort((a, b) => SEV_ORDER[a.worst] - SEV_ORDER[b.worst])

  const toService = enriched.filter(e => e.worst !== 'ok').length

  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Entretien</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {toService > 0
              ? <span className="text-red-600 font-semibold">{toService} véhicule{toService > 1 ? 's' : ''} à traiter</span>
              : 'Flotte à jour'}
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
          {enriched.map(({ v, agg, badges }) => (
            <Link
              key={v.id}
              href={`/maintenance/${v.id}`}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all active:scale-[.99]"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-gray-900 truncate">{v.brand} {v.model}</span>
                    <span className="bg-gray-100 text-gray-400 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md tracking-wider">
                      {v.plate}
                    </span>
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
                  {badges.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {badges.map(b => (
                        <span key={b.key} className={`text-xs px-2 py-0.5 rounded-lg font-semibold border ${NEED_BADGE[b.severity]}`}>
                          {b.key === 'degradation'
                            ? `Dégradé${b.count > 1 ? ` (${b.count})` : ''}`
                            : `${b.label} · ${b.detail}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black text-gray-900">{formatPrice(agg?.total ?? 0)}</p>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
