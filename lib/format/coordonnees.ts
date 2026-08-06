/**
 * Mise en forme des coordonnées (téléphone, adresse) partagée par l'aperçu du
 * contrat à l'écran (`ContractPreviewClient.tsx`) et le PDF téléchargeable
 * (`lib/pdf/contract-template.tsx`).
 *
 * Pourquoi une aide commune : le gérant impose que l'aperçu et le PDF soient
 * IDENTIQUES à 100 % (06/08/2026). Le numéro de l'agence et celui du locataire
 * doivent donc être groupés pareil, et les deux encadrés Loueur / Locataire
 * alignés ligne à ligne. Ces deux fonctions vivaient en double dans l'aperçu ;
 * elles sont ici une seule fois pour que les deux documents ne divergent jamais.
 *
 * Ni l'un ni l'autre ne lit la base : ce sont des transformations pures de texte.
 */

/**
 * Numéro affiché de la même façon pour l'agence et le locataire : sans ça, l'un
 * s'affichait « 06 65 74 40 09 » et l'autre « 0781442311 » (gérant, 05/08/2026).
 * Un numéro français à 10 chiffres est regroupé par deux ; tout autre format
 * (international, incomplet) est laissé tel quel.
 */
export function formatPhoneFr(raw?: string | null): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  }
  return raw.trim()
}

/**
 * Le locataire a rue / code postal / ville dans trois colonnes ; l'agence n'a
 * qu'un seul champ adresse. Pour que les deux encadrés s'alignent ligne à ligne
 * (gérant, 05/08/2026), on découpe une adresse d'une seule chaîne autour du code
 * postal français (5 chiffres). Format inattendu (pas de code postal) → tout
 * reste sur la ligne « rue ».
 */
export function splitAddressFr(full?: string | null): { rue: string; cp: string; ville: string } {
  const s = (full ?? '').trim()
  const m = s.match(/^(.*?)[\s,]*\b(\d{5})\b[\s,]*(.*)$/)
  if (!m) return { rue: s, cp: '', ville: '' }
  return { rue: m[1].replace(/[\s,]+$/, '').trim(), cp: m[2], ville: m[3].trim() }
}
