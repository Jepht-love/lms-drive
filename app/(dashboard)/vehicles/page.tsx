import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Car } from 'lucide-react'
import VehiclesGridSwipeable from './VehiclesGridSwipeable'

// ─── Config statut (pour les filtres) ─────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  disponible:        { label: 'Disponible',      dot: 'bg-green-500' },
  loue:              { label: 'Loué',            dot: 'bg-blue-500' },
  reserve:           { label: 'Réservé',         dot: 'bg-yellow-500' },
  maintenance:       { label: 'Maintenance',     dot: 'bg-orange-400' },
  hors_service:      { label: 'Hors service',    dot: 'bg-red-500' },
  en_verification:   { label: 'Vérification',    dot: 'bg-yellow-400' },
  immobilise:        { label: 'Immobilisé',      dot: 'bg-red-400' },
  mis_a_disposition: { label: 'Chez partenaire', dot: 'bg-purple-400' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createClient()

  // Compteurs par statut
  const { data: allVehicles } = await supabase
    .from('vehicles')
    .select('id, status')
    .eq('is_active', true)

  const counts: Record<string, number> = {}
  for (const v of allVehicles ?? []) {
    counts[v.status] = (counts[v.status] ?? 0) + 1
  }

  let query = supabase
    .from('vehicles')
    .select('*')
    .eq('is_active', true)
    .order('brand')

  if (status) query = query.eq('status', status)

  const { data: vehicles } = await query

  const total = allVehicles?.length ?? 0

  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Flotte</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} véhicule{total !== 1 ? 's' : ''}
            {counts['disponible'] > 0 && (
              <span className="ml-2 text-green-600 font-semibold">· {counts['disponible']} dispo</span>
            )}
          </p>
        </div>
        <Link
          href="/vehicles/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors text-sm active:scale-[.98]"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </Link>
      </div>

      {/* Statut filters */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <Link
          href="/vehicles"
          className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
            !status ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
          }`}
        >
          Tous ({total})
        </Link>
        {Object.entries(STATUS_CONFIG).map(([s, cfg]) => {
          const count = counts[s] ?? 0
          if (count === 0 && status !== s) return null
          return (
            <Link
              key={s}
              href={`/vehicles?status=${s}`}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 ${
                status === s
                  ? 'bg-[#111111] text-white'
                  : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status === s ? 'bg-white' : cfg.dot}`} />
              {cfg.label}
              {count > 0 && <span className="opacity-60">({count})</span>}
            </Link>
          )
        })}
      </div>

      {/* Grille */}
      {!vehicles || vehicles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Car className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">Aucun véhicule dans la flotte</p>
          <Link
            href="/vehicles/new"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-black underline underline-offset-2"
          >
            <Plus className="w-4 h-4" /> Ajouter le premier véhicule
          </Link>
        </div>
      ) : (
        <VehiclesGridSwipeable vehicles={vehicles} />
      )}
    </div>
  )
}
