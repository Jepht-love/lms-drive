import { redirect } from 'next/navigation'

// La liste des infractions a été fusionnée dans la page unifiée « Suivi véhicule »
// (onglet Infractions). Route conservée pour les liens/marque-pages existants ;
// les filtres statut/véhicule sont transmis.
export default async function InfractionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vehicle?: string }>
}) {
  const { status, vehicle } = await searchParams
  const p = new URLSearchParams({ tab: 'infractions' })
  if (status) p.set('status', status)
  if (vehicle) p.set('vehicle', vehicle)
  redirect(`/suivi?${p.toString()}`)
}
