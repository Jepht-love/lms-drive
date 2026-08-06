/**
 * Complétude du dossier client — source de vérité partagée.
 *
 * Un client ne peut être « prêt à louer » que si son identité, son adresse, une
 * pièce d'identité ET un permis sont renseignés. On regarde LES DEUX systèmes de
 * documents, sinon un dossier rempli d'un côté paraît vide de l'autre :
 *   - Système A : documents importés en masse (table `documents`), reconnus par
 *     leur sous-catégorie (`cni`, `titre_sejour`, `passeport`, `permis`, et les
 *     combinés `cni_permis` / `sejour_permis`).
 *   - Système B : les slots historiques de la fiche (chemins de fichiers) et les
 *     champs texte (type de pièce, numéro de permis).
 *
 * La règle d'identité et de permis DOIT rester identique à celle de la fiche client
 * (`app/(dashboard)/clients/[id]/page.tsx`, calcul `hasIdentity` / `hasPermis`).
 * Corrigé le 05/08/2026 : la réservation ne regardait que les 3 anciens slots et
 * annonçait « dossier incomplet » sur un client dont les pièces avaient été
 * importées (Système A), alors que sa fiche l'affichait complet.
 *
 * Le TÉLÉPHONE, lui, n'est signalé qu'ici (alerte de la recherche client à la
 * réservation, demandée le 05/08/2026). La fiche client ne le compte pas dans son
 * badge « complet » : ne pas chercher à aligner les deux sur ce point.
 */

const IDENTITY_SUBS = ['cni', 'titre_sejour', 'passeport', 'cni_permis', 'sejour_permis']
const LICENSE_SUBS = ['permis', 'cni_permis', 'sejour_permis']

export interface ClientCompletenessInput {
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  address?: string | null
  // Système B — slots historiques + champs texte de la fiche
  id_doc_front_path?: string | null
  id_doc_type?: string | null
  license_front_path?: string | null
  license_number?: string | null
  // Système A — sous-catégories des documents importés rattachés au client
  docSubcategories?: string[] | null
}

/** Liste des blocs manquants (vide = dossier complet). */
export function getMissingClientFields(c: ClientCompletenessInput): string[] {
  const subs = new Set(c.docSubcategories ?? [])
  const hasIdentity =
    IDENTITY_SUBS.some(s => subs.has(s)) || !!c.id_doc_front_path || !!c.id_doc_type
  const hasPermis =
    LICENSE_SUBS.some(s => subs.has(s)) || !!c.license_front_path || !!c.license_number

  const missing: string[] = []
  if (!c.first_name || !c.last_name) missing.push('Identité')
  // Le téléphone alerte à la recherche client de la réservation (gérant, 05/08/2026).
  // Non bloquant : la case « créer malgré le dossier incomplet » reste disponible.
  if (!c.phone) missing.push('Téléphone')
  if (!c.address) missing.push('Adresse')
  if (!hasIdentity) missing.push("Pièce d'identité")
  if (!hasPermis) missing.push('Permis')
  return missing
}

/** Vrai si le dossier permet de louer. */
export function isClientComplete(c: ClientCompletenessInput): boolean {
  return getMissingClientFields(c).length === 0
}
