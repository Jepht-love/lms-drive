'use client'

import { useState } from 'react'
import DamageDrawer from './DamageDrawer'
import { VEHICLE_ZONES, type DamageEntry } from './inspection-types'
import VehicleMap2D from './VehicleMap2D'

export interface VehicleInspectionMapProps {
  damages: Record<string, DamageEntry[]>
  onDamageAdd: (zoneId: string, entry: DamageEntry) => void
  onDamageRemove: (zoneId: string, index: number) => void
  readonly?: boolean
}

export default function VehicleInspectionMap({
  damages,
  onDamageAdd,
  onDamageRemove,
  readonly,
}: VehicleInspectionMapProps) {
  const [activeZone, setActiveZone] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 py-2 text-center border-b border-gray-100">
          Schéma véhicule
        </p>
        <VehicleMap2D
          damages={damages}
          onZoneClick={id => { if (!readonly) setActiveZone(id) }}
          readonly={readonly}
        />
      </div>

      <DamageDrawer
        open={!!activeZone}
        zone={VEHICLE_ZONES.find(z => z.id === activeZone) ?? VEHICLE_ZONES[0]}
        existingDamages={activeZone ? (damages[activeZone] ?? []) : []}
        onAdd={entry => { if (activeZone) onDamageAdd(activeZone, entry) }}
        onRemove={index => { if (activeZone) onDamageRemove(activeZone, index) }}
        onClose={() => setActiveZone(null)}
      />
    </div>
  )
}
