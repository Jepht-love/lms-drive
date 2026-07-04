import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Wrench, HelpCircle, ChevronRight } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatDate } from '@/lib/utils'
import { maintenanceType } from '@/lib/maintenance'

// Statuts considérés « immobilisés » — identique au filtre de /vehicles, mais
// cette page explique POURQUOI chaque véhicule l'est (sinistre en cours,
// entretien en cours, ou statut posé manuellement sans dossier source).
// « mis_a_disposition » exclu : chez un partenaire ≠ immobilisé (génère du
// revenu) → il vit dans son propre filtre « Chez partenaire » sur la flotte.
const IMMOBILISES_STATUSES = ['maintenance', 'hors_service', 'en_verification', 'immobilise', 'a_reparer']

const STATUS_LABEL: Record<string, string> = {
  maintenance:        'En entretien',
  hors_service:       'Hors service',
  en_verification:    'En vérification (sinistre)',
  immobilise:         'Immobilisé',
  a_reparer:          'À réparer',
}

interface OpenAccident { id: string; vehicle_id: string; description: string | null; accident_date: string; status: string }
interface RecentMaintenance { id: string; vehicle_id: string; type: string; date: string; description: string | null }

export default async function ImmobilisesPage() {
  const supabase = await createClient()

  const { data: vehiclesRaw } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, status')
    .eq('is_active', true)
    .in('status', IMMOBILISES_STATUSES)

  // Exclut les véhicules partenaires temporaires (inter-agences), comme sur le
  // dashboard — requête séparée tolérante à l'absence de la colonne avant 035.
  const { data: externalRows } = await supabase.from('vehicles').select('id').eq('is_external', true)
  const externalIds = new Set((externalRows ?? []).map(v => v.id))
  const vehicles = (vehiclesRaw ?? []).filter(v => !externalIds.has(v.id))
  const vehicleIds = vehicles.map(v => v.id)

  // Sinistre en cours (non clôturé) par véhicule
  const { data: openAccidents } = vehicleIds.length
    ? await supabase
        .from('accidents')
        .select('id, vehicle_id, description, accident_date, status')
        .in('vehicle_id', vehicleIds)
        .neq('status', 'cloture')
        .order('accident_date', { ascending: false })
    : { data: [] }
  const accidentByVehicle = new Map<string, OpenAccident>()
  for (const a of (openAccidents ?? []) as OpenAccident[]) {
    if (!accidentByVehicle.has(a.vehicle_id)) accidentByVehicle.set(a.vehicle_id, a)
  }

  // Dernière intervention atelier par véhicule (raison la plus probable d'un statut "maintenance")
  const { data: recentMaintenance } = vehicleIds.length
    ? await supabase
        .from('maintenance_records')
        .select('id, vehicle_id, type, date, description')
        .in('vehicle_id', vehicleIds)
        .order('date', { ascending: false })
    : { data: [] }
  const maintenanceByVehicle = new Map<string, RecentMaintenance>()
  for (const m of (recentMaintenance ?? []) as RecentMaintenance[]) {
    if (!maintenanceByVehicle.has(m.vehicle_id)) maintenanceByVehicle.set(m.vehicle_id, m)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/" className="p-2 hover:bg-white rounded-xl transition-colors min-h-[auto]">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <h1 className="text-xl font-black text-gray-900">Véhicules immobilisés</h1>
      </div>

      {vehicles.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
          <p className="text-sm text-gray-400 font-medium">Aucun véhicule immobilisé actuellement.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {vehicles.map(v => {
            const accident = accidentByVehicle.get(v.id)
            const maint    = v.status === 'maintenance' ? maintenanceByVehicle.get(v.id) : undefined

            let href = `/vehicles/${v.id}`
            let reasonIcon = <HelpCircle className="w-4 h-4 text-gray-400" />
            let reasonText = STATUS_LABEL[v.status] ?? v.status
            let reasonSub: string | null = null

            if (accident) {
              href = `/incidents/sinistres/${accident.id}`
              reasonIcon = <AlertTriangle className="w-4 h-4 text-red-500" />
              reasonText = 'Sinistre en cours'
              reasonSub = `${formatDate(accident.accident_date)} — ${(accident.description ?? '').slice(0, 60)}`
            } else if (maint) {
              href = `/maintenance/${v.id}`
              reasonIcon = <Wrench className="w-4 h-4 text-amber-500" />
              reasonText = maintenanceType(maint.type).label
              reasonSub = formatDate(maint.date)
            }

            return (
              <Link key={v.id} href={href} className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {reasonIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {v.brand} {v.model} <span className="text-gray-300 font-mono text-xs">· {v.plate}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {reasonText}{reasonSub ? ` — ${reasonSub}` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-200 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
