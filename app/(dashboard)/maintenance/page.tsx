import { redirect } from 'next/navigation'

// La liste d'entretien a été fusionnée dans la page unifiée « Suivi véhicule ».
// Cette route est conservée pour ne casser aucun lien/marque-page existant.
export default function MaintenancePage() {
  redirect('/suivi')
}
