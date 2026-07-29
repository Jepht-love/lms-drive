/**
 * Le tri des documents importés en masse — socle partagé par l'écran « Import &
 * tri » (`app/(dashboard)/documents/import/`), les Server Actions de
 * `lib/actions/documents.ts` et la bibliothèque (`app/(dashboard)/documents/`).
 *
 * Ce qu'il définit :
 *  - les quatre familles de la bibliothèque et, pour chacune, à quoi une pièce se
 *    rattache : un client, un véhicule, un partenaire. La société ne se rattache
 *    à rien, on lui donne seulement son type ;
 *  - le marqueur d'une pièce encore « à trier » (tag `a-trier`), qui la garde
 *    hors de la bibliothèque tant qu'elle n'a ni type ni cible ;
 *  - le nom canonique écrit au rattachement (« Carte grise AB-123-CD »), aligné
 *    sur le nommage déjà utilisé à l'affichage des pièces client.
 *
 * À ne pas casser : `isPendingDoc` reconnaît AUSSI les pièces client déposées
 * avant le 29/07/2026, qui n'ont pas le tag et se repèrent à leur `entity_id`
 * vide. Retirer cette branche ferait réapparaître ces pièces dans la
 * bibliothèque, mélangées aux documents déjà classés.
 */

import type { DocumentCategory } from './categories'
import { DOCUMENT_SUBCATEGORIES, getSubcategoryLabel } from './categories'

/** Marqueur posé sur toute pièce déposée tant qu'elle n'est pas classée. */
export const PENDING_TAG = 'a-trier'

export type TriageFamily = DocumentCategory

/**
 * Les quatre onglets de l'écran d'import, dans l'ordre d'affichage.
 * `entityType` est ce qui s'écrit dans `documents.entity_type` : les valeurs
 * suivent celles déjà employées ailleurs dans l'appli (`vehicle` au singulier,
 * `partner` pour une agence partenaire).
 */
export const TRIAGE_FAMILIES: {
  id: TriageFamily
  label: string
  /** Valeur écrite en base ; `null` = la famille ne se rattache à rien. */
  entityType: 'client' | 'vehicle' | 'partner' | null
  /** Libellé de la cible, au singulier, pour les textes de l'écran. */
  targetLabel: string
  /** Dossier du bucket `documents` où le fichier est déposé. */
  folder: string
}[] = [
  { id: 'client',     label: 'Client',     entityType: 'client',  targetLabel: 'client',     folder: 'client/a-trier' },
  { id: 'vehicule',   label: 'Véhicule',   entityType: 'vehicle', targetLabel: 'véhicule',   folder: 'vehicule/a-trier' },
  { id: 'entreprise', label: 'Société',    entityType: null,      targetLabel: 'société',    folder: 'entreprise/a-trier' },
  { id: 'partenaire', label: 'Partenaire', entityType: 'partner', targetLabel: 'partenaire', folder: 'partenaire/a-trier' },
]

export function getTriageFamily(id: string) {
  return TRIAGE_FAMILIES.find(f => f.id === id) ?? null
}

/** Type provisoire d'une pièce déposée, avant que le trieur ne choisisse le vrai. */
export const PENDING_SUBCATEGORY = 'autres'

/**
 * Vrai si la pièce est encore dans une pile à trier — donc invisible dans la
 * bibliothèque et comptée dans le badge « Import ».
 */
export function isPendingDoc(d: {
  category?: string | null
  entity_type?: string | null
  entity_id?: string | null
  is_auto_generated?: boolean | null
  tags?: string[] | null
}): boolean {
  if (d.is_auto_generated) return false
  if ((d.tags ?? []).includes(PENDING_TAG)) return true
  // Pièces client déposées avant le tag (import & tri d'origine, client seul).
  return d.category === 'client' && d.entity_type === 'client' && !d.entity_id
}

/**
 * Libellés courts servant au nom automatique. Un type absent de la table
 * retombe sur son libellé complet, jamais sur un identifiant technique.
 */
const SHORT_LABELS: Record<TriageFamily, Record<string, string>> = {
  client: {
    cni: 'CNI',
    titre_sejour: 'Titre de séjour',
    permis: 'Permis',
    cni_permis: 'CNI et permis',
    sejour_permis: 'Séjour et permis',
    passeport: 'Passeport',
    justif_domicile: 'Justif. domicile',
    procuration: 'Procuration',
    autres: 'Document',
  },
  vehicule: {
    carte_grise: 'Carte grise',
    attestation_assurance: 'Assurance',
    controle_technique: 'Contrôle technique',
    certificat_cession: 'Certificat de cession',
    pv_expertise: "PV d'expertise",
    facture_entretien: 'Facture entretien',
    mise_a_disposition: 'Mise à disposition',
  },
  entreprise: {
    kbis: 'KBIS',
    statuts: 'Statuts',
    attestation_assurance: 'Attestation assurance',
    rib: 'RIB',
    documents_comptables: 'Document comptable',
    contrats_fournisseurs: 'Contrat fournisseur',
    facture_achat_marchandise: "Facture d'achat",
    autres: 'Document',
  },
  partenaire: {
    contrat_partenariat: 'Contrat de partenariat',
    convention_mise_dispo: 'Convention de mise à disposition',
    accord_commercial: 'Accord commercial',
    contrat_prestation: 'Contrat de prestation',
  },
}

/**
 * Nom donné à une pièce quand on la classe : « Carte grise AB-123-CD »,
 * « CNI Jean Dupont ». Sans cible (société), le type suffit. Le nom du fichier
 * d'origine (IMG_4821.jpg) n'est jamais conservé.
 */
export function buildTriageDocName(
  family: TriageFamily,
  subcategory: string,
  targetLabel?: string | null,
): string {
  const short = SHORT_LABELS[family]?.[subcategory] ?? getSubcategoryLabel(family, subcategory)
  return `${short} ${targetLabel ?? ''}`.trim().slice(0, 200)
}

/** Types proposés dans la liste déroulante d'un onglet. */
export function triageSubcategories(family: TriageFamily) {
  return DOCUMENT_SUBCATEGORIES[family] ?? []
}
