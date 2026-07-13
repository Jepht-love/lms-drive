// ─── Complétude du dossier client ─────────────────────────────────────────────
// Un dossier « complet » = les pièces minimales pour louer légalement : une
// pièce d'identité et un permis de conduire (numéro saisi OU photo fournie).
// Volontairement tolérant (numéro OU photo) pour ne pas sur-signaler.

import type { Client } from '@/types/database'

type DossierFields = Pick<
  Client,
  'license_number' | 'license_front_path' | 'id_doc_number' | 'id_doc_front_path'
>

/** Libellés des pièces manquantes (vide = dossier complet). */
export function dossierMissing(c: DossierFields): string[] {
  const missing: string[] = []
  if (!c.id_doc_number && !c.id_doc_front_path) missing.push("Pièce d'identité")
  if (!c.license_number && !c.license_front_path) missing.push('Permis')
  return missing
}

export function isDossierComplet(c: DossierFields): boolean {
  return dossierMissing(c).length === 0
}
