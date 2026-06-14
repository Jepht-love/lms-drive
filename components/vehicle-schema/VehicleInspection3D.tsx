'use client'

import { useRef, useState, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { DamageEntry } from './inspection-types'

interface ZoneDef {
  id: string
  label: string
  geo: 'box' | 'cylinder'
  pos: [number, number, number]
  args: [number, number, number, number?]
  rot?: [number, number, number]
  baseColor: string
  opacity?: number
}

const PI2 = Math.PI / 2

const ZONES: ZoneDef[] = [
  // ROUES
  { id: 'jante-av-gauche',      label: 'Jante avant gauche',    geo: 'cylinder', pos: [-0.95, 0.30, -1.15], args: [0.29, 0.29, 0.22, 32], rot: [0, 0, PI2],  baseColor: '#334155' },
  { id: 'jante-av-droite',      label: 'Jante avant droite',    geo: 'cylinder', pos: [ 0.95, 0.30, -1.15], args: [0.29, 0.29, 0.22, 32], rot: [0, 0, PI2],  baseColor: '#334155' },
  { id: 'jante-ar-gauche',      label: 'Jante arrière gauche',  geo: 'cylinder', pos: [-0.95, 0.30,  1.15], args: [0.29, 0.29, 0.22, 32], rot: [0, 0, PI2],  baseColor: '#334155' },
  { id: 'jante-ar-droite',      label: 'Jante arrière droite',  geo: 'cylinder', pos: [ 0.95, 0.30,  1.15], args: [0.29, 0.29, 0.22, 32], rot: [0, 0, PI2],  baseColor: '#334155' },

  // SURFACES DU DESSUS
  { id: 'capot',                label: 'Capot',                 geo: 'box',      pos: [0, 1.07, -1.38],    args: [1.80, 0.04, 1.28],     baseColor: '#E2E8F0' },
  { id: 'toit',                 label: 'Toit',                  geo: 'box',      pos: [0, 1.67,  0.08],    args: [1.62, 0.04, 2.22],     baseColor: '#E2E8F0' },
  { id: 'coffre',               label: 'Coffre',                geo: 'box',      pos: [0, 1.07,  1.48],    args: [1.80, 0.04, 0.88],     baseColor: '#E2E8F0' },

  // VITRES INCLINÉES
  { id: 'pare-brise',           label: 'Pare-brise',            geo: 'box',      pos: [0, 1.34, -0.68],    args: [1.56, 0.04, 0.72],     rot: [-0.62, 0, 0], baseColor: '#BAE6FD', opacity: 0.78 },
  { id: 'lunette-arriere',      label: 'Lunette arrière',       geo: 'box',      pos: [0, 1.28,  0.94],    args: [1.48, 0.04, 0.66],     rot: [ 0.55, 0, 0], baseColor: '#BAE6FD', opacity: 0.78 },

  // FACE AVANT
  { id: 'pare-chocs-avant',     label: 'Pare-chocs avant',      geo: 'box',      pos: [0,     0.37, -2.03], args: [1.82, 0.38, 0.04],    baseColor: '#CBD5E1' },
  { id: 'calandre',             label: 'Calandre',              geo: 'box',      pos: [0,     0.78, -2.02], args: [0.82, 0.24, 0.04],    baseColor: '#475569' },
  { id: 'phare-gauche',         label: 'Phare gauche',          geo: 'box',      pos: [-0.68, 0.87, -2.02], args: [0.42, 0.20, 0.04],   baseColor: '#FEF3C7' },
  { id: 'phare-droit',          label: 'Phare droit',           geo: 'box',      pos: [ 0.68, 0.87, -2.02], args: [0.42, 0.20, 0.04],   baseColor: '#FEF3C7' },
  { id: 'plaque-avant',         label: 'Plaque avant',          geo: 'box',      pos: [0,     0.60, -2.03], args: [0.46, 0.14, 0.04],   baseColor: '#F8FAFC' },

  // FACE ARRIÈRE
  { id: 'pare-chocs-arriere',   label: 'Pare-chocs arrière',    geo: 'box',      pos: [0,     0.37,  2.03], args: [1.82, 0.38, 0.04],   baseColor: '#CBD5E1' },
  { id: 'feu-arriere-gauche',   label: 'Feu arrière gauche',    geo: 'box',      pos: [-0.68, 0.84,  2.02], args: [0.44, 0.24, 0.04],  baseColor: '#FECACA' },
  { id: 'feu-arriere-droit',    label: 'Feu arrière droit',     geo: 'box',      pos: [ 0.68, 0.84,  2.02], args: [0.44, 0.24, 0.04],  baseColor: '#FECACA' },
  { id: 'plaque-arriere',       label: 'Plaque arrière',        geo: 'box',      pos: [0,     0.60,  2.03], args: [0.46, 0.14, 0.04],  baseColor: '#F8FAFC' },

  // RÉTROVISEURS
  { id: 'retroviseur-gauche',   label: 'Rétroviseur gauche',    geo: 'box',      pos: [-1.04, 1.10, -0.60], args: [0.10, 0.10, 0.24],  baseColor: '#94A3B8' },
  { id: 'retroviseur-droit',    label: 'Rétroviseur droit',     geo: 'box',      pos: [ 1.04, 1.10, -0.60], args: [0.10, 0.10, 0.24],  baseColor: '#94A3B8' },

  // FLANC GAUCHE
  { id: 'aile-avant-gauche',    label: 'Aile avant gauche',     geo: 'box',      pos: [-0.96, 0.65, -1.50], args: [0.04, 0.76, 1.00],  baseColor: '#E2E8F0' },
  { id: 'porte-avant-gauche',   label: 'Porte avant gauche',    geo: 'box',      pos: [-0.96, 0.65, -0.28], args: [0.04, 0.74, 1.22],  baseColor: '#E2E8F0' },
  { id: 'porte-arriere-gauche', label: 'Porte arrière gauche',  geo: 'box',      pos: [-0.96, 0.65,  0.90], args: [0.04, 0.74, 1.22],  baseColor: '#E2E8F0' },
  { id: 'aile-arriere-gauche',  label: 'Aile arrière gauche',   geo: 'box',      pos: [-0.96, 0.65,  1.82], args: [0.04, 0.76, 0.52],  baseColor: '#E2E8F0' },
  { id: 'vitre-avant-gauche',   label: 'Vitre avant gauche',    geo: 'box',      pos: [-0.96, 1.28, -0.28], args: [0.04, 0.34, 1.02],  baseColor: '#BAE6FD', opacity: 0.78 },
  { id: 'vitre-arriere-gauche', label: 'Vitre arrière gauche',  geo: 'box',      pos: [-0.96, 1.28,  0.90], args: [0.04, 0.28, 1.10],  baseColor: '#BAE6FD', opacity: 0.78 },
  { id: 'bas-de-caisse-gauche', label: 'Bas de caisse gauche',  geo: 'box',      pos: [-0.96, 0.27,  0.15], args: [0.04, 0.12, 2.55],  baseColor: '#94A3B8' },

  // FLANC DROIT
  { id: 'aile-avant-droite',    label: 'Aile avant droite',     geo: 'box',      pos: [ 0.96, 0.65, -1.50], args: [0.04, 0.76, 1.00],  baseColor: '#E2E8F0' },
  { id: 'porte-avant-droite',   label: 'Porte avant droite',    geo: 'box',      pos: [ 0.96, 0.65, -0.28], args: [0.04, 0.74, 1.22],  baseColor: '#E2E8F0' },
  { id: 'porte-arriere-droite', label: 'Porte arrière droite',  geo: 'box',      pos: [ 0.96, 0.65,  0.90], args: [0.04, 0.74, 1.22],  baseColor: '#E2E8F0' },
  { id: 'aile-arriere-droite',  label: 'Aile arrière droite',   geo: 'box',      pos: [ 0.96, 0.65,  1.82], args: [0.04, 0.76, 0.52],  baseColor: '#E2E8F0' },
  { id: 'vitre-avant-droite',   label: 'Vitre avant droite',    geo: 'box',      pos: [ 0.96, 1.28, -0.28], args: [0.04, 0.34, 1.02],  baseColor: '#BAE6FD', opacity: 0.78 },
  { id: 'vitre-arriere-droite', label: 'Vitre arrière droite',  geo: 'box',      pos: [ 0.96, 1.28,  0.90], args: [0.04, 0.28, 1.10],  baseColor: '#BAE6FD', opacity: 0.78 },
  { id: 'bas-de-caisse-droite', label: 'Bas de caisse droite',  geo: 'box',      pos: [ 0.96, 0.27,  0.15], args: [0.04, 0.12, 2.55],  baseColor: '#94A3B8' },
]

interface ZoneMeshProps {
  def: ZoneDef
  hasDamage: boolean
  readonly: boolean
  onZoneClick: (id: string) => void
  onHover: (label: string | null) => void
}

function ZoneMesh({ def, hasDamage, readonly, onZoneClick, onHover }: ZoneMeshProps) {
  const [hovered, setHovered] = useState(false)
  const ref = useRef<THREE.Mesh>(null)

  const color = hasDamage
    ? (hovered ? '#B91C1C' : '#EF4444')
    : hovered && !readonly
      ? '#93C5FD'
      : def.baseColor

  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (!readonly) onZoneClick(def.id)
  }, [readonly, onZoneClick, def.id])

  const handlePointerOver = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setHovered(true)
    onHover(def.label)
    if (!readonly) document.body.style.cursor = 'pointer'
  }, [readonly, onHover, def.label])

  const handlePointerOut = useCallback(() => {
    setHovered(false)
    onHover(null)
    document.body.style.cursor = 'auto'
  }, [onHover])

  const euler = def.rot ? new THREE.Euler(...def.rot) : undefined

  return (
    <mesh
      ref={ref}
      position={def.pos}
      rotation={euler}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {def.geo === 'box' ? (
        <boxGeometry args={[def.args[0], def.args[1], def.args[2]]} />
      ) : (
        <cylinderGeometry args={[def.args[0], def.args[1], def.args[2], def.args[3] ?? 32]} />
      )}
      <meshStandardMaterial
        color={color}
        transparent={!!def.opacity}
        opacity={def.opacity ?? 1}
        roughness={def.id.includes('vitre') || def.id.includes('pare-brise') || def.id.includes('lunette') ? 0.1 : def.id.includes('jante') ? 0.8 : 0.5}
        metalness={def.id.includes('jante') ? 0.4 : 0.05}
      />
    </mesh>
  )
}

