// ─── Planifier une intervention chez le garage ────────────────────────────────
//
// À quoi sert cet écran : c'est le point d'entrée UNIQUE de tout passage au
// garage, qu'il s'agisse d'un entretien courant (vidange, révision, contrôle
// technique) ou de la réparation de dégâts constatés sur le véhicule.
//
// Ce qu'il attend : l'identifiant du véhicule dans l'adresse. Il lit lui-même le
// véhicule, son kilométrage et ses dégâts en attente.
//
// Ce qu'il produit : rien directement. Il passe les données au formulaire, qui
// appelle `createMaintenanceRecord` (lib/actions/maintenance.ts).
//
// Pourquoi une page serveur depuis le 01/08/2026 : le formulaire était un écran
// client sans aucune donnée, il ne pouvait donc pas montrer les dégâts en attente.
// Or c'est précisément ce que Jeff demande : planifier une réparation à distance,
// sans avoir à aller regarder le véhicule, en s'appuyant sur ce que l'état des
// lieux a déjà constaté.
//
// Ce qu'il ne faut pas casser : les dégâts déjà rattachés à une autre intervention
// (`intervention_id` rempli) et ceux déjà réparés (`repaired_at` rempli) ne
// doivent JAMAIS réapparaître ici, sinon le même dégât se paierait deux fois.

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { isManagerRole } from '@/lib/auth/roles'
import type { MaintenanceFlag } from '@/types/database'
import NewMaintenanceForm from './NewMaintenanceForm'

export default async function NewMaintenancePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>
}) {
  const { vehicleId } = await params
  const supabase = await createClient()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, plate, brand, model, current_km, maintenance_flags')
    .eq('id', vehicleId)
    .single()

  if (!vehicle) notFound()

  // Même règle que la fiche du véhicule : les montants facturés au client ne se
  // montrent qu'au gérant et aux associés (décision de Jeff du 30/07/2026).
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }
  const canSeeAmounts = isManagerRole((profile as { role?: string } | null)?.role)

  const tous = (vehicle.maintenance_flags ?? []) as MaintenanceFlag[]
  const enAttente = tous.filter(f => !f.repaired_at && !f.intervention_id)
  const reparés = tous.filter(f => f.repaired_at).length

  // L'équipe à qui confier l'intervention (02/08/2026). Les prestataires ne sont
  // pas proposés : ils n'ont pas accès à l'application au quotidien, et une
  // intervention confiée à quelqu'un qui ne la verra jamais reste bloquée.
  const { data: equipe } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .neq('role', 'prestataire')
    .order('full_name')

  return (
    <div className="space-y-4 pb-4">
      <BackButton
        fallbackHref={`/maintenance/${vehicleId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour
      </BackButton>

      <div>
        <h1 className="text-xl font-black text-gray-900">Nouvelle intervention</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {vehicle.brand} {vehicle.model} · {vehicle.plate}
        </p>
      </div>

      <NewMaintenanceForm
        vehicleId={vehicleId}
        currentKm={vehicle.current_km ?? null}
        damages={enAttente}
        repairedCount={reparés}
        canSeeAmounts={canSeeAmounts}
        equipe={(equipe ?? []) as { id: string; full_name: string | null }[]}
      />
    </div>
  )
}
