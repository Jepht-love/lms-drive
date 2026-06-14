import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ContractPreviewClient from './ContractPreviewClient'
import { getAgencySettings } from '@/lib/contracts/agency'

export default async function ContractPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  return (
    <ContractPreviewClient
      contract={contract}
      reservation={reservation}
      vehicle={vehicle}
      client={client}
      agency={agency}
    />
  )
}
