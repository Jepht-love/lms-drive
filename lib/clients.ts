// ─── Complétude du dossier client ─────────────────────────────────────────────
// Un dossier « complet » = les pièces minimales pour louer légalement : une
// pièce d'identité et un permis de conduire (numéro saisi OU photo fournie).
// Volontairement tolérant (numéro OU photo) pour ne pas sur-signaler.
//
// Deux sources de pièces cohabitent :
//   · Système B — colonnes fixes clients.*_path / *_number (saisie fiche)
//   · Système A — table `documents` (import Telegram, pièces raccrochées)
// Le second est passé en `importedSubs` (liste des sous-catégories rattachées).

import type { Client } from '@/types/database'

type DossierFields = Pick<
  Client,
  'license_number' | 'license_front_path' | 'id_doc_number' | 'id_doc_front_path'
>

// Sous-catégories (Système A) qui valent pièce d'identité / permis.
const IDENTITY_SUBS = new Set(['cni', 'titre_sejour', 'cni_permis', 'sejour_permis', 'passeport'])
const PERMIS_SUBS = new Set(['permis', 'cni_permis', 'sejour_permis'])

/**
 * Libellés des pièces manquantes (vide = dossier complet).
 * @param importedSubs sous-catégories rattachées au client via l'import (Système A).
 */
export function dossierMissing(c: DossierFields, importedSubs: string[] = []): string[] {
  const hasImportedIdentity = importedSubs.some(s => IDENTITY_SUBS.has(s))
  const hasImportedPermis = importedSubs.some(s => PERMIS_SUBS.has(s))

  const missing: string[] = []
  if (!c.id_doc_number && !c.id_doc_front_path && !hasImportedIdentity) missing.push("Pièce d'identité")
  if (!c.license_number && !c.license_front_path && !hasImportedPermis) missing.push('Permis')
  return missing
}

export function isDossierComplet(c: DossierFields, importedSubs: string[] = []): boolean {
  return dossierMissing(c, importedSubs).length === 0
}
