'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'
import type { Vehicle } from '@/types/database'
import { NEED_BADGE, type NeedBadge } from '@/lib/maintenance-health'

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  disponible:        { label: 'Disponible',      dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-100' },
  loue:              { label: 'Loué',            dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-100' },
  reserve:           { label: 'Réservé',         dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  maintenance:       { label: 'Maintenance',     dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-100' },
  hors_service:      { label: 'Hors service',    dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-100' },
  en_verification:   { label: 'Vérification',    dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  immobilise:        { label: 'Immobilisé',      dot: 'bg-red-400',    badge: 'bg-red-50 text-red-700 border-red-100' },
  mis_a_disposition: { label: 'Chez partenaire', dot: 'bg-purple-400', badge: 'bg-purple-50 text-purple-700 border-purple-100' },
  a_reparer:         { label: 'À réparer',       dot: 'bg-red-600',    badge: 'bg-red-50 text-red-700 border-red-100' },
}

export default function VehiclesGridSwipeable({
  vehicles,
  needsByVehicle = {},
  returnDateByVehicle = {},
}: {
  vehicles: Vehicle[]
  needsByVehicle?: Record<string, NeedBadge[]>
  returnDateByVehicle?: Record<string, string>
}) {
  return (
    <AnimatedList className="grid sm:grid-cols-2 gap-3 items-start">
      {vehicles.map(v => {
        const cfg = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.hors_service
        const badges = needsByVehicle[v.id] ?? []

        return (
          <AnimatedListItem key={v.id}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
              <Link href={`/vehicles/${v.id}`} className="block group active:scale-[.99]">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-gray-900 text-base leading-tight">{v.brand} {v.model}</h3>
                      {v.is_external
                        ? <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">Partenaire</span>
                        : v.version && <p className="text-xs text-gray-400 mt-0.5 truncate">{v.version}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 flex items-center gap-1.5 ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="bg-gray-100 text-gray-400 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md tracking-wider">{v.plate}</span>
                    {v.color && <span className="text-xs text-gray-400">{v.color}</span>}
                    {v.year && <span className="text-xs text-gray-400 ml-auto">{v.year}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {v.current_km != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Km</span>
                        <span className="text-xs font-bold text-gray-700">{v.current_km.toLocaleString('fr-FR')}</span>
                      </div>
                    )}
                    {v.daily_price != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Jour</span>
                        <span className="text-xs font-bold text-gray-700">{v.daily_price}€</span>
                      </div>
                    )}
                    {v.fuel_type && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Carbu.</span>
                        <span className="text-xs font-bold text-gray-700 capitalize">{v.fuel_type}</span>
                      </div>
                    )}
                    {v.deposit_amount != null && (
                      <div className="flex items-center justify-between col-span-2">
                        <span className="text-xs text-gray-400">Caution</span>
                        <span className="text-xs font-bold text-gray-700">{v.deposit_amount.toLocaleString('fr-FR')}€</span>
                      </div>
                    )}
                  </div>
                  {badges.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
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
              </Link>
              {v.status === 'disponible' && (
                <Link
                  href={`/reservations/new?vehicle=${v.id}`}
                  className="flex items-center justify-center gap-2 border-t border-gray-50 py-3 text-sm font-bold text-green-700 bg-green-50/40 hover:bg-green-50 transition-colors active:scale-[.99]"
                >
                  <Plus className="w-4 h-4" /> Réserver
                </Link>
              )}
              {['loue', 'reserve'].includes(v.status) && (
                <div className="border-t border-gray-50">
                  {returnDateByVehicle[v.id] && (
                    <p className="text-center text-xs text-gray-400 pt-2">
                      Retour le {format(new Date(returnDateByVehicle[v.id]), "d MMM 'à' HH:mm", { locale: fr })}
                    </p>
                  )}
                  <Link
                    href={`/reservations/new?vehicle=${v.id}`}
                    className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-blue-700 bg-blue-50/40 hover:bg-blue-50 transition-colors active:scale-[.99]"
                  >
                    <Plus className="w-4 h-4" /> Réserver après
                  </Link>
                </div>
              )}
            </div>
          </AnimatedListItem>
        )
      })}
    </AnimatedList>
  )
}
