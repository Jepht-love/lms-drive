'use client'

import { motion } from 'framer-motion'
import { VEHICLE_ZONES, type VehicleView, type DamageEntry } from './inspection-types'

type ZoneCoord = { x: number; y: number; w: number; h: number; rx?: number }

const ZONE_COORDS: Record<VehicleView, Record<string, ZoneCoord>> = {
  top: {
    capot:                  { x: 30,  y: 20,  w: 180, h: 85,  rx: 15 },
    'pare-brise':           { x: 40,  y: 105, w: 160, h: 18,  rx: 4  },
    toit:                   { x: 40,  y: 123, w: 160, h: 152, rx: 6  },
    'lunette-arriere':      { x: 40,  y: 275, w: 160, h: 18,  rx: 4  },
    coffre:                 { x: 30,  y: 293, w: 180, h: 107, rx: 15 },
    'retroviseur-gauche':   { x: 6,   y: 128, w: 20,  h: 38,  rx: 8  },
    'retroviseur-droit':    { x: 214, y: 128, w: 20,  h: 38,  rx: 8  },
    'jante-av-gauche':      { x: 12,  y: 58,  w: 24,  h: 52,  rx: 10 },
    'jante-av-droite':      { x: 204, y: 58,  w: 24,  h: 52,  rx: 10 },
    'jante-ar-gauche':      { x: 12,  y: 310, w: 24,  h: 52,  rx: 10 },
    'jante-ar-droite':      { x: 204, y: 310, w: 24,  h: 52,  rx: 10 },
  },
  front: {
    'pare-brise':           { x: 60,  y: 14,  w: 120, h: 20,  rx: 4  },
    capot:                  { x: 50,  y: 36,  w: 140, h: 20,  rx: 4  },
    'phare-gauche':         { x: 44,  y: 58,  w: 42,  h: 30,  rx: 8  },
    calandre:               { x: 88,  y: 58,  w: 64,  h: 38,  rx: 8  },
    'phare-droit':          { x: 154, y: 58,  w: 42,  h: 30,  rx: 8  },
    'aile-avant-gauche':    { x: 38,  y: 88,  w: 38,  h: 64,  rx: 10 },
    'aile-avant-droite':    { x: 164, y: 88,  w: 38,  h: 64,  rx: 10 },
    'pare-chocs-avant':     { x: 44,  y: 150, w: 152, h: 22,  rx: 10 },
    'plaque-avant':         { x: 98,  y: 156, w: 44,  h: 12,  rx: 2  },
    'jante-av-gauche':      { x: 28,  y: 144, w: 34,  h: 32,  rx: 16 },
    'jante-av-droite':      { x: 178, y: 144, w: 34,  h: 32,  rx: 16 },
  },
  rear: {
    'lunette-arriere':      { x: 60,  y: 14,  w: 120, h: 20,  rx: 4  },
    coffre:                 { x: 50,  y: 36,  w: 140, h: 20,  rx: 4  },
    'feu-arriere-gauche':   { x: 44,  y: 58,  w: 42,  h: 30,  rx: 8  },
    'feu-arriere-droit':    { x: 154, y: 58,  w: 42,  h: 30,  rx: 8  },
    'aile-arriere-gauche':  { x: 38,  y: 88,  w: 38,  h: 64,  rx: 10 },
    'aile-arriere-droite':  { x: 164, y: 88,  w: 38,  h: 64,  rx: 10 },
    'pare-chocs-arriere':   { x: 44,  y: 150, w: 152, h: 22,  rx: 10 },
    'plaque-arriere':       { x: 98,  y: 156, w: 44,  h: 12,  rx: 2  },
    'jante-ar-gauche':      { x: 28,  y: 144, w: 34,  h: 32,  rx: 16 },
    'jante-ar-droite':      { x: 178, y: 144, w: 34,  h: 32,  rx: 16 },
  },
  left: {
    'aile-arriere-gauche':  { x: 30,  y: 38,  w: 85,  h: 78,  rx: 12 },
    'porte-arriere-gauche': { x: 118, y: 33,  w: 110, h: 88,  rx: 10 },
    'vitre-arriere-gauche': { x: 128, y: 38,  w: 95,  h: 38,  rx: 6  },
    'porte-avant-gauche':   { x: 232, y: 33,  w: 110, h: 88,  rx: 10 },
    'vitre-avant-gauche':   { x: 242, y: 38,  w: 95,  h: 38,  rx: 6  },
    'aile-avant-gauche':    { x: 345, y: 38,  w: 85,  h: 78,  rx: 12 },
    'retroviseur-gauche':   { x: 322, y: 22,  w: 22,  h: 16,  rx: 4  },
    'jante-ar-gauche':      { x: 65,  y: 112, w: 56,  h: 56,  rx: 28 },
    'jante-av-gauche':      { x: 358, y: 112, w: 56,  h: 56,  rx: 28 },
    'bas-de-caisse-gauche': { x: 112, y: 124, w: 248, h: 14,  rx: 4  },
  },
  right: {
    'aile-arriere-droite':  { x: 30,  y: 38,  w: 85,  h: 78,  rx: 12 },
    'porte-arriere-droite': { x: 118, y: 33,  w: 110, h: 88,  rx: 10 },
    'vitre-arriere-droite': { x: 128, y: 38,  w: 95,  h: 38,  rx: 6  },
    'porte-avant-droite':   { x: 232, y: 33,  w: 110, h: 88,  rx: 10 },
    'vitre-avant-droite':   { x: 242, y: 38,  w: 95,  h: 38,  rx: 6  },
    'aile-avant-droite':    { x: 345, y: 38,  w: 85,  h: 78,  rx: 12 },
    'retroviseur-droit':    { x: 322, y: 22,  w: 22,  h: 16,  rx: 4  },
    'jante-ar-droite':      { x: 65,  y: 112, w: 56,  h: 56,  rx: 28 },
    'jante-av-droite':      { x: 358, y: 112, w: 56,  h: 56,  rx: 28 },
    'bas-de-caisse-droite': { x: 112, y: 124, w: 248, h: 14,  rx: 4  },
  },
}

