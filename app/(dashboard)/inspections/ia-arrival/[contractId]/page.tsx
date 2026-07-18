import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import InspectionFlow from '@/components/inspection/InspectionFlow'
import { calculateRentalDays } from '@/lib/utils'

// EDL de retour d'une opération inter-agences SORTANTE — via le contrat
// (convention) rattaché à l'opération. Pas de réservation client dans le flux :
// InspectionFlow tourne en mode convention (pas d'email client). Le seuil de
// dépassement km suit néanmoins la même règle que les contrats particuliers.
export default async function IaArrivalInspectionPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, inter_agency_rental_id, inter_agency_rentals(vehicle_id, start_date, end_date_expected, end_date_actual, client_reservation_id, partner_agencies(name), vehicles(*))')
    .eq('id', contractId)
    .single()

  if (!contract || !contract.inter_agency_rental_id) notFound()

  const op = Array.isArray(contract.inter_agency_rentals) ? contract.inter_agency_rentals[0] : contract.inter_agency_rentals as any
  const vehicle = Array.isArray(op?.vehicles) ? op.vehicles[0] : op?.vehicles
  const agency = Array.isArray(op?.partner_agencies) ? op.partner_agencies[0] : op?.partner_agencies

  // Forfait km : par jour × durée de l'opération, comme les contrats particuliers.
  // Le forfait/jour vient de la réservation client adossée si elle existe, sinon
  // du véhicule, sinon 200 par défaut. `inter_agency_rentals` ne stocke pas de
  // forfait km propre, d'où l'ancien calcul plat (200) qui sous-estimait le seuil.
  type ClientRes = { km_included: number | null; extra_km_price: number | null; start_datetime: string; end_datetime: string }
  let clientRes: ClientRes | null = null
  if (op?.client_reservation_id) {
    const { data } = await supabase
      .from('reservations')
      .select('km_included, extra_km_price, start_datetime, end_datetime')
      .eq('id', op.client_reservation_id)
      .maybeSingle()
    clientRes = data as ClientRes | null
  }

  const periodStart = clientRes?.start_datetime ?? op?.start_date
  const periodEnd = clientRes?.end_datetime ?? op?.end_date_actual ?? op?.end_date_expected
  const rentalDays = periodStart && periodEnd ? calculateRentalDays(periodStart, periodEnd) : 1
  const kmPerDay = clientRes?.km_included ?? vehicle?.km_included_daily ?? vehicle?.km_included_day ?? 200
  const kmIncludedTotal = kmPerDay * rentalDays
  const extraKmPrice = clientRes?.extra_km_price ?? vehicle?.extra_km_price ?? vehicle?.km_extra_price ?? 2

  // Relevé de départ pour comparer km / dommages
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
        <BackButton fallbackHref={`/partnerships/${contract.inter_agency_rental_id}`} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">État des lieux de retour</h1>
          <p className="text-gray-500">
            {vehicle?.brand} {vehicle?.model} — {vehicle?.plate} · retour de {agency?.name ?? 'partenaire'}
          </p>
        </div>
      </div>
      <InspectionFlow
        type="arrivee"
        contractId={contractId}
        vehicleId={vehicle?.id ?? ''}
        vehicleKm={departureInspection?.km_reading ?? vehicle?.current_km ?? 0}
        doneHref={`/partnerships/${contract.inter_agency_rental_id}`}
        vehicleCategory={vehicle?.category ?? 'citadine'}
        kmAtDeparture={departureInspection?.km_reading ?? vehicle?.current_km ?? 0}
        fuelRangeAtDeparture={departureInspection?.fuel_range_km ?? undefined}
        previousDamagedZones={(departureInspection?.damaged_zones as { id: string; label: string; severity: string }[] | null) ?? []}
        kmIncluded={kmIncludedTotal}
        extraKmPrice={extraKmPrice}
      />
    </div>
  )
}
