// ─── Les grilles tarifaires ───────────────────────────────────────────────────
//
// À quoi sert ce fichier : dire quel prix s'applique à un véhicule donné, et
// c'est le SEUL endroit où cette règle est écrite. Toute facture, tout contrat,
// tout écran de réservation doit passer par ici plutôt que de lire une colonne
// à la main.
//
// Ce qu'il attend : un véhicule (au moins ses colonnes de tarif) et, si elle
// existe, la grille à laquelle il est rattaché. Ce qu'il produit : les onze
// valeurs de tarification, résolues.
//
// LA RÈGLE, tranchée par Jeff le 02/08/2026 :
//
//   1. **Le véhicule gagne toujours** dès qu'il porte la valeur. « Chaque
//      véhicule a son prix, le prix au kilomètre n'est pas le même. » C'est ce
//      qui garantit qu'aucune facture déjà émise ne change de montant.
//   2. **La grille sert de valeur par défaut** quand le véhicule n'a rien.
//   3. **La grille est la SEULE source** pour les quatre tarifs que le véhicule
//      ne porte pas : retard à l'heure, retard à la journée, carburant,
//      franchise. C'est là qu'elle règle le défaut du 28/07/2026, où ces
//      valeurs étaient saisies dans les paramètres sans le moindre effet.
//   4. Les réglages d'agence ne servent plus que de dernier recours, pour un
//      véhicule sans grille. Ils restent lus pour ne rien casser.
//
// ⚠️ Attention aux colonnes doublons de `vehicles` : la facturation lit
// `daily_price`, `weekly_price`, `price_day_weekend`, `price_weekend_full`,
// `km_included_daily`, `extra_km_price` et `deposit_amount`. Les colonnes
// `price_day_week`, `price_week`, `km_included_day`, `km_included_week`,
// `km_included_weekend` et `km_extra_price` sont d'anciennes jumelles dormantes :
// ne jamais s'en servir ici, elles ne sont plus alimentées.

/** Une grille : le nom, et les quatre valeurs communes à ses voitures. */
export interface PricingGrid {
  id: string
  name: string
  late_hourly_rate: number | null
  late_daily_rate: number | null
  fuel_rate_per_liter: number | null
  insurance_deductible: number | null
}

/** Les colonnes de tarif portées par le véhicule lui-même. */
export interface VehiclePricing {
  id?: string
  pricing_grid_id?: string | null
  daily_price?: number | null
  weekly_price?: number | null
  price_day_weekend?: number | null
  price_weekend_full?: number | null
  km_included_daily?: number | null
  km_included_week?: number | null
  extra_km_price?: number | null
  deposit_amount?: number | null
  unlimited_km_price?: number | null
}

/** Les valeurs communes, dernier recours quand un véhicule n'a pas de grille. */
export interface AgencyFallback {
  late_hourly_rate?: number | null
  late_daily_rate?: number | null
  fuel_rate_per_liter?: number | null
  insurance_deductible?: number | null
}

export interface TarifsResolus {
  /** Niveau véhicule, jamais écrasé par la grille. */
  prixJourSemaine: number | null
  prixJourWeekend: number | null
  forfaitWeekend: number | null
  prixSemaine: number | null
  caution: number | null
  kmInclusJour: number | null
  kmInclusSemaine: number | null
  supplementKm: number | null
  prixKmIllimite: number | null
  /** Niveau grille : ces quatre-là n'existent nulle part ailleurs. */
  retardHeure: number | null
  retardJour: number | null
  carburantLitre: number | null
  franchise: number | null
  /** D'où viennent les quatre valeurs communes, pour l'afficher à l'écran. */
  sourceCommune: 'grille' | 'agence' | 'aucune'
  grille: PricingGrid | null
}

/**
 * Une valeur « portée » est une valeur non nulle. **Zéro compte comme portée** :
 * un supplément au kilomètre à 0 € veut dire « inclus », pas « non renseigné ».
 * Confondre les deux ferait remonter le tarif de la grille sur une voiture dont
 * le gérant a justement voulu qu'elle n'en ait pas.
 */
const porte = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)

