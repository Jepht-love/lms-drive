'use client'

import { type DamageEntry } from './inspection-types'
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
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 py-2 text-center border-b border-gray-100">
        Schéma du véhicule &amp; dommages constatés
      </p>
      <VehicleMap2D
        damages={damages}
        onDamageAdd={onDamageAdd}
        onDamageRemove={onDamageRemove}
        readonly={readonly}
      />
    </div>
  )
}
