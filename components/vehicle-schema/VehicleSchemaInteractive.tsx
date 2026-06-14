'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { VEHICLE_ZONES, type ZoneId, type DamagedZone } from './zones'

interface Props {
  damagedZones: DamagedZone[]
  onZoneClick: (zone: { id: ZoneId; label: string }) => void
}

const ZONE_COLORS = {
  ok: '#dcfce7', ok_stroke: '#16a34a',
  rayure: '#fef9c3', rayure_stroke: '#ca8a04',
  dommage: '#fee2e2', dommage_stroke: '#dc2626',
  attention: '#fff7ed', attention_stroke: '#ea580c',
}

export default function VehicleSchemaInteractive({ damagedZones, onZoneClick }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  function getZoneState(id: ZoneId) {
    const damaged = damagedZones.find(z => z.id === id)
    if (!damaged) return { fill: ZONE_COLORS.ok, stroke: ZONE_COLORS.ok_stroke, severity: null as null | string }
    return {
      fill: ZONE_COLORS[damaged.severity],
      stroke: ZONE_COLORS[`${damaged.severity}_stroke` as keyof typeof ZONE_COLORS],
      severity: damaged.severity,
    }
  }

  function ZoneBtn({
    id, label, shortLabel, x, y, width, height, vertical = false,
  }: {
    id: ZoneId; label: string; shortLabel?: string
    x: number; y: number; width: number; height: number; vertical?: boolean
  }) {
    const state = getZoneState(id)
    const isHov = hovered === id
    const fill = isHov ? '#dbeafe' : state.fill
    const stroke = isHov ? '#3b82f6' : state.stroke
    const cx = x + width / 2
    const cy = y + height / 2
    const displayLabel = shortLabel ?? label

    return (
      <g
        onClick={() => onZoneClick({ id, label })}
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: 'pointer' }}
      >
        <motion.rect
          x={x} y={y} width={width} height={height} rx={3} ry={3}
          animate={{ fill, stroke, strokeWidth: isHov ? 2 : 1.5 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        />
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={vertical ? 7 : 7.5}
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#374151" fontWeight="500"
          transform={vertical ? `rotate(-90, ${cx}, ${cy})` : undefined}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {displayLabel}
        </text>
        {state.severity && (
          <circle cx={x + width - 4} cy={y + 4} r={3.5} fill={stroke} />
        )}
      </g>
    )
  }

  // Zone Intérieur rendered outside the SVG as a clickable button
  const intState = getZoneState('interieur')
  const intHov = hovered === 'interieur'

  return (
    <div className="space-y-2">
      {/* ── SVG top-down car view ── */}
      <svg
        viewBox="0 0 210 430"
        className="w-full rounded-2xl"
        style={{ maxHeight: 520, background: '#f8fafc' }}
      >
        {/* ── Car body silhouette ── */}
        <rect x={42} y={58} width={126} height={312} rx={18} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} />

        {/* ── Windshields (decorative) ── */}
        <rect x={65} y={128} width={80} height={22} rx={5} fill="#bfdbfe" stroke="#93c5fd" strokeWidth={1} />
        <rect x={65} y={268} width={80} height={22} rx={5} fill="#bfdbfe" stroke="#93c5fd" strokeWidth={1} />

        {/* ── AVANT ── */}
        <ZoneBtn id="pare_chocs_av" label="Pare-chocs AV" shortLabel="P.Chocs AV" x={52} y={48} width={106} height={14} />

        {/* Capot row — Aile AV G | Capot | Aile AV D */}
        <ZoneBtn id="aile_av_g" label="Aile avant gauche" shortLabel="Aile AV G" x={42} y={63} width={23} height={68} vertical />
        <ZoneBtn id="capot"     label="Capot"             x={65} y={63} width={80} height={68} />
        <ZoneBtn id="aile_av_d" label="Aile avant droite" shortLabel="Aile AV D" x={145} y={63} width={23} height={68} vertical />

        {/* Portières AV | Toit | Portières AR */}
        <ZoneBtn id="portiere_av_g" label="Portière avant gauche" shortLabel="P.AV G" x={42} y={131} width={23} height={70} vertical />
        <ZoneBtn id="toit"          label="Toit"                  x={65} y={131} width={80} height={159} />
        <ZoneBtn id="portiere_av_d" label="Portière avant droite" shortLabel="P.AV D" x={145} y={131} width={23} height={70} vertical />

        <ZoneBtn id="portiere_ar_g" label="Portière arrière gauche" shortLabel="P.AR G" x={42} y={201} width={23} height={70} vertical />
        <ZoneBtn id="portiere_ar_d" label="Portière arrière droite" shortLabel="P.AR D" x={145} y={201} width={23} height={70} vertical />

        {/* ── ARRIÈRE ── */}
        {/* Aile AR | Hayon | Aile AR */}
        <ZoneBtn id="aile_ar_g" label="Aile arrière gauche" shortLabel="Aile AR G" x={42} y={271} width={23} height={68} vertical />
        <ZoneBtn id="hayon"     label="Hayon"               x={65} y={290} width={80} height={60} />
        <ZoneBtn id="aile_ar_d" label="Aile arrière droite" shortLabel="Aile AR D" x={145} y={271} width={23} height={68} vertical />

        <ZoneBtn id="pare_chocs_ar" label="Pare-chocs AR" shortLabel="P.Chocs AR" x={52} y={356} width={106} height={14} />

        {/* ── Jantes (outside car body) ── */}
        <ZoneBtn id="jante_avg" label="Jante AV gauche" shortLabel="J.AV G" x={6}   y={108} width={30} height={52} />
        <ZoneBtn id="jante_avd" label="Jante AV droite" shortLabel="J.AV D" x={174} y={108} width={30} height={52} />
        <ZoneBtn id="jante_arg" label="Jante AR gauche" shortLabel="J.AR G" x={6}   y={255} width={30} height={52} />
        <ZoneBtn id="jante_ard" label="Jante AR droite" shortLabel="J.AR D" x={174} y={255} width={30} height={52} />

        {/* ── Legend ── */}
        <g transform="translate(8, 393)">
          {([
            ['ok',        'OK'],
            ['rayure',    'Rayure'],
            ['dommage',   'Dommage'],
            ['attention', 'Attention'],
          ] as const).map(([key, lbl], i) => (
            <g key={key} transform={`translate(${i * 50}, 0)`}>
              <rect x={0} y={0} width={9} height={9}
                fill={ZONE_COLORS[key]} stroke={ZONE_COLORS[`${key}_stroke`]} rx={2} />
              <text x={12} y={8} fontSize={7} fill="#374151">{lbl}</text>
            </g>
          ))}
        </g>
      </svg>

      {/* ── Zone Intérieur (outside SVG) ── */}
      <button
        type="button"
        onClick={() => onZoneClick({ id: 'interieur', label: 'Intérieur général' })}
        onMouseEnter={() => setHovered('interieur')}
        onMouseLeave={() => setHovered(null)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all"
        style={{
          backgroundColor: intHov ? '#dbeafe' : intState.fill,
          borderColor: intHov ? '#3b82f6' : intState.stroke,
        }}
      >
        <span className="text-sm font-medium text-gray-700">🚗 Intérieur général</span>
        {intState.severity ? (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            intState.severity === 'dommage'   ? 'bg-red-100 text-red-700' :
            intState.severity === 'rayure'    ? 'bg-yellow-100 text-yellow-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {intState.severity}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Appuyer pour signaler</span>
        )}
      </button>
    </div>
  )
}
