import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ClipboardList } from 'lucide-react'
import SmartSearch from '@/components/ui/SmartSearch'
import { formatPrice } from '@/lib/utils'
import DeleteReservationButton from './DeleteReservationButton'
import PaymentCountdownMini from './PaymentCountdownMini'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList'

// ─── Statuts ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bar: string; badge: string }> = {
  option:    { label: 'À venir',     bar: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-600' },
  confirmee: { label: 'Confirmée',  bar: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700' },
  en_cours:  { label: 'En location', bar: 'bg-green-500', badge: 'bg-green-50 text-green-700' },
  en_retard: { label: 'En retard',  bar: 'bg-red-500',    badge: 'bg-red-50 text-red-700' },
  terminee:  { label: 'Terminée',   bar: 'bg-gray-200',   badge: 'bg-gray-100 text-gray-500' },
  annulee:   { label: 'Annulée',    bar: 'bg-gray-100',   badge: 'bg-gray-50 text-gray-400' },
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vehicle?: string; q?: string }>
}) {
  const { status, vehicle, q } = await searchParams
  const supabase = await createClient()

  // Mise à jour auto des retards
  await supabase
    .from('reservations')
    .update({ status: 'en_retard' })
    .eq('status', 'en_cours')
    .lt('end_datetime', new Date().toISOString())

  // Compteurs par statut (avant filtre)
  const { data: allRes } = await supabase
    .from('reservations')
    .select('status')
  const counts: Record<string, number> = {}
  for (const r of allRes ?? []) {
    counts[r.status] = (counts[r.status] ?? 0) + 1
  }

  // Requête filtrée
  let query = supabase
    .from('reservations')
    .select(
      '*, vehicle:vehicles(plate, brand, model, color), client:clients(first_name, last_name, phone)'
    )
    .order('start_datetime', { ascending: false })

  if (status)  query = query.eq('status', status)
  if (vehicle) query = query.eq('vehicle_id', vehicle)

  const { data: rawReservations } = await query

  // Recherche texte (n° réservation, véhicule, client) — filtrée en JS pour
  // couvrir les colonnes jointes sans complexifier la requête PostgREST.
  const needle = q?.trim().toLowerCase()
  const reservations = needle
    ? (rawReservations ?? []).filter(r => {
        const v = r.vehicle as any
        const c = r.client as any
        const haystack = [
          r.reservation_number, v?.plate, v?.brand, v?.model, c?.first_name, c?.last_name, c?.phone,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(needle)
      })
    : (rawReservations ?? [])

  const statuses = ['option', 'confirmee', 'en_cours', 'en_retard', 'terminee', 'annulee']
  const total = reservations.length

  return (
    <div className="space-y-4">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900">Réservations</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} résultat{total !== 1 ? 's' : ''}
            {counts['en_retard'] > 0 && (
              <span className="ml-2 text-red-500 font-semibold">
                · {counts['en_retard']} en retard
              </span>
            )}
          </p>
        </div>
        <Link
          href="/reservations/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors text-sm active:scale-[.98]"
        >
          <Plus className="w-4 h-4" />
          Nouvelle
        </Link>
      </div>

      {/* Recherche */}
      <form method="get">
        {status && <input type="hidden" name="status" value={status} />}
        {vehicle && <input type="hidden" name="vehicle" value={vehicle} />}
        <SmartSearch name="q" placeholder="Rechercher par n°, véhicule, client…" scope="reservations" defaultValue={q ?? ''} />
      </form>

      {/* Filtres statut — scroll horizontal */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        <Link
          href="/reservations"
          className={`px-3.5 py-2 min-h-[44px] flex items-center rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
            !status ? 'bg-[#111111] text-white' : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
          }`}
        >
          Toutes
          {allRes && <span className="ml-1.5 opacity-60">({allRes.length})</span>}
        </Link>
        {statuses.map(s => {
          const cfg = STATUS_CONFIG[s] ?? { label: s, badge: '', bar: '' }
          const count = counts[s] ?? 0
          if (count === 0 && status !== s) return null
          return (
            <Link
              key={s}
              href={`/reservations?status=${s}`}
              className={`px-3.5 py-2 min-h-[44px] flex items-center rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                status === s
                  ? 'bg-[#111111] text-white'
                  : 'bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 shadow-sm'
              }`}
            >
              {cfg.label}
              {count > 0 && <span className="ml-1.5 opacity-60">({count})</span>}
            </Link>
          )
        })}
      </div>

      {/* Liste */}
      {total === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-medium text-sm">
            {needle ? `Aucun résultat pour « ${q} »` : 'Aucune réservation'}
          </p>
          <Link
            href="/reservations/new"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-black underline underline-offset-2"
          >
            <Plus className="w-4 h-4" /> Créer une réservation
          </Link>
        </div>
      ) : (
        <AnimatedList className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {reservations.map(r => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.option
            const v   = r.vehicle as any
            const c   = r.client as any
            const startDate = new Date(r.start_datetime)
            const endDate   = new Date(r.end_datetime)

            // Chrono acompte : 2 h depuis la création tant que l'option attend son acompte.
            const acompteDeadline = r.status === 'option' && r.payment_status === 'en_attente' && (r as any).created_at
              ? new Date(new Date((r as any).created_at).getTime() + 2 * 60 * 60 * 1000).toISOString()
              : null

            return (
              <AnimatedListItem key={r.id}>
              <div className="flex items-stretch hover:bg-gray-50/80 transition-colors group">
                {/* Barre statut gauche */}
                <div className={`w-1 flex-shrink-0 ${cfg.bar}`} />

                <Link
                  href={`/reservations/${r.id}`}
                  className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5"
                >
                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    {/* Ligne 1 : plaque + véhicule + badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-gray-900 text-sm">
                        {v?.brand} {v?.model}{v?.color ? ` · ${v.color}` : ''}
                      </span>
                      <span className="font-mono text-gray-400 text-xs">
                        {v?.plate}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {/* Ligne 2 : client */}
                    <div className="text-sm font-semibold text-gray-800 mt-0.5">
                      {c?.first_name} {c?.last_name}
                    </div>
                    {/* Ligne 3 : dates + n° + countdown paiement */}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {format(startDate, 'd MMM', { locale: fr })}
                        {' → '}
                        {format(endDate, 'd MMM yyyy', { locale: fr })}
                      </span>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-300 font-mono">{r.reservation_number}</span>
                      {acompteDeadline && (
                        <PaymentCountdownMini reservationId={r.id} deadline={acompteDeadline} />
                      )}
                    </div>
                  </div>

                  {/* Prix */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-base font-extrabold text-gray-900">
                      {formatPrice(r.total_price)}
                    </span>
                  </div>
                </Link>

                {/* Bouton supprimer */}
                <div className="flex items-center pr-3 flex-shrink-0">
                  <DeleteReservationButton
                    reservationId={r.id}
                    reservationNumber={r.reservation_number}
                  />
                </div>
              </div>
              </AnimatedListItem>
            )
          })}
        </AnimatedList>
      )}
    </div>
  )
}
