/**
 * Complétude du dossier client — source de vérité partagée.
 *
 * Un client ne peut être « prêt à louer » que si son identité, son adresse et
 * au moins une pièce justificative (recto/verso CNI ou permis) sont renseignés.
 * Cette règle est utilisée à deux endroits qui DOIVENT rester cohérents :
 *   - la fiche client (bandeau « Dossier incomplet »)
 *   - le formulaire de réservation (alerte + confirmation avant création)
 */

export interface ClientCompletenessInput {
  first_name?: string | null
  last_name?: string | null
  address?: string | null
  id_doc_front_path?: string | null
  id_doc_back_path?: string | null
  license_front_path?: string | null
}

/** Liste des blocs manquants (vide = dossier complet). */
export function getMissingClientFields(c: ClientCompletenessInput): string[] {
  const missing: string[] = []
  if (!c.first_name || !c.last_name) missing.push('Identité')
  if (!c.address) missing.push('Adresse')
  if (!c.id_doc_front_path && !c.id_doc_back_path && !c.license_front_path)
    missing.push('Documents & Pièces justificatives')
  return missing
}

/** Vrai si le dossier permet de louer. */
export function isClientComplete(c: ClientCompletenessInput): boolean {
  return getMissingClientFields(c).length === 0
}
