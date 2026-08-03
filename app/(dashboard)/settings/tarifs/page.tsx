// ─── Les grilles tarifaires ───────────────────────────────────────────────────
//
// À quoi sert cet écran : créer les grilles du gérant (Sportive, Citadine…),
// leur rattacher des voitures, et fixer les prix. **C'est le seul endroit où un
// prix se modifie** depuis le 02/08/2026 : la fiche du véhicule les garde en
// lecture.
//
// Pourquoi une page à part et non un bloc de plus dans Paramètres : cet écran
// porte douze valeurs par véhicule, il aurait doublé la longueur d'un écran déjà
// long. Le gérant y accède par un lien depuis Paramètres.
//
// Ce qu'il attend : rien dans l'adresse. Il lit lui-même les grilles, tous les
// véhicules actifs et les réglages d'agence (qui servent de dernier recours pour
// une voiture sans grille).
//
// Ce qu'il ne faut pas casser : rattacher une voiture à une grille ne réécrit
// aucun de ses prix. La grille ne fournit que les quatre valeurs communes que
// personne ne portait — retard à l'heure, retard à la journée, carburant,
// franchise. C'est ce qui garantit qu'aucune facture ne change de montant.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft, Tags } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { getAgencySettings } from '@/lib/contracts/agency'
import type { PricingGrid } from '@/lib/pricing/grid'
import GrillesTarifaires, { type VehiculeTarife } from './GrillesTarifaires'

export default async function TarifsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role, is_admin').eq('id', user?.id ?? '').single()

  // Les prix ne se fixent qu'au niveau gérant ou administrateur.
  if (!(profile?.is_admin || profile?.role === 'gerant')) redirect('/')

  const [{ data: grilles }, { data: vehicules }, agence] = await Promise.all([
    supabase.from('pricing_grids').select('*').order('name'),
    supabase
      .from('vehicles')
      .select(`id, brand, model, plate, pricing_grid_id,
        daily_price, price_day_weekend, price_weekend_full, weekly_price,
        deposit_amount, extra_km_price, km_included_daily, km_included_week,
        unlimited_km_price`)
      .eq('is_active', true)
      .order('brand'),
    getAgencySettings(supabase),
  ])

  return (
    <div className="space-y-5">
      <BackButton fallbackHref="/settings" className="inline-flex items-center gap-1.5 text-sm text-gray-400 font-medium hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Paramètres
      </BackButton>

      <div className="flex items-center gap-3">
        <Tags className="w-6 h-6 text-gray-700 flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl font-black text-gray-900">Grilles tarifaires</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Un prix se change ici, et nulle part ailleurs. Ranger une voiture dans une grille
            ne touche pas à ses tarifs : la grille n&apos;apporte que le retard, le carburant
            et la franchise.
          </p>
        </div>
      </div>

      <GrillesTarifaires
        grilles={(grilles ?? []) as PricingGrid[]}
        vehicules={(vehicules ?? []) as VehiculeTarife[]}
        agence={agence}
      />
    </div>
  )
}
