// ─── Module Entretien — constantes & types partagés ───────────────────────────

export interface MaintenanceRecord {
  id: string
  vehicle_id: string
  type: string
  description: string | null
  date: string
  km_at_intervention: number | null
  amount: number | null
  provider: string | null
  invoice_url: string | null
  notes: string | null
  paid_at: string | null        // date de règlement → déclenche la dépense en compta
  paid_method: string | null    // mode de paiement du règlement
  created_at: string
}

export interface MaintenanceType {
  key: string
  label: string
  dot: string
}

export const MAINTENANCE_TYPES: MaintenanceType[] = [
  { key: 'carburant',          label: 'Carburant',          dot: 'bg-blue-500' },
  { key: 'lavage',             label: 'Lavage',             dot: 'bg-cyan-500' },
  { key: 'revision',           label: 'Révision',           dot: 'bg-amber-500' },
  { key: 'vidange',            label: 'Vidange',            dot: 'bg-orange-500' },
  { key: 'pneus',              label: 'Pneus',              dot: 'bg-gray-500' },
  { key: 'freins',             label: 'Freins',             dot: 'bg-red-500' },
  { key: 'reparation',         label: 'Réparation',         dot: 'bg-purple-500' },
  { key: 'carrosserie',        label: 'Carrosserie',        dot: 'bg-indigo-500' },
  { key: 'controle_technique', label: 'Contrôle technique', dot: 'bg-green-600' },
  { key: 'autre',              label: 'Autre',              dot: 'bg-gray-400' },
]

const TYPE_MAP: Record<string, MaintenanceType> = Object.fromEntries(
  MAINTENANCE_TYPES.map(t => [t.key, t])
)

export function maintenanceType(key: string): MaintenanceType {
  return TYPE_MAP[key] ?? MAINTENANCE_TYPES[MAINTENANCE_TYPES.length - 1]
}

// ─── Angles d'entretien ───────────────────────────────────────────────────────
// Le gérant veut voir l'entretien sous 3 angles regroupant les types, classés
// par ordre de priorité (Réparation la plus urgente en tête). « Budget réparation »
// = le total de l'angle Réparation. Chaque type appartient à exactement un angle.
export type MaintenanceAngleId = 'reparation' | 'usure' | 'entretien' | 'autre'

export interface MaintenanceAngle {
  id: MaintenanceAngleId
  label: string
  types: string[]
  dot: string
}

export const MAINTENANCE_ANGLES: MaintenanceAngle[] = [
  { id: 'reparation', label: 'Réparation', types: ['reparation', 'carrosserie'], dot: 'bg-purple-500' },
  { id: 'usure',      label: 'Usure',      types: ['pneus', 'freins'], dot: 'bg-red-500' },
  { id: 'entretien',  label: 'Entretien',  types: ['revision', 'vidange', 'controle_technique', 'lavage'], dot: 'bg-amber-500' },
  { id: 'autre',      label: 'Autre',      types: ['carburant', 'autre'], dot: 'bg-gray-400' },
]

const ANGLE_OF_TYPE: Record<string, MaintenanceAngleId> = Object.fromEntries(
  MAINTENANCE_ANGLES.flatMap(a => a.types.map(t => [t, a.id] as const))
)

export function angleOfType(typeKey: string): MaintenanceAngleId {
  return ANGLE_OF_TYPE[typeKey] ?? 'autre'
}
