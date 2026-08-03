/**
 * Les frais de restitution du contrat : le catalogue de départ, et la lecture
 * de ce que le gérant en a fait.
 *
 * Ce que ce fichier attend : rien à l'appel du catalogue ; un client Supabase et
 * une catégorie de véhicule pour la lecture.
 * Ce qu'il produit : des lignes `{ label, value }` prêtes à imprimer, dans
 * l'ordre du contrat.
 *
 * Qui s'en sert : `lib/contracts/legal-articles.ts` (donc le PDF, l'aperçu à
 * l'écran et le récapitulatif de signature), l'écran `settings/tarifs`, et
 * l'état des lieux de retour pour proposer le tarif d'un dommage constaté.
 *
 * ⚠️ Ce qu'il ne faut pas casser :
 *
 * 1. **Base vide = contrat identique à ce qu'il a toujours été.** `CONTRAT_TYPE`
 *    reproduit à la virgule près ce qui était écrit en dur avant le 03/08/2026.
 *    Le jour de la livraison, aucun montant ne doit bouger.
 * 2. **Les franchises et le retard ne se saisissent pas ici** (`source`). Ils
 *    viennent de la grille tarifaire du véhicule : sinon le contrat d'une Smart
 *    Fortwo annoncerait 15 000 € de franchise en haut et 6 000 € en bas.
 * 3. **`damageKey` relie un poste au constat de l'état des lieux.** Un poste
 *    retiré prive le dommage correspondant de son tarif automatique ; l'écran
 *    prévient, mais rien ne l'empêche (décision de Jeff du 03/08/2026).
 */

import { fmtNombre } from '@/lib/pdf/nombres'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Les deux listes du contrat papier : les sportives, et tout le reste du parc. */
export type ScopeFrais = 'sportif' | 'standard'

export interface PosteFrais {
  id?: string
  label: string
  /** Le forfait. `null` quand le contrat renvoie à un devis. */
  amount: number | null
  /** Ce qui s'imprime après le montant, ou à sa place quand il n'y en a pas. */
  note: string | null
  /** Clé du constat de dommage (état des lieux) que ce poste tarife. */
  damageKey: string | null
  /** Poste piloté par la grille tarifaire, non saisissable ici. */
  source: 'franchise' | 'retard' | null
}

/** La catégorie d'un véhicule ramenée à l'une des deux listes. */
export function scopeDuVehicule(category: string | null | undefined): ScopeFrais {
  return category === 'sportif' ? 'sportif' : 'standard'
}

/**
 * Le contrat type, celui qui s'imprime tant que le gérant n'a rien personnalisé.
 *
 * Repris tel quel de `getFeesTable`, où ces valeurs vivaient en dur. Ne pas les
 * modifier pour un client : c'est ce que la table `restitution_fees` sert à
 * faire. Les toucher ici les changerait pour tous les clients à la fois.
 */
