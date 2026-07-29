export type DocumentCategory = 'entreprise' | 'vehicule' | 'client' | 'partenaire'

export const DOCUMENT_CATEGORIES = [
  { id: 'entreprise' as const, label: 'Entreprise' },
  { id: 'vehicule'   as const, label: 'Véhicules' },
  { id: 'client'     as const, label: 'Clients' },
  { id: 'partenaire' as const, label: 'Partenaires' },
]

export const DOCUMENT_SUBCATEGORIES: Record<DocumentCategory, { id: string; label: string }[]> = {
  entreprise: [
    { id: 'kbis',                 label: 'Extrait KBIS' },
    { id: 'statuts',              label: 'Statuts de la société' },
    { id: 'attestation_assurance',label: 'Attestation assurance' },
    { id: 'rib',                  label: 'RIB' },
    { id: 'documents_comptables', label: 'Documents comptables' },
    { id: 'contrats_fournisseurs',label: 'Contrats fournisseurs' },
    { id: 'facture_achat_marchandise', label: "Facture d'achat de marchandise" },
    { id: 'autres',               label: 'Autres' },
  ],
  vehicule: [
    { id: 'carte_grise',          label: 'Carte grise' },
    { id: 'attestation_assurance',label: 'Attestation assurance' },
    { id: 'controle_technique',   label: 'Contrôle technique' },
    { id: 'certificat_cession',   label: 'Certificat de cession' },
    { id: 'pv_expertise',         label: "PV d'expertise" },
    { id: 'facture_entretien',    label: "Facture d'entretien" },
    { id: 'mise_a_disposition',   label: 'Document de mise à disposition' },
  ],
  client: [
    // « Contrat de location » et « État des lieux » retirés : les contrats (état
    // des lieux inclus) vivent dans l'onglet « Contrats et factures » généré
    // automatiquement par réservation, plus dans les pièces client.
    { id: 'cni',                  label: "Carte nationale d'identité (CNI)" },
    { id: 'titre_sejour',         label: 'Carte de séjour' },
    { id: 'permis',               label: 'Permis de conduire' },
    { id: 'cni_permis',           label: 'CNI + permis (même photo)' },
    { id: 'sejour_permis',        label: 'Carte de séjour + permis (même photo)' },
    { id: 'passeport',            label: 'Passeport' },
    { id: 'justif_domicile',      label: 'Justificatif de domicile' },
    { id: 'procuration',          label: 'Procuration' },
    { id: 'autres',               label: 'Autres' },
  ],
  partenaire: [
    { id: 'contrat_partenariat',  label: 'Contrat de partenariat' },
    { id: 'convention_mise_dispo',label: 'Convention de mise à disposition' },
    { id: 'accord_commercial',    label: 'Accord commercial' },
    { id: 'contrat_prestation',   label: 'Contrat de prestation' },
  ],
}

export const SENSITIVE_SUBCATEGORIES = ['cni', 'permis', 'cni_permis', 'sejour_permis', 'passeport', 'titre_sejour']

/**
 * Types de pièces qui portent une date de fin de validité. Sert à l'écran
 * « Import & tri » : le champ « expire le » ne s'affiche que là où il a un sens,
 * demander une date d'expiration pour un RIB ou une carte grise n'apporte rien
 * et ralentit le tri d'un lot. Ajouté le 30/07/2026.
 *
 * Une pièce absente de cette table peut toujours recevoir une date par la
 * bibliothèque : c'est le tri rapide qui ne la propose pas, pas la base qui
 * l'interdit.
 */
export const EXPIRING_SUBCATEGORIES: Record<DocumentCategory, string[]> = {
  entreprise: ['kbis', 'attestation_assurance', 'contrats_fournisseurs'],
  vehicule:   ['attestation_assurance', 'controle_technique', 'mise_a_disposition'],
  client:     ['cni', 'titre_sejour', 'permis', 'cni_permis', 'sejour_permis', 'passeport'],
  partenaire: ['contrat_partenariat', 'convention_mise_dispo', 'accord_commercial', 'contrat_prestation'],
}

export function subcategoryExpires(category: DocumentCategory, subcategoryId: string): boolean {
  return (EXPIRING_SUBCATEGORIES[category] ?? []).includes(subcategoryId)
}

export function isExpiringSoon(date: string): boolean {
  const expiry = new Date(date)
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return expiry <= in30Days && expiry >= new Date()
}

export function getSubcategoryLabel(category: DocumentCategory, subcategoryId: string): string {
  return DOCUMENT_SUBCATEGORIES[category]?.find(s => s.id === subcategoryId)?.label ?? subcategoryId
}
