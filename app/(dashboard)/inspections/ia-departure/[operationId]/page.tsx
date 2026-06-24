import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import InspectionFlow from '@/components/inspection/InspectionFlow'
import { generateContractNumber } from '@/lib/utils'

// EDL de départ d'une opération inter-agences SORTANTE (notre véhicule prêté à
// une agence partenaire). Comme il n'y a ni réservation ni client, le contrat
// (doc_type=convention_ia) est rattaché à l'opération via inter_agency_rental_id.
export default async function IaDepartureInspectionPage({ params }: { params: Promise<{ operationId: string }> }) {
  const { operationId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: op } = await supabase
    .from('inter_agency_rentals')
    .select('id, direction, vehicle_id, partner_agencies(name), vehicles(*)')
    .eq('id', operationId)
    .single()

  if (!op || op.direction !== 'out' || !op.vehicle_id) notFound()

  const vehicle = (Array.isArray(op.vehicles) ? op.vehicles[0] : op.vehicles) as any
  const agency = Array.isArray(op.partner_agencies) ? op.partner_agencies[0] : op.partner_agencies

  // Contrat (convention) existant ? sinon le créer maintenant.
  let { data: contract } = await supabase
    .from('contracts')
    .select('id')
    .eq('inter_agency_rental_id', operationId)
    .limit(1)
    .maybeSingle()

  if (!contract && user) {
    const { data: newContract } = await supabase
      .from('contracts')
      .insert({
        contract_number: generateContractNumber(),
        reservation_id: null,
        inter_agency_rental_id: operationId,
        doc_type: 'convention_ia',
        status: 'a_signer',
        created_by: user.id,
      })
      .select('id')
      .single()
    contract = newContract
  }

  if (!contract) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallbackHref={`/partnerships/${operationId}`} className="p-2 rounded-xl hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </BackButton>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">État des lieux de départ</h1>
          <p className="text-slate-500">
            {vehicle?.brand} {vehicle?.model} — {vehicle?.plate} · mise à disposition {agency?.name ?? 'partenaire'}
          </p>
        </div>
      </div>
      <InspectionFlow
        type="depart"
        contractId={contract.id}
        vehicleId={vehicle?.id ?? ''}
        vehicleKm={vehicle?.current_km ?? 0}
        doneHref={`/partnerships/${operationId}`}
      />
    </div>
  )
}
