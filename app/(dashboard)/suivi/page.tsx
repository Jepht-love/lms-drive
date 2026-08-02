import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Wrench } from 'lucide-react'
import EntretienSection from '@/components/suivi/EntretienSection'
import SinistresSection from '@/components/suivi/SinistresSection'
import InfractionsSection from '@/components/suivi/InfractionsSection'
import VehiclePicker from '@/components/vehicles/VehiclePicker'
import VehicleSituationCard from '@/components/vehicles/VehicleSituationCard'
import { fetchSituationVehicule } from '@/lib/vehicles/situation'

type Tab = 'entretien' | 'sinistres' | 'infractions'

/**
 * Page unifiée « Suivi véhicule » — regroupe en un seul écran à onglets
 * l'Entretien (ex /maintenance), les Sinistres et les Infractions
 * (ex /incidents/*). L'onglet Entretien reste accessible à tous les rôles ;
 * Sinistres et Infractions restent réservés aux managers (gérant/associé).
 */
export default async function SuiviPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string; vehicle?: string }>
}) {
  const { tab: rawTab, status, vehicle } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isManager = !!profile && ['gerant', 'associe'].includes(profile.role)

  // Onglet demandé, clampé selon le rôle : un non-manager est ramené à Entretien.
  const requested = (rawTab === 'sinistres' || rawTab === 'infractions') ? rawTab : 'entretien'
  const tab: Tab = isManager ? requested : 'entretien'

  // ── Le véhicule choisi : où est-il, et où en est son entretien ? ─────────────
  // Même couple « liste déroulante + carte » que l'écran Réservations, demandé
  // par Jeff le 02/08/2026 (remarque 46). La carte INFORME : elle ne filtre pas
  // l'onglet Entretien. Sur Sinistres et Infractions, en revanche, le paramètre
  // `vehicle` filtrait déjà avant cette date, et ce comportement est conservé.
  const [{ data: vehiclesList }, situation] = await Promise.all([
    supabase.from('vehicles').select('id, brand, model, plate').eq('is_active', true).order('brand'),
    vehicle ? fetchSituationVehicule(supabase, vehicle, { avecEntretien: true }) : Promise.resolve(null),
  ])

  const tabs: { key: Tab; label: string }[] = isManager
    ? [
        { key: 'entretien', label: 'Entretien' },
        { key: 'sinistres', label: 'Sinistres' },
        { key: 'infractions', label: 'Infractions' },
      ]
    : [{ key: 'entretien', label: 'Entretien' }]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900">Suivi véhicule</h1>
        <p className="text-sm text-gray-400 mt-0.5">Entretien, sinistres &amp; infractions</p>
      </div>

      {/* Contrôle segmenté, masqué pour les non-managers (un seul onglet) */}
      {isManager && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {tabs.map(t => {
            const active = t.key === tab
            const href = t.key === 'entretien' ? '/suivi' : `/suivi?tab=${t.key}`
            return (
              <Link
                key={t.key}
                href={href}
                className={`flex-1 text-center px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  active ? 'bg-white text-[#111111] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </div>
      )}

      {/* Choix d'un véhicule, et sa situation. Pas de marge négative ici : elle
          faisait déborder ce bloc de 4 px à gauche et à droite, et se voyait à
          côté du titre et des onglets, tous alignés au même bord (remarque 47 de
          Jeff, 02/08/2026). */}
      <div className="flex gap-2">
        <VehiclePicker vehicles={vehiclesList ?? []} selected={vehicle} basePath="/suivi" />
      </div>

      {situation && (
        <VehicleSituationCard
          situation={situation}
          action={
            <Link
              href={`/maintenance/${vehicle}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111111] bg-white px-3 py-2 rounded-lg"
            >
              <Wrench className="w-3.5 h-3.5" /> Planifier une intervention
            </Link>
          }
        />
      )}

      {tab === 'entretien' && <EntretienSection />}
      {tab === 'sinistres' && <SinistresSection status={status} vehicle={vehicle} />}
      {tab === 'infractions' && <InfractionsSection status={status} vehicle={vehicle} />}
    </div>
  )
}
