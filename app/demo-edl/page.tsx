'use client'

import { useState } from 'react'
import VehicleInspectionMap from '@/components/vehicle-schema/VehicleInspectionMap'
import DamageComparison from '@/components/vehicle-schema/DamageComparison'
import FuelGauge from '@/components/FuelGauge'
import { type DamageEntry } from '@/components/vehicle-schema/inspection-types'

// Données de départ simulées
const DEPARTURE_DEMO: Record<string, DamageEntry[]> = {
  'jante-av-gauche': [{ severity: 'rayure', type: 'rayure', comment: 'Petite rayure sur jante', photos: [] }],
  'pare-brise': [{ severity: 'attention', type: 'fissure', comment: 'Micro-fissure coin bas gauche', photos: [] }],
}

// Données de retour simulées (nouvelles + existantes)
const RETURN_DEMO: Record<string, DamageEntry[]> = {
  'jante-av-gauche': [{ severity: 'rayure', type: 'rayure', comment: 'Petite rayure sur jante', photos: [] }],
  'pare-brise': [{ severity: 'attention', type: 'fissure', comment: 'Micro-fissure coin bas gauche', photos: [] }],
  'porte-avant-gauche': [{ severity: 'dommage', type: 'bosse', comment: 'Bosse porte avant', photos: [] }],
  'aile-arriere-droite': [{ severity: 'rayure', type: 'rayure_profonde', comment: 'Rayure longue', photos: [] }],
}

export default function DemoEDL() {
  const [damages, setDamages] = useState<Record<string, DamageEntry[]>>({})
  const [fuel, setFuel] = useState(6)
  const [tab, setTab] = useState<'saisie' | 'comparaison'>('saisie')

  function handleAdd(zoneId: string, entry: DamageEntry) {
    setDamages(prev => ({ ...prev, [zoneId]: [...(prev[zoneId] ?? []), entry] }))
  }
  function handleRemove(zoneId: string, index: number) {
    setDamages(prev => ({ ...prev, [zoneId]: (prev[zoneId] ?? []).filter((_, i) => i !== index) }))
  }

  const zoneCount = Object.values(damages).filter(e => e.length > 0).length

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header démo */}
      <div className="bg-[#111111] px-4 py-3 flex items-center justify-between">
        <p className="text-white text-sm font-bold">DÉMO — État des lieux</p>
        <span className="text-white/40 text-xs">lms-drive</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-200 m-4 rounded-2xl p-1">
        {(['saisie', 'comparaison'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-white shadow-sm text-[#111111]' : 'text-gray-400'
            }`}
          >
            {t === 'saisie' ? `Saisie${zoneCount ? ` · ${zoneCount} zone(s)` : ''}` : 'Comparaison départ/retour'}
          </button>
        ))}
      </div>

      <div className="px-4 pb-10 space-y-4">
        {tab === 'saisie' && (
          <>
            {/* Jauge carburant */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Carburant</p>
              <FuelGauge level={fuel} onChange={setFuel} />
            </div>

            {/* Carte EDL interactive */}
            <VehicleInspectionMap
              damages={damages}
              onDamageAdd={handleAdd}
              onDamageRemove={handleRemove}
            />
          </>
        )}

        {tab === 'comparaison' && (
          <DamageComparison
            departureDamages={DEPARTURE_DEMO}
            returnDamages={RETURN_DEMO}
          />
        )}
      </div>
    </div>
  )
}
