'use client'

import type { DamageEntry } from './inspection-types'

// ─── Types ───────────────────────────────────────────────────────────────────
type Zone2D = {
  id: string
  label: string
  view: 'front' | 'rear' | 'left' | 'right'
  x: number; y: number; w: number; h: number
  rx?: number
  shape?: 'ellipse'
}

// ─── Zones per view (coordinates are absolute in 420×260 SVG) ───────────────
// Front quadrant:  x 0–210, y 0–130
// Rear quadrant:   x 210–420, y 0–130
// Left quadrant:   x 0–210, y 130–260
// Right quadrant:  x 210–420, y 130–260

const ZONES: Zone2D[] = [
  // ── VUE AVANT ──────────────────────────────────────────────────────────────
  { id: 'capot',            label: 'Capot',       view: 'front', x: 58,  y: 14,  w: 94,  h: 26 },
  { id: 'pare-brise',       label: 'Pare-brise',  view: 'front', x: 62,  y: 40,  w: 86,  h: 22 },
  { id: 'phare-gauche',     label: 'Ph.G',        view: 'front', x: 14,  y: 62,  w: 34,  h: 16, rx: 4 },
  { id: 'phare-droit',      label: 'Ph.D',        view: 'front', x: 162, y: 62,  w: 34,  h: 16, rx: 4 },
  { id: 'aile-avant-gauche',label: 'Aile AV G',   view: 'front', x: 8,   y: 36,  w: 50,  h: 42 },
  { id: 'aile-avant-droite',label: 'Aile AV D',   view: 'front', x: 152, y: 36,  w: 50,  h: 42 },
  { id: 'pare-chocs-avant', label: 'PC Avant',    view: 'front', x: 20,  y: 80,  w: 170, h: 24, rx: 6 },

  // ── VUE ARRIÈRE ──────────────────────────────────────────────────────────
  { id: 'lunette-arriere',    label: 'Lunette',     view: 'rear', x: 272, y: 40,  w: 86,  h: 22 },
  { id: 'coffre',             label: 'Coffre',      view: 'rear', x: 268, y: 14,  w: 94,  h: 26 },
  { id: 'feu-arriere-gauche', label: 'Feu G',       view: 'rear', x: 224, y: 62,  w: 34,  h: 16, rx: 4 },
  { id: 'feu-arriere-droit',  label: 'Feu D',       view: 'rear', x: 372, y: 62,  w: 34,  h: 16, rx: 4 },
  { id: 'aile-arriere-gauche',label: 'Aile AR G',   view: 'rear', x: 218, y: 36,  w: 50,  h: 42 },
  { id: 'aile-arriere-droite',label: 'Aile AR D',   view: 'rear', x: 362, y: 36,  w: 50,  h: 42 },
  { id: 'pare-chocs-arriere', label: 'PC Arrière',  view: 'rear', x: 230, y: 80,  w: 170, h: 24, rx: 6 },

  // ── PROFIL GAUCHE ─────────────────────────────────────────────────────────
  { id: 'toit',               label: 'Toit',        view: 'left', x: 50,  y: 138, w: 116, h: 20 },
  { id: 'porte-avant-gauche', label: 'Porte AV G',  view: 'left', x: 34,  y: 158, w: 62,  h: 38 },
  { id: 'porte-arriere-gauche',label:'Porte AR G',  view: 'left', x: 98,  y: 158, w: 62,  h: 38 },
  { id: 'retroviseur-gauche', label: 'Rétro G',     view: 'left', x: 28,  y: 154, w: 16,  h: 12, rx: 3 },
  { id: 'bas-de-caisse-gauche',label:'Bas caisse G',view: 'left', x: 34,  y: 196, w: 148, h: 10, rx: 3 },
  { id: 'jante-av-gauche',    label: 'Jante AV G',  view: 'left', x: 26,  y: 206, w: 34,  h: 34, shape: 'ellipse', rx: 17 },
  { id: 'jante-ar-gauche',    label: 'Jante AR G',  view: 'left', x: 150, y: 206, w: 34,  h: 34, shape: 'ellipse', rx: 17 },

  // ── PROFIL DROIT ─────────────────────────────────────────────────────────
  { id: 'porte-avant-droite', label: 'Porte AV D',  view: 'right', x: 244, y: 158, w: 62,  h: 38 },
  { id: 'porte-arriere-droite',label:'Porte AR D',  view: 'right', x: 308, y: 158, w: 62,  h: 38 },
  { id: 'retroviseur-droit',  label: 'Rétro D',     view: 'right', x: 366, y: 154, w: 16,  h: 12, rx: 3 },
  { id: 'bas-de-caisse-droite',label:'Bas caisse D',view: 'right', x: 244, y: 196, w: 148, h: 10, rx: 3 },
  { id: 'jante-av-droite',    label: 'Jante AV D',  view: 'right', x: 236, y: 206, w: 34,  h: 34, shape: 'ellipse', rx: 17 },
  { id: 'jante-ar-droite',    label: 'Jante AR D',  view: 'right', x: 360, y: 206, w: 34,  h: 34, shape: 'ellipse', rx: 17 },
]

