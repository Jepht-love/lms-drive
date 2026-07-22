'use client'

import { type DamageEntry } from './inspection-types'
import VehicleMap2D, { type PreviousZone } from './VehicleMap2D'

export interface VehicleInspectionMapProps {
  damages: Record<string, DamageEntry[]>
  onDamageAdd: (zoneId: string, entry: DamageEntry) => void
  onDamageRemove: (zoneId: string, index: number) => void
  onDamageUpdate?: (zoneId: string, index: number, entry: DamageEntry) => void
  readonly?: boolean
  previousZones?: PreviousZone[]
  phase?: 'departure' | 'return'
  // Photos de constat d'état par élément (indépendantes d'un dommage).
  zonePhotos?: Record<string, string[]>
  onZonePhotoAdd?: (zoneId: string, dataUrl: string) => void
  onZonePhotoRemove?: (zoneId: string, index: number) => void
  // Photos du DÉPART par zone (EDL retour) → comparaison côte à côte.
  previousZonePhotos?: Record<string, string[]>
}

export default function VehicleInspectionMap({
  damages,
  onDamageAdd,
  onDamageRemove,
  onDamageUpdate,
  readonly,
  previousZones,
  phase,
  zonePhotos,
  onZonePhotoAdd,
  onZonePhotoRemove,
  previousZonePhotos,
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
        onDamageUpdate={onDamageUpdate}
        readonly={readonly}
        previousZones={previousZones}
        phase={phase}
        zonePhotos={zonePhotos}
        onZonePhotoAdd={onZonePhotoAdd}
        onZonePhotoRemove={onZonePhotoRemove}
        previousZonePhotos={previousZonePhotos}
      />
    </div>
  )
}
