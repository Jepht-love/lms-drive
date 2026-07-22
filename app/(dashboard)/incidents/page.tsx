import { redirect } from 'next/navigation'

// Le hub Incidents a été fusionné dans la page unifiée « Suivi véhicule »
// (onglets Entretien | Sinistres | Infractions). Route conservée pour les
// liens/marque-pages existants → onglet Sinistres par défaut.
export default function IncidentsPage() {
  redirect('/suivi?tab=sinistres')
}
