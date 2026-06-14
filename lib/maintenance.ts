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
