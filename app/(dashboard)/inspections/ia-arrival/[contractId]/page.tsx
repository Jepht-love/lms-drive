import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import InspectionFlow from '@/components/inspection/InspectionFlow'

// EDL de retour d'une opération inter-agences SORTANTE — via le contrat
// (convention) rattaché à l'opération. Pas de réservation : InspectionFlow
// tourne en mode convention (aucun calcul de frais locataire, pas d'email client).
export default async function IaArrivalInspectionPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, inter_agency_rental_id, inter_agency_rentals(vehicle_id, partner_agencies(name), vehicles(*))')
    .eq('id', contractId)
    .single()

  if (!contract || !contract.inter_agency_rental_id) notFound()

  const op = Array.isArray(contract.inter_agency_rentals) ? contract.inter_agency_rentals[0] : contract.inter_agency_rentals as any
  const vehicle = Array.isArray(op?.vehicles) ? op.vehicles[0] : op?.vehicles
  const agency = Array.isArray(op?.partner_agencies) ? op.partner_agencies[0] : op?.partner_agencies

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
        <BackButton fallbackHref={`/partnerships/${contract.inter_agency_rental_id}`} className="p-2 rounded-xl hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </BackButton>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">État des lieux de retour</h1>
          <p className="text-slate-500">
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
      />
    </div>
  )
}
