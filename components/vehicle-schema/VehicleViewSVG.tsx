'use client'

import { motion } from 'framer-motion'
import { VEHICLE_ZONES, type VehicleView, type DamageEntry } from './inspection-types'

interface VehicleViewSVGProps {
  view: VehicleView
  damages: Record<string, DamageEntry[]>
  onZoneClick: (zoneId: string) => void
}

type ZoneCoord = { x: number; y: number; w: number; h: number; rx?: number }

const ZONE_COORDS: Record<VehicleView, Record<string, ZoneCoord>> = {
  top: {
    capot:                  { x: 30,  y: 20,  w: 180, h: 85,  rx: 15 },
    'pare-brise':           { x: 40,  y: 105, w: 160, h: 18,  rx: 4 },
    toit:                   { x: 40,  y: 123, w: 160, h: 152, rx: 6 },
    'lunette-arriere':      { x: 40,  y: 275, w: 160, h: 18,  rx: 4 },
    coffre:                 { x: 30,  y: 293, w: 180, h: 107, rx: 15 },
    'retroviseur-gauche':   { x: 6,   y: 128, w: 20,  h: 38,  rx: 8 },
    'retroviseur-droit':    { x: 214, y: 128, w: 20,  h: 38,  rx: 8 },
    'jante-av-gauche':      { x: 12,  y: 58,  w: 24,  h: 52,  rx: 10 },
    'jante-av-droite':      { x: 204, y: 58,  w: 24,  h: 52,  rx: 10 },
    'jante-ar-gauche':      { x: 12,  y: 310, w: 24,  h: 52,  rx: 10 },
    'jante-ar-droite':      { x: 204, y: 310, w: 24,  h: 52,  rx: 10 },
  },
  front: {
    'pare-brise':           { x: 60,  y: 14,  w: 120, h: 20,  rx: 4 },
    capot:                  { x: 50,  y: 36,  w: 140, h: 20,  rx: 4 },
    'phare-gauche':         { x: 44,  y: 58,  w: 42,  h: 30,  rx: 8 },
    calandre:               { x: 88,  y: 58,  w: 64,  h: 38,  rx: 8 },
    'phare-droit':          { x: 154, y: 58,  w: 42,  h: 30,  rx: 8 },
    'aile-avant-gauche':    { x: 38,  y: 88,  w: 38,  h: 64,  rx: 10 },
    'aile-avant-droite':    { x: 164, y: 88,  w: 38,  h: 64,  rx: 10 },
    'pare-chocs-avant':     { x: 44,  y: 150, w: 152, h: 22,  rx: 10 },
    'plaque-avant':         { x: 98,  y: 156, w: 44,  h: 12,  rx: 2 },
    'jante-av-gauche':      { x: 28,  y: 144, w: 34,  h: 32,  rx: 16 },
    'jante-av-droite':      { x: 178, y: 144, w: 34,  h: 32,  rx: 16 },
  },
  rear: {
    'lunette-arriere':      { x: 60,  y: 14,  w: 120, h: 20,  rx: 4 },
    coffre:                 { x: 50,  y: 36,  w: 140, h: 20,  rx: 4 },
    'feu-arriere-gauche':   { x: 44,  y: 58,  w: 42,  h: 30,  rx: 8 },
    'feu-arriere-droit':    { x: 154, y: 58,  w: 42,  h: 30,  rx: 8 },
    'aile-arriere-gauche':  { x: 38,  y: 88,  w: 38,  h: 64,  rx: 10 },
    'aile-arriere-droite':  { x: 164, y: 88,  w: 38,  h: 64,  rx: 10 },
    'pare-chocs-arriere':   { x: 44,  y: 150, w: 152, h: 22,  rx: 10 },
    'plaque-arriere':       { x: 98,  y: 156, w: 44,  h: 12,  rx: 2 },
    'jante-ar-gauche':      { x: 28,  y: 144, w: 34,  h: 32,  rx: 16 },
    'jante-ar-droite':      { x: 178, y: 144, w: 34,  h: 32,  rx: 16 },
  },
  left: {
    'aile-arriere-gauche':  { x: 30,  y: 38,  w: 85,  h: 78,  rx: 12 },
    'porte-arriere-gauche': { x: 118, y: 33,  w: 110, h: 88,  rx: 10 },
    'vitre-arriere-gauche': { x: 128, y: 38,  w: 95,  h: 38,  rx: 6 },
    'porte-avant-gauche':   { x: 232, y: 33,  w: 110, h: 88,  rx: 10 },
    'vitre-avant-gauche':   { x: 242, y: 38,  w: 95,  h: 38,  rx: 6 },
    'aile-avant-gauche':    { x: 345, y: 38,  w: 85,  h: 78,  rx: 12 },
    'retroviseur-gauche':   { x: 322, y: 22,  w: 22,  h: 16,  rx: 4 },
    'jante-ar-gauche':      { x: 65,  y: 112, w: 56,  h: 56,  rx: 28 },
    'jante-av-gauche':      { x: 358, y: 112, w: 56,  h: 56,  rx: 28 },
    'bas-de-caisse-gauche': { x: 112, y: 124, w: 248, h: 14,  rx: 4 },
  },
  right: {
    'aile-arriere-droite':  { x: 30,  y: 38,  w: 85,  h: 78,  rx: 12 },
    'porte-arriere-droite': { x: 118, y: 33,  w: 110, h: 88,  rx: 10 },
    'vitre-arriere-droite': { x: 128, y: 38,  w: 95,  h: 38,  rx: 6 },
    'porte-avant-droite':   { x: 232, y: 33,  w: 110, h: 88,  rx: 10 },
    'vitre-avant-droite':   { x: 242, y: 38,  w: 95,  h: 38,  rx: 6 },
    'aile-avant-droite':    { x: 345, y: 38,  w: 85,  h: 78,  rx: 12 },
    'retroviseur-droit':    { x: 322, y: 22,  w: 22,  h: 16,  rx: 4 },
    'jante-ar-droite':      { x: 65,  y: 112, w: 56,  h: 56,  rx: 28 },
    'jante-av-droite':      { x: 358, y: 112, w: 56,  h: 56,  rx: 28 },
    'bas-de-caisse-droite': { x: 112, y: 124, w: 248, h: 14,  rx: 4 },
  },
}