export const CONTRAT_TYPE: Record<ScopeFrais, PosteFrais[]> = {
  sportif: [
    { label: 'Franchise responsabilité civile', amount: null, note: null, damageKey: null, source: 'franchise' },
    { label: 'Franchise dommage', amount: null, note: null, damageKey: null, source: 'franchise' },
    { label: 'Franchise vol', amount: null, note: null, damageKey: null, source: 'franchise' },
    { label: 'Franchise carburant', amount: null, note: 'Selon écart + 50 € de frais de service', damageKey: null, source: null },
    { label: 'Rayure légère', amount: 500, note: null, damageKey: 'rayure_legere', source: null },
    { label: 'Rayure profonde', amount: 800, note: null, damageKey: 'rayure_profonde', source: null },
    { label: 'Rayure par jantes', amount: 500, note: null, damageKey: 'rayure_jantes', source: null },
    { label: 'Fissure jantes', amount: 800, note: null, damageKey: 'fissure_jantes', source: null },
    { label: 'Casse anormale mécanique', amount: null, note: 'Sur devis + 50 % de frais', damageKey: null, source: null },
    { label: 'Retard restitution du véhicule', amount: null, note: null, damageKey: null, source: 'retard' },
    { label: 'Nettoyage véhicule intérieur / extérieur', amount: 100, note: 'ou sur devis si le montant des frais de nettoyage est supérieur', damageKey: 'nettoyage', source: null },
    { label: 'Déchirure et brûlure / tâches sièges / plafonnier', amount: 1000, note: 'par élément ou sur devis si le montant des frais de remise en état est supérieur', damageKey: null, source: null },
    { label: 'Odeur cigarette ou autre', amount: 500, note: null, damageKey: null, source: null },
    { label: 'Perte clés du véhicule', amount: 500, note: null, damageKey: null, source: null },
    { label: 'Utilisation anormale du véhicule (circuit, drift run, course-poursuite…)', amount: 5000, note: null, damageKey: null, source: null },
    { label: 'Usure anormale pneu (crevaison, hernie, abîmé)', amount: 700, note: null, damageKey: 'pneu_anormal', source: null },
    { label: 'Usure anormale freinage', amount: 800, note: null, damageKey: null, source: null },
    { label: 'Contravention au Code de la route', amount: null, note: 'Montant de la contravention + 50 % de frais de gestion', damageKey: null, source: null },
    { label: 'Frais de sortie de fourrière', amount: null, note: 'Frais facturés par la fourrière + 200 € de frais de déplacement et de gestion', damageKey: null, source: null },
    { label: 'Frais de saisie judiciaire', amount: 500, note: "par jour d'immobilisation", damageKey: null, source: null },
    { label: 'Franchise incendie', amount: null, note: null, damageKey: null, source: 'franchise' },
    { label: "Jour d'immobilisation pour réparation", amount: 500, note: null, damageKey: null, source: null },
    { label: 'Dommage carrosserie', amount: null, note: 'Sur devis + 50 %', damageKey: 'dommage_carrosserie', source: null },
    { label: 'Pare-brise, vitre cassé', amount: 5000, note: null, damageKey: 'vitrage_casse', source: null },
    { label: 'Tapis manquant', amount: 300, note: null, damageKey: null, source: null },
    { label: 'Frais juridique', amount: null, note: 'Coût de la procédure + 50 %', damageKey: null, source: null },
    // Le contrat papier imprime « 10 00€ » — coquille de saisie, lue comme 1 000 €.
    { label: 'Erreur carburant (Gazole, éthanol interdit)', amount: 1000, note: null, damageKey: null, source: null },
  ],
  standard: [
    { label: 'Franchise responsabilité civile', amount: null, note: null, damageKey: null, source: 'franchise' },
    { label: 'Franchise dommage', amount: null, note: null, damageKey: null, source: 'franchise' },
    { label: 'Franchise vol', amount: null, note: null, damageKey: null, source: 'franchise' },
    { label: 'Franchise carburant', amount: null, note: 'Selon écart + 20 € de frais de service', damageKey: null, source: null },
    { label: 'Rayure légère', amount: 300, note: null, damageKey: 'rayure_legere', source: null },
    { label: 'Rayure profonde', amount: 500, note: null, damageKey: 'rayure_profonde', source: null },
    { label: 'Rayure par jantes', amount: 300, note: null, damageKey: 'rayure_jantes', source: null },
    { label: 'Fissure jantes', amount: 500, note: null, damageKey: 'fissure_jantes', source: null },
    { label: 'Casse anormale mécanique', amount: null, note: 'Sur devis + 30 % de frais', damageKey: null, source: null },
    { label: 'Retard restitution du véhicule', amount: null, note: null, damageKey: null, source: 'retard' },
    { label: 'Nettoyage véhicule intérieur / extérieur', amount: 50, note: 'ou sur devis si le montant des frais de nettoyage est supérieur', damageKey: 'nettoyage', source: null },
    { label: 'Déchirure et brûlure / tâches sièges / plafonnier', amount: 200, note: 'par élément ou sur devis si le montant des frais de remise en état est supérieur', damageKey: null, source: null },
    { label: 'Odeur cigarette ou autre', amount: 300, note: null, damageKey: null, source: null },
    { label: 'Perte clés du véhicule', amount: 300, note: null, damageKey: null, source: null },
    { label: 'Utilisation anormale du véhicule (circuit, drift run, course-poursuite…)', amount: 5000, note: null, damageKey: null, source: null },
    { label: 'Usure anormale pneu (crevaison, hernie, abîmé)', amount: 400, note: null, damageKey: 'pneu_anormal', source: null },
    { label: 'Usure anormale freinage', amount: 300, note: null, damageKey: null, source: null },
    { label: 'Contravention au Code de la route / Péage', amount: null, note: 'Montant de la contravention + 50 € de frais de gestion', damageKey: null, source: null },
    { label: 'Frais de sortie de fourrière', amount: null, note: 'Frais facturés par la fourrière + 200 € de frais de déplacement et de gestion', damageKey: null, source: null },
    { label: 'Frais de saisie judiciaire', amount: 70, note: "par jour d'immobilisation", damageKey: null, source: null },
    { label: 'Franchise incendie', amount: null, note: null, damageKey: null, source: 'franchise' },
    { label: "Jour d'immobilisation pour réparation", amount: 70, note: null, damageKey: null, source: null },
    { label: 'Dommage carrosserie', amount: null, note: 'Sur devis + 30 %', damageKey: 'dommage_carrosserie', source: null },
    { label: 'Pare-brise, vitre cassé', amount: 1000, note: null, damageKey: 'vitrage_casse', source: null },
    { label: 'Tapis manquant', amount: 150, note: null, damageKey: null, source: null },
    { label: 'Frais juridique', amount: null, note: 'Coût de la procédure + 30 %', damageKey: null, source: null },
    { label: 'Erreur carburant (Gazole, éthanol interdit)', amount: 200, note: null, damageKey: null, source: null },
  ],
}

