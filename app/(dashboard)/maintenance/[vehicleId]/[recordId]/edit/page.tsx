// ─── Modifier une intervention ────────────────────────────────────────────────
//
// À quoi sert cet écran : reprendre une intervention déjà enregistrée pour
// corriger ce qui a changé, et détailler la facture du garage (pièces
// remplacées, main d'œuvre). Il n'existait aucun moyen de modifier une
// intervention avant le 02/08/2026 : il fallait la supprimer et la ressaisir,
// ce qui effaçait au passage son écriture comptable.
//
// Ce qu'il attend : le véhicule et l'intervention dans l'adresse. Il lit
// lui-même l'intervention, ses pièces, l'équipe et l'éventuelle demande de
// correction en attente.
//
// Ce qu'il produit : rien directement. Le formulaire appelle
// `updateMaintenanceRecord` (lib/actions/maintenance.ts).
//
// Ce qu'il ne faut pas casser : le montant d'une réparation de dégâts vient du
// règlement, dégât par dégât (`settleIntervention`). Cet écran ne doit jamais
// permettre de le réécrire à la main, sinon la ventilation comptable de la
// rubrique « Dégâts et réparations » ne correspondrait plus à rien.

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import type { MaintenanceFlag } from '@/types/database'
import type { MaintenancePart, MaintenanceRecord } from '@/lib/maintenance'
import EditMaintenanceForm from './EditMaintenanceForm'

export default async function EditMaintenancePage({
  params,
}: {
  params: Promise<{ vehicleId: string; recordId: string }>
}) {
  const { vehicleId, recordId } = await params
  const supabase = await createClient()

  const [{ data: record }, { data: vehicle }, { data: parts }, { data: equipe }] = await Promise.all([
    supabase.from('maintenance_records').select('*').eq('id', recordId).single(),
    supabase.from('vehicles').select('id, brand, model, plate, maintenance_flags').eq('id', vehicleId).single(),
    supabase.from('maintenance_parts').select('id, label, quantity, unit_price').eq('maintenance_id', recordId).order('created_at'),
    supabase.from('profiles').select('id, full_name, role').neq('role', 'prestataire').order('full_name'),
  ])

  if (!record || !vehicle) notFound()

  // Une demande de correction déjà en attente bloque toute nouvelle demande :
  // sinon on empilerait des corrections concurrentes sur le même montant.
  const { data: demande } = await supabase
    .from('maintenance_amount_requests')
    .select('id, old_amount, new_amount, reason, created_at')
    .eq('maintenance_id', recordId)
    .eq('status', 'en_attente')
    .maybeSingle()

  // Le montant vient du règlement quand l'intervention répare des dégâts : il ne
  // se saisit alors pas à la main.
  const flags = (vehicle.maintenance_flags ?? []) as MaintenanceFlag[]
  const reparationDeDegats = flags.some(f => f.intervention_id === recordId)

  return (
    <div className="space-y-4 pb-4">
      <BackButton
        fallbackHref={`/maintenance/${vehicleId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour
      </BackButton>

      <div>
        <h1 className="text-xl font-black text-gray-900">Modifier l&apos;intervention</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {vehicle.brand} {vehicle.model} · {vehicle.plate}
        </p>
      </div>

      <EditMaintenanceForm
        vehicleId={vehicleId}
        record={record as MaintenanceRecord}
        parts={(parts ?? []) as MaintenancePart[]}
        equipe={(equipe ?? []) as { id: string; full_name: string | null }[]}
        demandeEnAttente={demande ?? null}
        reparationDeDegats={reparationDeDegats}
      />
    </div>
  )
}
