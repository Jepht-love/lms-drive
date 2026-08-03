// ─── Le compte rendu d'une intervention terminée ──────────────────────────────
//
// À quoi sert cet écran : renseigner ce qui a RÉELLEMENT été fait, une fois le
// véhicule revenu du garage. Demandé par le gérant le 02/08/2026, avec sa liste
// exacte : véhicule, nature de l'intervention, pièces remplacées, garage, date,
// prix des pièces, prix de la main d'œuvre, coût total, kilométrage,
// observations, facture.
//
// **Pourquoi un écran séparé** : planifier et rendre compte sont deux moments
// différents. Avant, on dit ce qu'il y a à faire, pour quand et par qui ; ici on
// dit ce qui s'est passé. Les mélanger obligeait à tout saisir à l'avance et
// laissait clore une intervention sans rien renseigner.
//
// Ce qu'il attend : le véhicule et l'intervention dans l'adresse. Ce qu'il
// produit : rien directement, le formulaire appelle `cloturerIntervention`.
//
// Ce qu'il ne faut pas casser : le coût total d'une réparation de dégâts vient
// du règlement, dégât par dégât. Le champ est masqué dans ce cas.

import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { isManagerRole } from '@/lib/auth/roles'
import type { MaintenanceFlag } from '@/types/database'
import type { MaintenancePart, MaintenanceRecord } from '@/lib/maintenance'
import { maintenanceType } from '@/lib/maintenance'
import ClotureForm from './ClotureForm'

export default async function CloturePage({
  params,
}: {
  params: Promise<{ vehicleId: string; recordId: string }>
}) {
  const { vehicleId, recordId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('role, is_admin').eq('id', user.id).maybeSingle()
    : { data: null }
  const peut = Boolean(
    (profile as { is_admin?: boolean } | null)?.is_admin
    || isManagerRole((profile as { role?: string } | null)?.role),
  )
  // Un employé qui arriverait ici par un lien reçu retourne à la fiche : la
  // clôture engage un montant, elle reste aux managers.
  if (!peut) redirect(`/maintenance/${vehicleId}`)

  const [{ data: record }, { data: vehicle }, { data: parts }] = await Promise.all([
    supabase.from('maintenance_records').select('*').eq('id', recordId).single(),
    supabase.from('vehicles').select('id, brand, model, plate, current_km, maintenance_flags').eq('id', vehicleId).single(),
    supabase.from('maintenance_parts').select('id, label, quantity, unit_price').eq('maintenance_id', recordId).order('created_at'),
  ])

  if (!record || !vehicle) notFound()

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
        <h1 className="text-xl font-black text-gray-900">Compte rendu d&apos;intervention</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Ce qui a été fait sur le véhicule, une fois l&apos;intervention réalisée.
        </p>
      </div>

      {/* Le véhicule concerné : première information de la liste du gérant. Elle
          est déjà connue, on la rappelle au lieu de la faire ressaisir. */}
      <div className="bg-[#111111] rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Véhicule concerné</p>
        <p className="text-white font-extrabold mt-1">
          {vehicle.brand} {vehicle.model}
          <span className="text-white/50 text-xs font-mono ml-2">{vehicle.plate}</span>
        </p>
        <p className="text-white/60 text-xs mt-1">
          {maintenanceType(record.type).label}
          {vehicle.current_km != null && ` · ${vehicle.current_km.toLocaleString('fr-FR')} km au compteur`}
        </p>
      </div>

      <ClotureForm
        vehicleId={vehicleId}
        record={record as MaintenanceRecord}
        parts={(parts ?? []) as MaintenancePart[]}
        currentKm={vehicle.current_km ?? null}
        reparationDeDegats={reparationDeDegats}
      />
    </div>
  )
}
