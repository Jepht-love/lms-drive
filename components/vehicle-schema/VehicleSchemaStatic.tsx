'use client'

// Rendu LECTURE SEULE du vrai schéma (fond v3 + zones détourées EDL_ZONES) :
// utilisé pour la comparaison Départ/Retour. Surligne uniquement les zones
// endommagées, avec un cadrage (viewBox) optionnel sur une vue précise.
import { EDL_IMG, EDL_SRC, EDL_ZONES, zoneBox } from './edl-zones'
import type { DamageEntry, DamageSeverity } from './inspection-types'

const SEV: Record<DamageSeverity, { fill: string; stroke: string }> = {
  rayure:    { fill: '#eab308', stroke: '#ca8a04' },
  attention: { fill: '#f97316', stroke: '#ea580c' },
  dommage:   { fill: '#ef4444', stroke: '#dc2626' },
}
const RANK: Record<DamageSeverity, number> = { rayure: 0, attention: 1, dommage: 2 }
function worst(entries: DamageEntry[]): DamageSeverity {
  return entries.reduce<DamageSeverity>((a, e) => (RANK[e.severity] > RANK[a] ? e.severity : a), 'rayure')
}

export type ViewBox = { x: number; y: number; w: number; h: number }

export default function VehicleSchemaStatic({ damages, box, highlightIds }: {
  damages: Record<string, DamageEntry[]>
  box?: ViewBox
  highlightIds?: Set<string>   // contour bleu = nouveau dommage au retour
}) {
  const vb = box ?? { x: 0, y: 0, w: EDL_IMG, h: EDL_IMG }
  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="w-full" style={{ display: 'block' }}>
      <image href={EDL_SRC} x={0} y={0} width={EDL_IMG} height={EDL_IMG} />
      {EDL_ZONES.map((z, i) => {
        const entries = damages[z.id] ?? []
        if (!entries.length) return null
        const c = SEV[worst(entries)]
        const b = zoneBox(z)
        const isNew = highlightIds?.has(z.id)
        const p = { fill: c.fill, fillOpacity: 0.45, stroke: isNew ? '#2563eb' : c.stroke, strokeWidth: isNew ? 4 : 2 }
        if (z.points) return <polygon key={`${z.id}-${i}`} points={z.points.map(pt => pt.join(',')).join(' ')} {...p} strokeLinejoin="round" />
        if (z.shape === 'ellipse') return <ellipse key={`${z.id}-${i}`} cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} {...p} />
        return <rect key={`${z.id}-${i}`} x={b.x} y={b.y} width={b.w} height={b.h} rx={z.rx ?? 8} {...p} />
      })}
    </svg>
  )
}
