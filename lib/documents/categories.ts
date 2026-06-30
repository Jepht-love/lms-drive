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
    { id: 'contrat_location',     label: 'Contrat de location' },
    { id: 'etat_des_lieux',       label: 'État des lieux' },
    { id: 'cni',                  label: "Carte nationale d'identité (CNI)" },
    { id: 'passeport',            label: 'Passeport' },
    { id: 'titre_sejour',         label: 'Titre de séjour' },
    { id: 'justif_domicile',      label: 'Justificatif de domicile' },
    { id: 'permis',               label: 'Permis de conduire' },
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

export const SENSITIVE_SUBCATEGORIES = ['cni', 'permis', 'passeport', 'titre_sejour']

export function isExpiringSoon(date: string): boolean {
  const expiry = new Date(date)
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return expiry <= in30Days && expiry >= new Date()
}

export function getSubcategoryLabel(category: DocumentCategory, subcategoryId: string): string {
  return DOCUMENT_SUBCATEGORIES[category]?.find(s => s.id === subcategoryId)?.label ?? subcategoryId
}
