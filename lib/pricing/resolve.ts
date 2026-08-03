// ─── Résoudre les tarifs d'un véhicule, côté serveur ──────────────────────────
//
// À quoi sert ce fichier : aller chercher en base la grille du véhicule et les
// réglages d'agence, et rendre les tarifs résolus. C'est le raccourci que tout
// écran serveur appelle avant de facturer quoi que ce soit.
//
// Ce qu'il attend : un client Supabase et l'identifiant du véhicule.
// Ce qu'il produit : les onze valeurs de tarification (voir lib/pricing/grid.ts).
//
// Pourquoi il existe séparément de `grid.ts` : `grid.ts` ne fait que la règle,
// sans rien lire ni écrire, ce qui permet de la relire et de la vérifier d'un
// coup d'œil. Ici on assemble les données.

import type { SupabaseClient } from '@supabase/supabase-js'
import { resoudreTarifs, type PricingGrid, type TarifsResolus, type VehiclePricing } from './grid'

export async function tarifsDuVehicule(
  // Le type exact du client varie (serveur, admin) : seule compte la méthode `from`.
  supabase: SupabaseClient<any, any, any>,
  vehicleId: string | null | undefined,
): Promise<TarifsResolus> {
  if (!vehicleId) return resoudreTarifs(null, null, null)

  const { data: vehicule } = await supabase
    .from('vehicles')
    .select(`id, pricing_grid_id, daily_price, weekly_price, price_day_weekend,
      price_weekend_full, km_included_daily, km_included_week, extra_km_price,
      deposit_amount, unlimited_km_price`)
    .eq('id', vehicleId)
    .maybeSingle()

  const [{ data: grille }, { data: agence }] = await Promise.all([
    vehicule?.pricing_grid_id
      ? supabase.from('pricing_grids').select('*').eq('id', vehicule.pricing_grid_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('agency_settings')
      .select('late_hourly_rate, late_daily_rate, fuel_rate_per_liter, insurance_deductible')
      .limit(1).maybeSingle(),
  ])

  return resoudreTarifs(
    vehicule as VehiclePricing | null,
    grille as PricingGrid | null,
    agence,
  )
}