function CarBody() {
  return (
    <group>
      {/* Carrosserie basse */}
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[1.88, 0.80, 4.14]} />
        <meshStandardMaterial color="#64748B" roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Habitacle */}
      <mesh position={[0, 1.35, 0.08]}>
        <boxGeometry args={[1.68, 0.62, 2.26]} />
        <meshStandardMaterial color="#64748B" roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Sol / ombre */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 5.2]} />
        <meshStandardMaterial color="#E2E8F0" roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

function Scene({
  damages,
  readonly,
  onZoneClick,
  onHover,
}: {
  damages: Record<string, DamageEntry[]>
  readonly: boolean
  onZoneClick: (id: string) => void
  onHover: (label: string | null) => void
}) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 8, -3]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 4, 5]} intensity={0.4} />
      <pointLight position={[0, 5, 0]} intensity={0.3} />

      <CarBody />

      {ZONES.map(def => (
        <ZoneMesh
          key={def.id}
          def={def}
          hasDamage={(damages[def.id]?.length ?? 0) > 0}
          readonly={readonly}
          onZoneClick={onZoneClick}
          onHover={onHover}
        />
      ))}

      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={9}
        maxPolarAngle={Math.PI * 0.55}
        target={[0, 0.7, 0]}
        makeDefault
      />
    </>
  )
}