// ─── Car body SVG paths ──────────────────────────────────────────────────────
function CarFront({ ox, oy }: { ox: number; oy: number }) {
  const x = (v: number) => ox + v
  const y = (v: number) => oy + v
  return (
    <g fill="none" stroke="#94a3b8" strokeWidth="1.5">
      {/* cabin */}
      <path d={`M${x(62)},${y(40)} L${x(55)},${y(8)} L${x(155)},${y(8)} L${x(148)},${y(40)} Z`} />
      {/* body */}
      <rect x={x(8)} y={y(36)} width={194} height={74} rx={6} />
      {/* windshield divider */}
      <line x1={x(105)} y1={y(40)} x2={x(105)} y2={y(62)} strokeDasharray="3,3" strokeWidth="1" />
      {/* bonnet line */}
      <line x1={x(8)} y1={y(62)} x2={x(212)} y2={y(62)} strokeWidth="1" />
      {/* grille */}
      <rect x={x(72)} y={y(64)} width={66} height={16} rx={3} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      {/* plate */}
      <rect x={x(82)} y={y(87)} width={46} height={9} rx={2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
    </g>
  )
}

function CarRear({ ox, oy }: { ox: number; oy: number }) {
  const x = (v: number) => ox + v
  const y = (v: number) => oy + v
  return (
    <g fill="none" stroke="#94a3b8" strokeWidth="1.5">
      <path d={`M${x(62)},${y(40)} L${x(55)},${y(8)} L${x(155)},${y(8)} L${x(148)},${y(40)} Z`} />
      <rect x={x(8)} y={y(36)} width={194} height={74} rx={6} />
      <line x1={x(105)} y1={y(40)} x2={x(105)} y2={y(62)} strokeDasharray="3,3" strokeWidth="1" />
      <line x1={x(8)} y1={y(62)} x2={x(212)} y2={y(62)} strokeWidth="1" />
      {/* rear badge */}
      <rect x={x(88)} y={y(14)} width={34} height={8} rx={2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      {/* plate */}
      <rect x={x(72)} y={y(87)} width={66} height={9} rx={2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
    </g>
  )
}

function CarSide({ ox, oy, flip }: { ox: number; oy: number; flip?: boolean }) {
  const sx = flip ? -1 : 1
  const tx = flip ? ox + 210 : ox
  return (
    <g transform={`translate(${tx},${oy}) scale(${sx},1)`} fill="none" stroke="#94a3b8" strokeWidth="1.5">
      {/* roof */}
      <path d="M34,28 Q42,10 72,10 L138,10 Q168,10 174,28 Z" />
      {/* body sides */}
      <path d="M10,28 L34,28 L34,95 L10,95 Q8,95 6,90 L6,50 Q6,28 10,28 Z" />
      <path d="M174,28 L198,28 Q202,28 204,50 L204,90 Q202,95 200,95 L174,95 Z" />
      {/* body bottom */}
      <rect x={6} y={28} width={198} height={70} rx={4} />
      {/* door separator */}
      <line x1={105} y1={28} x2={105} y2={98} strokeWidth="1" />
      {/* window line */}
      <line x1={34} y1={28} x2={174} y2={28} strokeWidth="1" />
      {/* sill */}
      <rect x={34} y={95} width={142} height={6} rx={2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      {/* front wheel arch */}
      <path d="M10,100 Q43,100 43,118 Q43,136 10,136" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
      {/* rear wheel arch */}
      <path d="M167,100 Q200,100 200,118 Q200,136 167,136" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" />
    </g>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
interface Props {
  damages: Record<string, DamageEntry[]>
  onZoneClick: (id: string) => void
  readonly?: boolean
}

const VIEW_LABELS: Record<string, string> = {
  front: 'Vue avant',
  rear:  'Vue arrière',
  left:  'Profil gauche',
  right: 'Profil droit',
}

const VIEW_OFFSETS: Record<string, { ox: number; oy: number }> = {
  front: { ox: 0,   oy: 0   },
  rear:  { ox: 210, oy: 0   },
  left:  { ox: 0,   oy: 130 },
  right: { ox: 210, oy: 130 },
}

export default function VehicleMap2D({ damages, onZoneClick, readonly }: Props) {
  function damageCount(id: string) {
    return (damages[id] ?? []).length
  }

  function zoneColor(id: string) {
    const n = damageCount(id)
    if (n === 0) return { fill: '#f8fafc', stroke: '#cbd5e1', text: '#94a3b8' }
    if (n === 1) return { fill: '#fef9c3', stroke: '#eab308', text: '#713f12' }
    return { fill: '#fee2e2', stroke: '#ef4444', text: '#991b1b' }
  }

  return (
    <div className="w-full max-w-[460px] mx-auto bg-white rounded-xl overflow-hidden">
      {/* View labels */}
      <div className="grid grid-cols-2 text-center">
        {(['front', 'rear', 'left', 'right'] as const).map(v => (
          <div key={v} className="py-1 border-b border-r last:border-r-0 border-gray-100">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
              {VIEW_LABELS[v]}
            </span>
          </div>
        ))}
      </div>

      <svg
        viewBox="0 0 420 260"
        className="w-full"
        style={{ display: 'block', maxHeight: '62vh' }}
      >
        {/* Quadrant dividers */}
        <line x1={210} y1={0} x2={210} y2={260} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={0} y1={130} x2={420} y2={130} stroke="#e2e8f0" strokeWidth="1" />

        {/* Car bodies */}
        <CarFront ox={0}   oy={0}   />
        <CarRear  ox={210} oy={0}   />
        <CarSide  ox={0}   oy={130} />
        <CarSide  ox={210} oy={130} flip />

        {/* Interactive zones */}
        {ZONES.map(z => {
          const col = zoneColor(z.id)
          const n   = damageCount(z.id)
          const cx  = z.x + z.w / 2
          const cy  = z.y + z.h / 2

          return (
            <g key={z.id}>
              {z.shape === 'ellipse' ? (
                <ellipse
                  cx={cx} cy={cy}
                  rx={z.w / 2} ry={z.h / 2}
                  fill={col.fill} stroke={col.stroke} strokeWidth={n > 0 ? 1.5 : 1}
                  style={{ cursor: readonly ? 'default' : 'pointer', opacity: 0.85 }}
                  onClick={() => !readonly && onZoneClick(z.id)}
                />
              ) : (
                <rect
                  x={z.x} y={z.y} width={z.w} height={z.h} rx={z.rx ?? 3}
                  fill={col.fill} stroke={col.stroke} strokeWidth={n > 0 ? 1.5 : 1}
                  style={{ cursor: readonly ? 'default' : 'pointer', opacity: 0.85 }}
                  onClick={() => !readonly && onZoneClick(z.id)}
                />
              )}

              {/* Zone label */}
              <text
                x={cx} y={cy + 1}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={z.w < 36 ? 5 : 6}
                fontWeight="600"
                fill={col.text}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {z.label}
              </text>

              {/* Damage badge */}
              {n > 0 && (
                <>
                  <circle cx={z.x + z.w - 4} cy={z.y + 4} r={5} fill="#ef4444" />
                  <text
                    x={z.x + z.w - 4} y={z.y + 4}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={5} fontWeight="700" fill="white"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>

      {!readonly && (
        <p className="text-center text-[10px] text-gray-400 pb-2">
          Appuyez sur une zone pour signaler un dommage
        </p>
      )}
    </div>
  )
}
