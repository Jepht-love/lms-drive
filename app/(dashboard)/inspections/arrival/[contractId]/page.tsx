import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import InspectionFlow from '@/components/inspection/InspectionFlow'
import { calculateRentalDays } from '@/lib/utils'
import { tarifsDuVehicule } from '@/lib/pricing/resolve'
import { postesDeLaCategorie, scopeDuVehicule } from '@/lib/contracts/frais-restitution'
import { getAgencySettings } from '@/lib/contracts/agency'

export default async function ArrivalInspectionPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      id,
      contract_number,
      reservation_id,
      reservation:reservations(
        vehicle_id,
        start_datetime,
        end_datetime,
        km_included,
        extra_km_price,
        unlimited_km,
        daily_price,
        total_price,
        payment_amount,
        deposit_amount,
        vehicle:vehicles(*),
        client:clients(first_name, last_name, phone, address, postal_code, city, email)
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

  // Les tarifs du véhicule, grille comprise. Le retard était facturé 50 ou
  // 150 €/h écrits en dur dans le code avant le 03/08/2026, quel que soit le
  // réglage du gérant.
  const tarifs = await tarifsDuVehicule(supabase, vehicle?.id)
  // Le tableau des frais de restitution réglé par le gérant : il fixe le prix
  // proposé pour un dommage et ce qui s'imprime au récapitulatif de signature.
  const { postes: postesFrais } = await postesDeLaCategorie(supabase, scopeDuVehicule(vehicle?.category))

  // Coordonnées de l'agence (le loueur) : le récap de restitution affiche le
  // même encadré Loueur que l'aperçu et le PDF, jamais « LMS Drive » en dur.
  const agency = await getAgencySettings(supabase)

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
            {vehicle?.brand} {vehicle?.model} · {vehicle?.plate} · {client?.first_name} {client?.last_name}
          </p>
        </div>
      </div>
      <InspectionFlow
        postesFrais={postesFrais}
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
        kmIllimite={Boolean(reservation?.unlimited_km)}
        lateHourlyRate={tarifs.retardHeure}
        insuranceDeductible={tarifs.franchise}
        // Forfait de location et acompte déjà encaissé : sans eux, l'écran de
        // retour n'affichait que les frais et le gérant ne pouvait pas savoir
        // ce que le client doit au total (remonté le 27/07/2026).
        rentalTotal={Number(reservation?.total_price ?? 0)}
        alreadyPaid={Number(reservation?.payment_amount ?? 0)}
        contratInfo={{
          // Au retour : en-tête du contrat en prévisualisation (pas de re-signature,
          // le contrat a été signé au départ) — demande gérant, ticket SAV 21/07.
          numero: contract.contract_number ?? '',
          loueur: {
            nom: agency.company_name,
            phone: agency.phone,
            address: agency.address,
            email: agency.email,
            siret: agency.siret,
            vatNumber: agency.vat_number ?? null,
          },
          clientNom: `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim() || 'Client',
          clientPhone: client?.phone ?? null,
          clientAddress: client?.address ?? null,
          clientPostalCode: client?.postal_code ?? null,
          clientCity: client?.city ?? null,
          clientEmail: client?.email ?? null,
          vehiculeLabel: `${vehicle?.brand ?? ''} ${vehicle?.model ?? ''}`.trim(),
          plate: vehicle?.plate ?? '',
          debut: reservation?.start_datetime ?? '',
          fin: reservation?.end_datetime ?? '',
          prixJour: reservation?.daily_price ?? null,
          total: reservation?.total_price ?? null,
          kmInclus: reservation?.km_included ?? 200,
          kmIllimite: Boolean(reservation?.unlimited_km),
          caution: reservation?.deposit_amount ?? 0,
          categorie: vehicle?.category ?? 'citadine',
          isSmartFortwo: Boolean(
            vehicle?.model?.toLowerCase().includes('smart') ||
            vehicle?.brand?.toLowerCase().includes('smart'),
          ),
        }}
      />
    </div>
  )
}