const VIEWBOX: Record<VehicleView, string> = {
  top:   '0 0 240 420',
  front: '0 0 240 180',
  rear:  '0 0 240 180',
  left:  '0 0 460 180',
  right: '0 0 460 180',
}

const BODY_OUTLINE: Record<VehicleView, ZoneCoord> = {
  top:   { x: 20, y: 10,  w: 200, h: 400, rx: 40 },
  front: { x: 30, y: 30,  w: 180, h: 140, rx: 20 },
  rear:  { x: 30, y: 30,  w: 180, h: 140, rx: 20 },
  left:  { x: 20, y: 25,  w: 420, h: 110, rx: 25 },
  right: { x: 20, y: 25,  w: 420, h: 110, rx: 25 },
}

export default function VehicleViewSVG({ view, damages, onZoneClick }: VehicleViewSVGProps) {
  const coords = ZONE_COORDS[view]
  const body = BODY_OUTLINE[view]
  const zonesForView = VEHICLE_ZONES.filter(z => z.views.includes(view))

  return (
    <svg viewBox={VIEWBOX[view]} xmlns="http://www.w3.org/2000/svg" className="w-full">
      {/* Silhouette fond */}
      <rect
        x={body.x} y={body.y} width={body.w} height={body.h} rx={body.rx ?? 0}
        fill="#FAFAFA" stroke="#E5E7EB" strokeWidth="1.5"
      />

      {/* Zones cliquables */}
      {zonesForView.map(zone => {
        const c = coords[zone.id]
        if (!c) return null
        const hasDamage = (damages[zone.id]?.length ?? 0) > 0
        return (
          <motion.rect
            key={zone.id}
            x={c.x} y={c.y} width={c.w} height={c.h} rx={c.rx ?? 6}
            animate={{ fill: hasDamage ? '#DC2626' : '#F3F4F6' }}
            whileHover={{ fill: hasDamage ? '#b91c1c' : '#fee2e2' }}
            transition={{ duration: 0.18 }}
            stroke="#D1D5DB"
            strokeWidth="1"
            style={{ cursor: 'pointer' }}
            onClick={() => onZoneClick(zone.id)}
          />
        )
      })}
    </svg>
  )
}
