import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getAgencySettings } from '@/lib/contracts/agency'
import { generateContractNumber } from '@/lib/utils'
import ConventionPreviewClient from './ConventionPreviewClient'

// Convention de mise à disposition inter-agences (opération SORTANTE) — document
// entre nous (propriétaire) et l'agence partenaire (bénéficiaire), signé par son
// représentant. Le contrat (doc_type=convention_ia) est créé ici s'il n'existe
// pas encore, puis sert d'ancre aux EDL départ/retour.
export default async function ConventionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: op } = await supabase
    .from('inter_agency_rentals')
    .select('*, partner_agencies(name, contact_name, phone, email, address, siret), vehicles(*)')
    .eq('id', id)
    .single()

  if (!op || op.direction !== 'out') notFound()

  const vehicle = Array.isArray(op.vehicles) ? op.vehicles[0] : op.vehicles
  const partner = Array.isArray(op.partner_agencies) ? op.partner_agencies[0] : op.partner_agencies

  let { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('inter_agency_rental_id', id)
    .limit(1)
    .maybeSingle()

  if (!contract && user) {
    const { data: newContract } = await supabase
      .from('contracts')
      .insert({
        contract_number: generateContractNumber(),
        reservation_id: null,
        inter_agency_rental_id: id,
        doc_type: 'convention_ia',
        status: 'a_signer',
        created_by: user.id,
      })
      .select('*')
      .single()
    contract = newContract
  }

  if (!contract) notFound()

  const agency = await getAgencySettings(supabase)

  return (
    <ConventionPreviewClient
      operationId={id}
      contract={contract}
      operation={op}
      vehicle={vehicle}
      partner={partner}
      agency={agency}
    />
  )
}
