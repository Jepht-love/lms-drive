import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Car, Wrench, Search } from 'lucide-react'
import VehiclesGridSwipeable from './VehiclesGridSwipeable'
import type { Vehicle } from '@/types/database'
import {
  computeVehicleNeeds,
  buildLastByType,
  groupNeedsForBadges,
  vehicleMatchesCategory,
  MAINTENANCE_CATEGORIES,
  type VehicleNeed,
  type NeedBadge,
} from '@/lib/maintenance-health'

// Statuts considérés « immobilisés » (entretien · réparation · sinistre · CT · etc.)
// — doit rester aligné avec le compteur IMMOBILISÉS du tableau de bord.
const IMMOBILISES_STATUSES = ['maintenance', 'hors_service', 'en_verification', 'immobilise', 'mis_a_disposition', 'a_reparer']

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
  a_reparer:         { label: 'À réparer',       dot: 'bg-red-600' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; need?: string; q?: string }>
}) {
  const { status, need, q } = await searchParams
  const supabase = await createClient()

  const { data: vehiclesRaw } = await supabase
    .from('vehicles')
    .select('*')
    .eq('is_active', true)
    .order('brand')

  const allVehicles = (vehiclesRaw ?? []) as Vehicle[]

  // Date de retour (la plus tardive parmi les réservations actives/à venir non
  // annulées) pour chaque véhicule loué/réservé — affichée au-dessus du bouton
  // "Réserver après" pour savoir à partir de quand le véhicule est libre.
  const busyVehicleIds = allVehicles.filter(v => ['loue', 'reserve'].includes(v.status)).map(v => v.id)
  const returnDateByVehicle: Record<string, string> = {}
  if (busyVehicleIds.length > 0) {
    const { data: activeReservations } = await supabase
      .from('reservations')
      .select('vehicle_id, end_datetime, status')
      .in('vehicle_id', busyVehicleIds)
      .not('status', 'in', '("annulee","terminee")')

    const activeStatusesByVehicle = new Map<string, string[]>()
    for (const r of activeReservations ?? []) {
      if (r.end_datetime) {
        const current = returnDateByVehicle[r.vehicle_id]
        if (!current || r.end_datetime > current) {
          returnDateByVehicle[r.vehicle_id] = r.end_datetime
        }
      }
      const arr = activeStatusesByVehicle.get(r.vehicle_id) ?? []
      arr.push(r.status)
      activeStatusesByVehicle.set(r.vehicle_id, arr)
    }

    // Réconciliation des statuts : un véhicule marqué loué/réservé mais SANS
    // réservation active correspondante (statut forcé à la main, réservation
    // supprimée, contrat clôturé sans repasser le véhicule à disponible…) est
    // remis au statut réellement dérivé des réservations. Corrige les orphelins
    // « loué sans date de retour ni contrat » (ex. BMW i8) dès l'ouverture de la
    // flotte. Même dérivation que recomputeVehicleStatus ; idempotent : n'écrit
    // qu'en cas d'écart, et corrige aussi l'affichage en mémoire immédiatement.
    const toPersist: string[] = []
    for (const v of allVehicles) {
      if (!['loue', 'reserve'].includes(v.status)) continue
      const statuses = activeStatusesByVehicle.get(v.id) ?? []
      const hasOngoing  = statuses.some(s => ['en_cours', 'en_retard'].includes(s))
      const hasUpcoming = statuses.some(s => ['confirmee', 'option'].includes(s))
      const next = hasOngoing ? 'loue' : hasUpcoming ? 'reserve' : 'disponible'
      if (next !== v.status) {
        v.status = next
        toPersist.push(v.id)
      }
    }
    if (toPersist.length > 0) {
      await Promise.all(
        toPersist.map(id =>
          supabase.from('vehicles').update({ status: allVehicles.find(x => x.id === id)!.status }).eq('id', id),
        ),
      )
    }
  }

  // Derniers entretiens par véhicule (records triés date desc → moteur d'échéances)
  const { data: records } = await supabase
    .from('maintenance_records')
    .select('vehicle_id, type, km_at_intervention, date')
    .order('date', { ascending: false })

  const recordsByVehicle = new Map<string, { type: string; km_at_intervention: number | null; date: string }[]>()
  for (const r of records ?? []) {
    const arr = recordsByVehicle.get(r.vehicle_id) ?? []
    arr.push(r)
    recordsByVehicle.set(r.vehicle_id, arr)
  }

  const now = new Date()
  const rawNeeds: Record<string, VehicleNeed[]> = {}
  const needsByVehicle: Record<string, NeedBadge[]> = {}
  for (const v of allVehicles) {
    const lastByType = buildLastByType(recordsByVehicle.get(v.id) ?? [])
    const needs = computeVehicleNeeds(v, lastByType, now)
    rawNeeds[v.id] = needs
    needsByVehicle[v.id] = groupNeedsForBadges(needs)
  }

  // Compteurs statut
  const counts: Record<string, number> = {}
  for (const v of allVehicles) counts[v.status] = (counts[v.status] ?? 0) + 1

  // Compteurs maintenance par catégorie (Garage / Vidange / Pneus / Dégradé)
  const needCounts: Record<string, number> = {}
  for (const cat of MAINTENANCE_CATEGORIES) {
    needCounts[cat.id] = allVehicles.filter(v => vehicleMatchesCategory(rawNeeds[v.id] ?? [], cat.id)).length
  }
  const hasNeeds = Object.values(needCounts).some(c => c > 0)

  // Filtres (statut OU groupe « immobilisés » OU besoin maintenance) appliqués en JS
  const matchesStatus = (v: Vehicle) =>
    !status ||
    (status === 'immobilises' ? IMMOBILISES_STATUSES.includes(v.status) : v.status === status)
  const needle = q?.trim().toLowerCase()
  const vehicles = allVehicles.filter(v =>
    matchesStatus(v) &&
    (!need || vehicleMatchesCategory(rawNeeds[v.id] ?? [], need)) &&
    (!needle || [v.plate, v.brand, v.model, v.version, v.color].filter(Boolean).join(' ').toLowerCase().includes(needle)),
  )

  const total = allVehicles.length
  const immobilisesCount = allVehicles.filter(v => IMMOBILISES_STATUSES.includes(v.status)).length

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

      {/* Recherche */}
      <form method="get" className="relative">
        {status && <input type="hidden" name="status" value={status} />}
        {need && <input type="hidden" name="need" value={need} />}
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Rechercher par plaque, marque, modèle…"
          className="w-full bg-white border border-gray-100 shadow-sm rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </form>

      {/* Statut filters */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <Link
          href="/vehicles"
          className={`px-3.5 py-2 min-h-[44px] flex items-center rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
            !status && !need ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
          }`}
        >
          Tous ({total})
        </Link>
        {immobilisesCount > 0 && (
          <Link
            href="/vehicles/immobilises"
            className="px-3.5 py-2 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 bg-white border border-orange-100 text-orange-600 hover:bg-orange-50 shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-orange-400" />
            Immobilisés ({immobilisesCount})
          </Link>
        )}
        {Object.entries(STATUS_CONFIG).map(([s, cfg]) => {
          const count = counts[s] ?? 0
          if (count === 0 && status !== s) return null
          return (
            <Link
              key={s}
              href={`/vehicles?status=${s}`}
              className={`px-3.5 py-2 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 ${
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

      {/* Filtres maintenance — quoi faire passer au garage / vidange / pneus / dégradé */}
      {hasNeeds && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {MAINTENANCE_CATEGORIES.map(cat => {
            const count = needCounts[cat.id] ?? 0
            if (count === 0 && need !== cat.id) return null
            const active = need === cat.id
            return (
              <Link
                key={cat.id}
                href={active ? '/vehicles' : `/vehicles?need=${cat.id}`}
                className={`px-3.5 py-2 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-red-600 text-white'
                    : 'bg-white border border-red-100 text-red-600 hover:bg-red-50 shadow-sm'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                {cat.label}
                <span className="opacity-70">({count})</span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Grille */}
      {total === 0 ? (
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
      ) : vehicles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Car className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">
            {needle ? `Aucun résultat pour « ${q} »` : 'Aucun véhicule pour ce filtre'}
          </p>
          <Link href="/vehicles" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-black underline underline-offset-2">
            Réinitialiser les filtres
          </Link>
        </div>
      ) : (
        <VehiclesGridSwipeable vehicles={vehicles} needsByVehicle={needsByVehicle} returnDateByVehicle={returnDateByVehicle} />
      )}
    </div>
  )
}
