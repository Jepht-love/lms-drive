'use client'

import { useState } from 'react'
import VehicleViewSVG from './VehicleViewSVG'
import { VEHICLE_ZONES, VIEW_LABELS, type VehicleView, type DamageEntry } from './inspection-types'

interface DamageComparisonProps {
  departureDamages: Record<string, DamageEntry[]>
  returnDamages: Record<string, DamageEntry[]>
}

export default function DamageComparison({ departureDamages, returnDamages }: DamageComparisonProps) {
  const [selectedView, setSelectedView] = useState<VehicleView>('top')

  const newDamageZoneIds = Object.keys(returnDamages).filter(zoneId => {
    const before = departureDamages[zoneId]?.length ?? 0
    const after = returnDamages[zoneId]?.length ?? 0
    return after > before
  })

  function viewHasNewDamage(view: VehicleView) {
    return newDamageZoneIds.some(zoneId =>
      VEHICLE_ZONES.find(z => z.id === zoneId)?.views.includes(view)
    )
  }

  return (
    <div>
      {/* Sélecteur de vue avec indicateur de nouveaux dommages */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-3 overflow-x-auto">
        {(Object.keys(VIEW_LABELS) as VehicleView[]).map(view => (
          <button
            key={view}
            onClick={() => setSelectedView(view)}
            className={`relative flex-shrink-0 text-[12px] font-medium px-3 py-2 rounded-xl transition-colors ${
              selectedView === view ? 'bg-white shadow-sm text-[#111111]' : 'text-gray-400'
            }`}
          >
            {VIEW_LABELS[view]}
            {viewHasNewDamage(view) && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Comparaison côte à côte */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 text-center">Départ</p>
          <VehicleViewSVG view={selectedView} damages={departureDamages} onZoneClick={() => {}} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 text-center">Retour</p>
          <VehicleViewSVG view={selectedView} damages={returnDamages} onZoneClick={() => {}} />
        </div>
      </div>

      {/* Liste des nouveaux dommages */}
      {newDamageZoneIds.length > 0 && (
        <div className="mt-3 p-4 bg-red-50 rounded-2xl border border-red-200">
          <p className="text-[12px] font-bold text-red-700 mb-2">Nouveaux dommages constatés au retour :</p>
          {newDamageZoneIds.map(zoneId => {
            const zone = VEHICLE_ZONES.find(z => z.id === zoneId)
            const entries = returnDamages[zoneId]
            const lastEntry = entries?.[entries.length - 1]
            return (
              <p key={zoneId} className="text-[13px] text-red-600">
                · {zone?.label}{lastEntry?.comment ? ` — ${lastEntry.comment}` : ''}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}
