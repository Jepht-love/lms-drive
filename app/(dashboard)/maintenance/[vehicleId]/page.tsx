import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { formatPrice } from '@/lib/utils'
import type { MaintenanceRecord } from '@/lib/maintenance'
import type { MaintenanceFlag } from '@/types/database'
import { isManagerRole } from '@/lib/auth/roles'
import MaintenanceHistory, { type DemandeMontant } from './MaintenanceHistory'
import VehicleFacts from './VehicleFacts'

export default async function VehicleMaintenancePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>
}) {
  const { vehicleId } = await params
  const supabase = await createClient()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, current_km, next_service_km, next_service_date, last_wash_date, maintenance_flags')
    .eq('id', vehicleId)
    .single()

  if (!vehicle) notFound()

  // Les montants facturés au client ne se montrent qu'au gérant et aux associés
  // (décision de Jeff du 30/07/2026, même règle que le tableau de bord). Un employé
  // ou un prestataire voit le dégât et son type, jamais l'argent.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role, is_admin').eq('id', user.id).maybeSingle()
    : { data: null }
  const canSeeAmounts = isManagerRole((profile as { role?: string } | null)?.role)
  // Terminer ou annuler engage un montant : réservé aux managers (Jeff, 02/08/2026).
  // Faire simplement avancer une intervention reste ouvert à tout le monde.
  const canClose = Boolean(
    (profile as { is_admin?: boolean } | null)?.is_admin
    || isManagerRole((profile as { role?: string } | null)?.role),
  )

  // Les deux jointures nomment qui est concerné : la personne DÉSIGNÉE à la
  // création et celle qui s'est effectivement MISE DESSUS. Les deux peuvent
  // différer, et c'est voulu.
  const { data: records } = await supabase
    .from('maintenance_records')
    .select(`*,
      assignee:profiles!maintenance_records_assigned_to_fkey(full_name),
      taker:profiles!maintenance_records_taken_by_fkey(full_name)`)
    .eq('vehicle_id', vehicleId)
    .order('date', { ascending: false })

  // Les corrections de montant en attente : elles s'affichent sur l'intervention
  // concernée, avec les boutons Valider et Refuser pour qui a le droit.
  const { data: demandes } = await supabase
    .from('maintenance_amount_requests')
    .select(`id, maintenance_id, requested_by, old_amount, new_amount, reason,
      requester:profiles!maintenance_amount_requests_requested_by_fkey(full_name)`)
    .eq('status', 'en_attente')

  const list  = (records ?? []) as MaintenanceRecord[]
  const total = list.reduce((s, r) => s + (r.amount ?? 0), 0)
  const count = list.length
  const last  = list[0]

  return (
    <div className="space-y-4">

      {/* Retour */}
      <BackButton fallbackHref="/maintenance" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Entretien
      </BackButton>

      {/* En-tête véhicule */}
      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <h1 className="text-white text-lg font-extrabold">{vehicle.brand} {vehicle.model}</h1>
          <span className="text-white/50 text-xs font-mono mt-0.5">
            {vehicle.plate}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-white">{formatPrice(total)}</div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wide">Total dépensé</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-white">{count}</div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wide">Interventions</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <div className="text-lg font-black text-white">
              {vehicle.current_km != null ? `${vehicle.current_km.toLocaleString('fr-FR')}` : '—'}
            </div>
            <div className="text-[10px] text-white/60 mt-0.5 uppercase tracking-wide">Km actuel</div>
          </div>
        </div>
      </div>

      {/* Les dommages AVANT l'intervention : on constate d'abord, on planifie le
          garage ensuite (ordre demandé par Jeff le 01/08/2026). */}
      <VehicleFacts
        vehicleId={vehicleId}
        flags={(vehicle.maintenance_flags ?? []) as MaintenanceFlag[]}
        canSeeAmounts={canSeeAmounts}
      />

      {/* Planifier le passage au garage */}
      <Link
        href={`/maintenance/${vehicleId}/new`}
        className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#111111] text-white rounded-2xl font-bold text-sm hover:bg-gray-800 transition-colors active:scale-[.99]"
      >
        <Plus className="w-4 h-4" /> Ajouter une intervention
      </Link>

      {/* Historique filtrable. Les dégâts lui sont passés pour que le règlement
          d'une réparation se saisisse dégât par dégât (règle du 01/08/2026). */}
      <MaintenanceHistory
        records={list}
        flags={(vehicle.maintenance_flags ?? []) as MaintenanceFlag[]}
        canClose={canClose}
        currentUserId={user?.id ?? null}
        demandes={(demandes ?? []) as unknown as DemandeMontant[]}
      />

    </div>
  )
}