const BODY_OUTLINE: Record<VehicleView, ZoneCoord> = {
  top:   { x: 20, y: 10,  w: 200, h: 400, rx: 40 },
  front: { x: 30, y: 30,  w: 180, h: 140, rx: 20 },
  rear:  { x: 30, y: 30,  w: 180, h: 140, rx: 20 },
  left:  { x: 20, y: 25,  w: 420, h: 110, rx: 25 },
  right: { x: 20, y: 25,  w: 420, h: 110, rx: 25 },
}

// Position of each view in the 600×400 unified canvas
const LAYOUT: Record<VehicleView, { x: number; y: number; w: number; h: number }> = {
  top:   { x: 230, y: 15,  w: 140, h: 245 },
  front: { x: 90,  y: 75,  w: 130, h: 98  },
  rear:  { x: 380, y: 75,  w: 130, h: 98  },
  left:  { x: 10,  y: 278, w: 280, h: 110 },
  right: { x: 310, y: 278, w: 280, h: 110 },
}

const VIEW_VB: Record<VehicleView, string> = {
  top:   '0 0 240 420',
  front: '0 0 240 180',
  rear:  '0 0 240 180',
  left:  '0 0 460 180',
  right: '0 0 460 180',
}

const LABEL: Record<VehicleView, { text: string; x: number; y: number }> = {
  top:   { text: 'DESSUS',    x: 300, y: 13 },
  front: { text: 'AVANT',     x: 155, y: 74 },
  rear:  { text: 'ARRIÈRE',   x: 445, y: 74 },
  left:  { text: 'PROFIL G.', x: 150, y: 276 },
  right: { text: 'PROFIL D.', x: 450, y: 276 },
}

const VIEWS: VehicleView[] = ['top', 'front', 'rear', 'left', 'right']

interface Props {
  damages: Record<string, DamageEntry[]>
  onZoneClick: (zoneId: string) => void
  readonly?: boolean
}

function ViewGroup({ view, damages, onZoneClick, readonly }: Props & { view: VehicleView }) {
  const layout = LAYOUT[view]
  const coords = ZONE_COORDS[view]
  const body = BODY_OUTLINE[view]
  const zones = VEHICLE_ZONES.filter(z => z.views.includes(view))

  return (
    <svg x={layout.x} y={layout.y} width={layout.w} height={layout.h} viewBox={VIEW_VB[view]}>
      <rect
        x={body.x} y={body.y} width={body.w} height={body.h} rx={body.rx ?? 0}
        fill="#FAFAFA" stroke="#D1D5DB" strokeWidth="1.5"
      />
      {zones.map(zone => {
        const c = coords[zone.id]
        if (!c) return null
        const hasDamage = (damages[zone.id]?.length ?? 0) > 0
        return (
          <motion.rect
            key={zone.id}
            x={c.x} y={c.y} width={c.w} height={c.h} rx={c.rx ?? 6}
            animate={{ fill: hasDamage ? '#DC2626' : '#F3F4F6' }}
            whileHover={readonly ? {} : { fill: hasDamage ? '#b91c1c' : '#fee2e2' }}
            transition={{ duration: 0.18 }}
            stroke="#D1D5DB" strokeWidth="1"
            style={{ cursor: readonly ? 'default' : 'pointer' }}
            onClick={() => !readonly && onZoneClick(zone.id)}
          />
        )
      })}
    </svg>
  )
}

export default function VehicleOrthographicSVG({ damages, onZoneClick, readonly }: Props) {
  return (
    <svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" className="w-full">
      {/* Projection lines linking front/rear to top view */}
      <line x1="155" y1="74" x2="230" y2="35"  stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="3,3" />
      <line x1="445" y1="74" x2="370" y2="35"  stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="3,3" />

      {/* View labels */}
      {VIEWS.map(view => (
        <text
          key={view}
          x={LABEL[view].x} y={LABEL[view].y}
          textAnchor="middle"
          fontSize="7" fontWeight="700"
          fill="#9CA3AF"
          style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.6px' }}
        >
          {LABEL[view].text}
        </text>
      ))}

      {/* 5 orthographic views */}
      {VIEWS.map(view => (
        <ViewGroup
          key={view}
          view={view}
          damages={damages}
          onZoneClick={onZoneClick}
          readonly={readonly}
        />
      ))}
    </svg>
  )
}
