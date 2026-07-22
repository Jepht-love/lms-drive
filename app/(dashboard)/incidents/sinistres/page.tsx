import { redirect } from 'next/navigation'

// La liste des sinistres a été fusionnée dans la page unifiée « Suivi véhicule »
// (onglet Sinistres). Route conservée pour les liens/marque-pages existants ;
// les filtres statut/véhicule sont transmis.
export default async function SinistresPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; vehicle?: string }>
}) {
  const { status, vehicle } = await searchParams
  const p = new URLSearchParams({ tab: 'sinistres' })
  if (status) p.set('status', status)
  if (vehicle) p.set('vehicle', vehicle)
  redirect(`/suivi?${p.toString()}`)
}