/** Les clés de dommage que l'état des lieux sait reconnaître. */
export const CLES_DOMMAGE = [
  { cle: 'rayure_legere',       label: 'Rayure légère' },
  { cle: 'rayure_profonde',     label: 'Rayure profonde' },
  { cle: 'rayure_jantes',       label: 'Rayure par jantes' },
  { cle: 'fissure_jantes',      label: 'Fissure jantes' },
  { cle: 'pneu_anormal',        label: 'Usure anormale pneu' },
  { cle: 'vitrage_casse',       label: 'Pare-brise, vitre cassé' },
  { cle: 'nettoyage',           label: 'Nettoyage' },
  { cle: 'dommage_carrosserie', label: 'Dommage carrosserie' },
] as const

/**
 * Ce qui s'imprime au contrat pour un poste.
 *
 * `franchiseTxt` et `retardTxt` arrivent de la grille tarifaire du véhicule :
 * un poste marqué `franchise` ou `retard` affiche leur valeur et ignore la
 * sienne. `fmtNombre` et jamais `toLocaleString` : ce dernier écrit « 15/000 € »
 * dans un PDF.
 */
export function valeurImprimee(
  poste: PosteFrais,
  montants: { franchiseTxt: string; retardTxt: string },
): string {
  if (poste.source === 'franchise') return montants.franchiseTxt
  if (poste.source === 'retard') return montants.retardTxt
  const bouts = [
    poste.amount != null ? `${fmtNombre(poste.amount)} €` : null,
    poste.note || null,
  ].filter(Boolean)
  return bouts.join(' ')
}

/**
 * Les postes d'une catégorie : ceux du gérant s'il en a, sinon le contrat type.
 *
 * Ne remonte jamais les postes mis à la corbeille. Une catégorie sans aucune
 * ligne en base retombe entièrement sur `CONTRAT_TYPE` — pas de mélange, sinon
 * un poste supprimé réapparaîtrait par le contrat type.
 */
export async function postesDeLaCategorie(
  supabase: SupabaseClient<any, any, any>,
  scope: ScopeFrais,
): Promise<{ postes: PosteFrais[]; personnalise: boolean }> {
  const { data } = await supabase
    .from('restitution_fees')
    .select('id, label, amount, note, damage_key, source, position')
    .eq('scope', scope)
    .is('deleted_at', null)
    .order('position', { ascending: true })

  if (!data || data.length === 0) {
    return { postes: CONTRAT_TYPE[scope], personnalise: false }
  }

  return {
    personnalise: true,
    postes: data.map(r => ({
      id: r.id,
      label: r.label,
      amount: r.amount != null ? Number(r.amount) : null,
      note: r.note ?? null,
      damageKey: r.damage_key ?? null,
      source: (r.source as PosteFrais['source']) ?? null,
    })),
  }
}

/**
 * Le montant à proposer pour un dommage constaté, d'après la liste en vigueur.
 * `null` quand le poste renvoie à un devis, ou qu'il a été retiré de la liste.
 */
export function montantDuDommage(postes: PosteFrais[], cle: string): number | null {
  const poste = postes.find(p => p.damageKey === cle)
  return poste?.amount ?? null
}