export function resoudreTarifs(
  vehicule: VehiclePricing | null | undefined,
  grille: PricingGrid | null | undefined,
  agence?: AgencyFallback | null,
): TarifsResolus {
  const v = vehicule ?? {}
  const commune = <K extends keyof PricingGrid & keyof AgencyFallback>(cle: K): number | null => {
    const deLaGrille = grille?.[cle] as number | null | undefined
    if (porte(deLaGrille)) return deLaGrille
    const deLAgence = agence?.[cle] as number | null | undefined
    return porte(deLAgence) ? deLAgence : null
  }

  const sourceCommune: TarifsResolus['sourceCommune'] =
    grille && [grille.late_hourly_rate, grille.late_daily_rate, grille.fuel_rate_per_liter, grille.insurance_deductible].some(porte)
      ? 'grille'
      : agence && [agence.late_hourly_rate, agence.late_daily_rate, agence.fuel_rate_per_liter, agence.insurance_deductible].some(porte)
        ? 'agence'
        : 'aucune'

  return {
    prixJourSemaine: porte(v.daily_price) ? v.daily_price : null,
    prixJourWeekend: porte(v.price_day_weekend) ? v.price_day_weekend : null,
    forfaitWeekend:  porte(v.price_weekend_full) ? v.price_weekend_full : null,
    prixSemaine:     porte(v.weekly_price) ? v.weekly_price : null,
    caution:         porte(v.deposit_amount) ? v.deposit_amount : null,
    kmInclusJour:    porte(v.km_included_daily) ? v.km_included_daily : null,
    kmInclusSemaine: porte(v.km_included_week) ? v.km_included_week : null,
    supplementKm:    porte(v.extra_km_price) ? v.extra_km_price : null,
    prixKmIllimite:  porte(v.unlimited_km_price) ? v.unlimited_km_price : null,
    retardHeure:     commune('late_hourly_rate'),
    retardJour:      commune('late_daily_rate'),
    carburantLitre:  commune('fuel_rate_per_liter'),
    franchise:       commune('insurance_deductible'),
    sourceCommune,
    grille: grille ?? null,
  }
}

/** Les huit valeurs qu'un véhicule porte lui-même, dans l'ordre de l'écran. */
export const CHAMPS_VEHICULE = [
  { cle: 'daily_price',        label: 'Jour semaine',   court: 'J.sem',  unite: '€' },
  { cle: 'price_day_weekend',  label: 'Jour week-end',  court: 'J.W-E',  unite: '€' },
  { cle: 'price_weekend_full', label: 'Forfait W-E',    court: 'Forf',   unite: '€' },
  { cle: 'weekly_price',       label: 'Semaine 7 j',    court: 'Sem',    unite: '€' },
  { cle: 'deposit_amount',     label: 'Caution',        court: 'Caut',   unite: '€' },
  { cle: 'extra_km_price',     label: 'Supplément km',  court: '€/km',   unite: '€' },
  { cle: 'km_included_daily',  label: 'Km inclus/j',    court: 'Km/j',   unite: '' },
  { cle: 'km_included_week',   label: 'Km inclus/sem',  court: 'Km/sem', unite: '' },
  { cle: 'unlimited_km_price', label: 'Km illimité',    court: 'Km illim.', unite: '€' },
] as const

/**
 * Les valeurs communes d'une grille, dans l'ordre de l'écran.
 *
 * ⚠️ « Retard à la journée » (`late_daily_rate`) a été RETIRÉ de l'écran le
 * 03/08/2026, sur décision de Jeff. Le retard se facture uniquement à l'heure
 * (`calculateLateFee` : tolérance, puis tarif horaire par heure entamée), et le
 * gérant corrige le montant à la main sur la facture de restitution s'il le
 * souhaite. La valeur affichée, 80 €, n'était même pas un choix : c'était le
 * `DEFAULT 80` de la migration 007. Elle n'a jamais été lue par personne, et
 * laissée à l'écran elle laissait croire à un forfait journalier inexistant.
 * La colonne reste en base, dormante, pour ne rien casser.
 */
export const CHAMPS_GRILLE = [
  { cle: 'late_hourly_rate',     label: 'Retard à l’heure',   court: 'Retard/h', unite: '€' },
  { cle: 'fuel_rate_per_liter',  label: 'Carburant',           court: 'Carburant', unite: '€/L' },
  { cle: 'insurance_deductible', label: 'Franchise',           court: 'Franchise', unite: '€' },
] as const
