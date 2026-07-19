import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import InspectionFlow from '@/components/inspection/InspectionFlow'
import { generateContractNumber } from '@/lib/utils'

export default async function DepartureInspectionPage({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, vehicle:vehicles(*), client:clients(first_name, last_name)')
    .eq('id', reservationId)
    .single()

  if (!reservation) notFound()

  // Chercher un contrat existant
  let { data: contract } = await supabase
    .from('contracts')
    .select('id')
    .eq('reservation_id', reservationId)
    .limit(1)
    .single()

  // Si pas de contrat → le créer maintenant (avant l'EDL départ)
  if (!contract && user) {
    const { data: newContract } = await supabase
      .from('contracts')
      .insert({
        contract_number: generateContractNumber(),
        reservation_id: reservationId,
        status: 'a_signer',
        created_by: user.id,
      })
      .select('id')
      .single()
    contract = newContract
  }

  // La réservation ne passe PAS « en cours » ici : ouvrir l'écran d'EDL ne doit
  // pas marquer le véhicule comme parti. Sinon un EDL commencé puis abandonné
  // laisse la résa « loué » à tort (départ fantôme, absent des « à préparer » du
  // jour). La bascule en_cours + sync calendrier + recalcul véhicule se fait à la
  // VALIDATION de l'EDL (InspectionFlow → markReservationDeparted).

  if (!contract) notFound()

  const vehicle = reservation.vehicle as any
  const client = reservation.client as any

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallbackHref={`/reservations/${reservationId}`} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </BackButton>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">État des lieux de départ</h1>
          <p className="text-gray-500">{vehicle?.brand} {vehicle?.model} — {vehicle?.plate} · {client?.first_name} {client?.last_name}</p>
        </div>
      </div>
      <InspectionFlow
        type="depart"
        contractId={contract.id}
        vehicleId={vehicle?.id ?? ''}
        vehicleKm={vehicle?.current_km ?? 0}
        reservationId={reservationId}
      />
    </div>
  )
}