export interface VehicleInspection3DProps {
  damages: Record<string, DamageEntry[]>
  onZoneClick: (zoneId: string) => void
  readonly?: boolean
}

export default function VehicleInspection3D({ damages, onZoneClick, readonly = false }: VehicleInspection3DProps) {
  const [tooltip, setTooltip] = useState<string | null>(null)
  const damageCount = Object.values(damages).filter(v => v.length > 0).length

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ height: 360 }}>
      <Canvas
        camera={{ position: [3.2, 2.4, 5.0], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: '#F8FAFC' }}
      >
        <Suspense fallback={null}>
          <Scene
            damages={damages}
            readonly={readonly}
            onZoneClick={onZoneClick}
            onHover={setTooltip}
          />
        </Suspense>
      </Canvas>

      {/* Tooltip zone survolée */}
      {tooltip && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none">
          <span className="bg-gray-900/80 text-white text-[11px] font-medium rounded-full px-3 py-1 shadow-lg">
            {tooltip}
          </span>
        </div>
      )}

      {/* Compteur de dommages */}
      {damageCount > 0 && (
        <div className="absolute top-3 right-3 bg-red-500 text-white text-[11px] font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
          {damageCount}
        </div>
      )}

      {/* Hint controls */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
        <span className="text-[10px] text-gray-400">
          Tourner · Pincer pour zoomer{!readonly && ' · Toucher pour inspecter'}
        </span>
      </div>
    </div>
  )
}
