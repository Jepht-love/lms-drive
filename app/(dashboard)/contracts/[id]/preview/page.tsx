import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ContractPreviewClient, { type DepartInspection } from './ContractPreviewClient'
import { getAgencySettings } from '@/lib/contracts/agency'

export default async function ContractPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ chain?: string }>
}) {
  const { id } = await params
  const { chain } = await searchParams
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('*, reservation:reservations(*, vehicle:vehicles(*), client:clients(*))')
    .eq('id', id)
    .single()

  if (!contract) notFound()

  const agency = await getAgencySettings(supabase)
  const reservation = contract.reservation as any
  const vehicle = reservation?.vehicle
  const client = reservation?.client

  // État des lieux de DÉPART rattaché au contrat : affiché tel quel dans la
  // prévisualisation (km, propreté, dommages + schéma, photos, signature EDL)
  // pour que le locataire relise l'état constaté AVANT de signer le contrat.
  const { data: departRow } = await supabase
    .from('inspections')
    .select('id, km_reading, fuel_range_km, exterior_cleanliness, interior_cleanliness, damaged_zones, client_signature_svg, signed_at')
    .eq('contract_id', id)
    .eq('type', 'depart')
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let departInspection: DepartInspection | null = null
  if (departRow) {
    const { data: photoRows } = await supabase
      .from('inspection_photos')
      .select('storage_path, photo_type')
      .eq('inspection_id', departRow.id)
      .limit(12)

    const paths = (photoRows ?? []).map(p => p.storage_path)
    let photos: { url: string; label: string }[] = []
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from('vehicle-photos').createSignedUrls(paths, 3600)
      const byPath = new Map((signed ?? []).map(s => [s.path, s.signedUrl]))
      photos = (photoRows ?? [])
        .map(p => {
          const url = byPath.get(p.storage_path)
          return url ? { url, label: p.photo_type } : null
        })
        .filter(Boolean) as { url: string; label: string }[]
    }

    departInspection = {
      kmReading: departRow.km_reading ?? 0,
      fuelRangeKm: departRow.fuel_range_km ?? 0,
      exteriorCleanliness: departRow.exterior_cleanliness ?? 3,
      interiorCleanliness: departRow.interior_cleanliness ?? 3,
      damagedZones: (departRow.damaged_zones as any[]) ?? [],
      clientSignature: departRow.client_signature_svg ?? null,
      signedAt: departRow.signed_at ?? null,
      photos,
    }
  }

  return (
    <ContractPreviewClient
      contract={contract}
      reservation={reservation}
      vehicle={vehicle}
      client={client}
      agency={agency}
      chain={chain ?? null}
      departInspection={departInspection}
    />
  )
}
