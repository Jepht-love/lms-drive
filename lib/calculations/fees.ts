// ─── Ce qui se facture en plus, au retour du véhicule ─────────────────────────
//
// À quoi sert ce fichier : calculer les frais de retard et le dépassement de
// kilométrage à l'état des lieux de retour. Ce qu'il produit part directement
// sur la facture du client, il n'y a pas d'écran de contrôle derrière.
//
// ⚠️ CE QUI A CHANGÉ LE 03/08/2026, et pourquoi c'était grave :
// le tarif horaire de retard était écrit EN DUR ici, 150 € pour un véhicule
// « sportif » et 50 € pour les autres. Le gérant réglait son retard à 15 €/h
// dans les paramètres, et l'application facturait 50 €. Deux conséquences : un
// prix faux pour le client, et une valeur propre à un client dans le code, ce
// qui interdisait de livrer le logiciel à un autre sans le modifier.
//
// Le tarif se passe donc en paramètre, résolu par lib/pricing/grid.ts : la
// valeur du véhicule d'abord, celle de sa grille ensuite, celle de l'agence en
// dernier recours.

/** Ce qu'on applique quand aucune grille ni aucun réglage ne dit le tarif. */
export const RETARD_HORAIRE_DEFAUT = 50
/** Retard toléré avant que quoi que ce soit se facture, en minutes. */
export const TOLERANCE_RETARD_MINUTES = 60

/**
 * Frais de retard d'un retour.
 *
 * Attend le retard en minutes et le tarif horaire de l'agence ou de la grille.
 * Produit le montant à facturer, arrondi à l'heure entamée au-delà de la
 * tolérance.
 *
 * Un tarif à 0 est une valeur valable : elle veut dire « le retard ne se facture
 * pas ». Seul un tarif absent retombe sur la valeur par défaut.
 */
export function calculateLateFee(
  lateMinutes: number,
  tarifHoraire?: number | null,
  toleranceMinutes: number = TOLERANCE_RETARD_MINUTES,
): number {
  if (lateMinutes <= toleranceMinutes) return 0
  const lateHours = Math.ceil((lateMinutes - toleranceMinutes) / 60)
  const taux = tarifHoraire != null && Number.isFinite(tarifHoraire)
    ? tarifHoraire
    : RETARD_HORAIRE_DEFAUT
  return Math.round(lateHours * taux * 100) / 100
}

export function calculateExtraKm(
  kmAtDeparture: number,
  kmAtReturn: number,
  kmIncluded: number,
  extraKmPrice: number = 2,
): { extraKm: number; amount: number } {
  const totalDriven = Math.max(0, kmAtReturn - kmAtDeparture)
  const extraKm = Math.max(0, totalDriven - kmIncluded)
  return {
    extraKm,
    amount: Math.round(extraKm * extraKmPrice * 100) / 100,
  }
}
