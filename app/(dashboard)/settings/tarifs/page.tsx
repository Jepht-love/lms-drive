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
// Ce qu'il attend : rien dans l'adresse. Il lit lui-même les grilles et tous les
// véhicules actifs.
//
// Ce qu'il ne faut pas casser : rattacher une voiture à une grille ne réécrit
// aucun de ses prix. La grille ne fournit que les quatre valeurs communes que
// personne ne portait — retard à l'heure, retard à la journée, carburant,
// franchise. C'est ce qui garantit qu'aucune facture ne change de montant.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowLeft, Tags } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import type { PricingGrid } from '@/lib/pricing/grid'
import { getFeesTable } from '@/lib/contracts/legal-articles'
import { postesDeLaCategorie } from '@/lib/contracts/frais-restitution'
import GrillesTarifaires, { type VehiculeTarife } from './GrillesTarifaires'
import FraisRestitution from './FraisRestitution'

export default async function TarifsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role, is_admin').eq('id', user?.id ?? '').single()

  // Les prix ne se fixent qu'au niveau gérant ou administrateur.
  if (!(profile?.is_admin || profile?.role === 'gerant')) redirect('/')

  const [{ data: grilles }, { data: vehicules }] = await Promise.all([
    supabase.from('pricing_grids').select('*').order('name'),
    supabase
      .from('vehicles')
      .select(`id, brand, model, plate, pricing_grid_id,
        daily_price, price_day_weekend, price_weekend_full, weekly_price,
        deposit_amount, extra_km_price, km_included_daily, km_included_week,
        unlimited_km_price`)
      .eq('is_active', true)
      .order('brand'),
  ])

  // Les deux listes de frais de restitution, avec leur corbeille. Une liste sans
  // aucune ligne en base s'affiche en lecture : c'est le contrat type, celui qui
  // s'imprime tant que le gérant n'a rien repris en main.
  const blocsFrais = await Promise.all(
    ([
      { scope: 'sportif' as const, titre: 'Véhicules sportifs', categorie: 'sportif' },
      // Titre voulu par Jeff le 03/08/2026. Le périmètre reste bien tout ce qui
      // n'est pas sportif (citadine, berline, SUV, utilitaire) : c'est le nom
      // qui change, pas la règle de `scopeDuVehicule`.
      { scope: 'standard' as const, titre: 'Véhicules citadines', categorie: 'citadine' },
    ]).map(async ({ scope, titre, categorie }) => {
      const [{ postes, personnalise }, { data: corbeille }] = await Promise.all([
        postesDeLaCategorie(supabase, scope),
        supabase
          .from('restitution_fees')
          .select('id, label, amount, note, damage_key, source')
          .eq('scope', scope)
          .not('deleted_at', 'is', null)
          .order('position', { ascending: true }),
      ])
      const reference = getFeesTable(categorie)
      return {
        scope,
        titre,
        personnalise,
        postes,
        corbeille: (corbeille ?? []).map(r => ({
          id: r.id,
          label: r.label,
          amount: r.amount != null ? Number(r.amount) : null,
          note: r.note ?? null,
          damageKey: r.damage_key ?? null,
          source: (r.source as 'franchise' | 'retard' | null) ?? null,
        })),
        franchiseTxt: reference.rows.find(l => l.label === 'Franchise dommage')?.value ?? '—',
        retardTxt: reference.rows.find(l => l.label === 'Retard restitution du véhicule')?.value ?? '—',
      }
    }),
  )

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
            ne touche pas à ses tarifs.
          </p>
        </div>
      </div>

      <GrillesTarifaires
        grilles={(grilles ?? []) as PricingGrid[]}
        vehicules={(vehicules ?? []) as VehiculeTarife[]}
      />

      {/* Les frais de restitution du contrat. Les montants de franchise et de
          retard affichés ici sont ceux du contrat type : sur un contrat réel,
          c'est la grille tarifaire du véhicule qui les fixe. */}
      <FraisRestitution blocs={blocsFrais} />
    </div>
  )
}
