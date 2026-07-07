import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import InspectionFlow from '@/components/inspection/InspectionFlow'
import { calculateRentalDays } from '@/lib/utils'

export default async function ArrivalInspectionPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      id,
      reservation_id,
      reservation:reservations(
        vehicle_id,
        start_datetime,
        end_datetime,
        km_included,
        extra_km_price,
        vehicle:vehicles(*),
        client:clients(first_name, last_name)
      )
    `)
    .eq('id', contractId)
    .single()

  if (!contract) notFound()

  const reservation = Array.isArray(contract.reservation) ? contract.reservation[0] : contract.reservation as any
  const vehicle = Array.isArray(reservation?.vehicle) ? reservation.vehicle[0] : reservation?.vehicle
  const client = Array.isArray(reservation?.client) ? reservation.client[0] : reservation?.client

  // km_included est un forfait PAR JOUR → le seuil de dépassement de l'EDL retour
  // doit couvrir toute la durée : forfait/jour × nombre de jours de location.
  const rentalDays = reservation?.start_datetime && reservation?.end_datetime
    ? calculateRentalDays(reservation.start_datetime, reservation.end_datetime)
    : 1
  const kmIncludedTotal = (reservation?.km_included ?? 200) * rentalDays

  // Relevé de bord au départ (km + carburant) pour comparer à l'aller-retour
  const { data: departureInspection } = await supabase
    .from('inspections')
    .select('km_reading, fuel_range_km, damaged_zones')
    .eq('contract_id', contractId)
    .eq('type', 'depart')
    .limit(1)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallbackHref={`/contracts/${contractId}`} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">État des lieux de retour</h1>
          <p className="text-gray-500">
            {vehicle?.brand} {vehicle?.model} — {vehicle?.plate} · {client?.first_name} {client?.last_name}
          </p>
        </div>
      </div>
      <InspectionFlow
        type="arrivee"
        contractId={contractId}
        vehicleId={vehicle?.id ?? ''}
        vehicleKm={departureInspection?.km_reading ?? vehicle?.current_km ?? 0}
        reservationId={contract.reservation_id}
        vehicleCategory={vehicle?.category ?? 'citadine'}
        reservationEndDatetime={reservation?.end_datetime ?? undefined}
        kmAtDeparture={departureInspection?.km_reading ?? vehicle?.current_km ?? 0}
        fuelRangeAtDeparture={departureInspection?.fuel_range_km ?? undefined}
        previousDamagedZones={(departureInspection?.damaged_zones as { id: string; label: string; severity: string; description?: string; photos?: string[] }[] | null) ?? []}
        kmIncluded={kmIncludedTotal}
        extraKmPrice={reservation?.extra_km_price ?? 2}
      />
    </div>
  )
}
