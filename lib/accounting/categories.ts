// ─── Catégories comptables ────────────────────────────────────────────────────

// `nature` : charge fixe (récurrente, indépendante de l'activité) ou variable
// (proportionnelle à l'usage des véhicules).
export type CostNature = 'fixe' | 'variable'

// Les dépenses sont organisées en deux niveaux : FAMILLE (poste de regroupement,
// ex. « Maintenance liée à l'usage ») → CATÉGORIE précise (ex. « Pneumatiques »).
// La nature fixe/variable est portée par la famille. Taxonomie issue de la liste
// détaillée du gérant — chaque saisie alimente automatiquement le bon poste pour
// l'analyse financière et l'export comptable.
export interface ExpenseFamily { id: string; label: string; nature: CostNature }

export const EXPENSE_FAMILIES: ExpenseFamily[] = [
  // ── Charges fixes (de structure) ──
  { id: 'personnel',       label: 'Personnel permanent',              nature: 'fixe' },
  { id: 'locaux',          label: 'Locaux & immobilier',              nature: 'fixe' },
  { id: 'assurances',      label: 'Assurances',                       nature: 'fixe' },
  { id: 'abonnements',     label: 'Abonnements & services récurrents',nature: 'fixe' },
  { id: 'vehicules_fixe',  label: 'Véhicules (part fixe)',            nature: 'fixe' },
  { id: 'admin',           label: 'Frais administratifs',             nature: 'fixe' },
  { id: 'fiscalite',       label: 'Fiscalité & taxes',                nature: 'fixe' },
  { id: 'financement',     label: 'Financement',                      nature: 'fixe' },
  { id: 'amortissements',  label: 'Dotations aux amortissements',     nature: 'fixe' },
  // ── Charges variables (opérationnelles) ──
  { id: 'usage_vehicules', label: 'Utilisation des véhicules',        nature: 'variable' },
  { id: 'maintenance_usage', label: "Maintenance liée à l'usage",     nature: 'variable' },
  { id: 'exploitation',    label: "Coûts d'exploitation des locations",nature: 'variable' },
  { id: 'main_oeuvre',     label: "Main-d'œuvre liée à l'activité",   nature: 'variable' },
  { id: 'sinistres',       label: 'Sinistres & dommages',             nature: 'variable' },
  { id: 'commissions',     label: 'Commissions & frais commerciaux',  nature: 'variable' },
  { id: 'frais_paiement',  label: 'Frais de paiement',                nature: 'variable' },
  { id: 'marketing',       label: 'Marketing lié aux ventes',         nature: 'variable' },
  { id: 'autres',          label: 'Autres charges',                   nature: 'variable' },
]

export interface ExpenseCategory { id: string; label: string; family: string }

// NB : les identifiants historiques (carburant, reparations, entretien, lavage,
// salaires, assurance, loyer_vehicule, publicite, fournitures, amendes,
// location_vehicule_partenaire, autres_depenses, peages) sont CONSERVÉS pour ne
// casser aucune donnée existante — ils sont simplement rattachés à une famille.
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  // Personnel permanent
  { id: 'salaires',                 label: 'Salaires (personnel administratif)', family: 'personnel' },
  { id: 'salaires_dirigeants',      label: 'Salaires des dirigeants',            family: 'personnel' },
  { id: 'salaires_cadres',          label: 'Salaires des cadres permanents',     family: 'personnel' },
  { id: 'charges_sociales',         label: 'Charges sociales',                   family: 'personnel' },
  { id: 'avantages_sociaux',        label: 'Avantages sociaux (mutuelle, prévoyance)', family: 'personnel' },
  // Locaux & immobilier
  { id: 'loyer_locaux',             label: 'Loyers (bureaux, entrepôts)',        family: 'locaux' },
  { id: 'charges_locatives',        label: 'Charges locatives fixes',            family: 'locaux' },
  { id: 'taxe_fonciere',            label: 'Taxe foncière',                      family: 'locaux' },
  { id: 'assurance_locaux',         label: 'Assurance des locaux',               family: 'locaux' },
  { id: 'gardiennage',              label: 'Gardiennage',                        family: 'locaux' },
  // Assurances
  { id: 'assurance',                label: 'Assurance (général)',                family: 'assurances' },
  { id: 'assurance_multirisque',    label: 'Assurance multirisque professionnelle', family: 'assurances' },
  { id: 'assurance_rc_pro',         label: 'Responsabilité civile professionnelle', family: 'assurances' },
  { id: 'assurance_flotte',         label: 'Assurance flotte automobile (part fixe)', family: 'assurances' },
  { id: 'assurance_cyber',          label: 'Assurance cyber-risques',            family: 'assurances' },
  // Abonnements & services récurrents
  { id: 'telephone',                label: 'Téléphone fixe',                     family: 'abonnements' },
  { id: 'internet',                 label: 'Internet',                           family: 'abonnements' },
  { id: 'logiciels_saas',           label: 'Logiciels SaaS (CRM, ERP, compta…)', family: 'abonnements' },
  { id: 'hebergement_web',          label: 'Hébergement web',                    family: 'abonnements' },
  { id: 'maintenance_info',         label: 'Maintenance informatique forfaitaire', family: 'abonnements' },
  // Véhicules (part fixe)
  { id: 'loyer_vehicule',           label: 'Loyer / leasing véhicule (LLD)',     family: 'vehicules_fixe' },
  { id: 'contrat_maintenance_forfait', label: 'Contrat de maintenance forfaitaire', family: 'vehicules_fixe' },
  // Frais administratifs
  { id: 'expert_comptable',         label: "Honoraires d'expert-comptable",      family: 'admin' },
  { id: 'honoraires_juridiques',    label: 'Honoraires juridiques',              family: 'admin' },
  { id: 'commissaire_comptes',      label: 'Commissaire aux comptes',            family: 'admin' },
  { id: 'cotisations_pro',          label: 'Cotisations professionnelles',       family: 'admin' },
  { id: 'frais_bancaires',          label: 'Frais bancaires fixes',              family: 'admin' },
  // Fiscalité & taxes
  { id: 'cfe',                      label: 'Cotisation Foncière des Entreprises (CFE)', family: 'fiscalite' },
  { id: 'taxes_diverses',           label: 'Taxes diverses',                     family: 'fiscalite' },
  { id: 'redevances',               label: 'Redevances annuelles',               family: 'fiscalite' },
  // Financement
  { id: 'interets_emprunts',        label: "Intérêts d'emprunts",                family: 'financement' },
  { id: 'remboursement_credits',    label: 'Remboursements de crédits',          family: 'financement' },
  // Dotations aux amortissements
  { id: 'amort_batiments',          label: 'Amortissement bâtiments',            family: 'amortissements' },
  { id: 'amort_machines',           label: 'Amortissement machines',             family: 'amortissements' },
  { id: 'amort_informatique',       label: 'Amortissement matériel informatique',family: 'amortissements' },
  { id: 'amort_mobilier',           label: 'Amortissement mobilier',             family: 'amortissements' },
  { id: 'amort_vehicules',          label: 'Amortissement véhicules',            family: 'amortissements' },
  // Utilisation des véhicules
  { id: 'carburant',                label: 'Carburant',                          family: 'usage_vehicules' },
  { id: 'recharge_electrique',      label: 'Recharge électrique',                family: 'usage_vehicules' },
  { id: 'adblue',                   label: 'AdBlue',                             family: 'usage_vehicules' },
  { id: 'lavage',                   label: 'Lavage & nettoyage',                 family: 'usage_vehicules' },
  { id: 'produits_nettoyage',       label: 'Produits de nettoyage',              family: 'usage_vehicules' },
  { id: 'peages',                   label: 'Péages',                             family: 'usage_vehicules' },
  // Maintenance liée à l'usage
  { id: 'entretien',                label: 'Entretien courant',                  family: 'maintenance_usage' },
  { id: 'reparations',              label: 'Réparations mécaniques',             family: 'maintenance_usage' },
  { id: 'carrosserie',              label: 'Réparations carrosserie',            family: 'maintenance_usage' },
  { id: 'pneumatiques',             label: 'Pneumatiques',                       family: 'maintenance_usage' },
  { id: 'vidanges',                 label: 'Vidanges',                           family: 'maintenance_usage' },
  { id: 'freins',                   label: 'Plaquettes & disques de frein',      family: 'maintenance_usage' },
  { id: 'essuie_glaces',            label: 'Essuie-glaces',                      family: 'maintenance_usage' },
  { id: 'batteries',                label: 'Batteries',                          family: 'maintenance_usage' },
  { id: 'pieces_usure',             label: "Pièces d'usure diverses",            family: 'maintenance_usage' },
  // Coûts d'exploitation des locations
  { id: 'preparation_vehicules',    label: 'Préparation des véhicules',          family: 'exploitation' },
  { id: 'convoyage',                label: 'Convoyage',                          family: 'exploitation' },
  { id: 'livraison_recuperation',   label: 'Livraison & récupération',           family: 'exploitation' },
  { id: 'carburant_convoyeurs',     label: 'Carburant convoyeurs',               family: 'exploitation' },
  { id: 'transfert_agences',        label: 'Transfert entre agences',            family: 'exploitation' },
  { id: 'location_vehicule_partenaire', label: 'Location véhicule partenaire',   family: 'exploitation' },
  { id: 'deplacement_interne',      label: 'Déplacement interne',                family: 'exploitation' },
  // Main-d'œuvre liée à l'activité
  { id: 'salaires_convoyeurs',      label: 'Salaires convoyeurs (mission)',      family: 'main_oeuvre' },
  { id: 'interimaire_preparation',  label: 'Personnel intérimaire (préparation)',family: 'main_oeuvre' },
  { id: 'prestataire_nettoyage',    label: 'Prestataire nettoyage',              family: 'main_oeuvre' },
  { id: 'sous_traitance_maintenance', label: 'Sous-traitance maintenance',       family: 'main_oeuvre' },
  // Sinistres & dommages
  { id: 'sinistre',                 label: 'Sinistre / réparation',              family: 'sinistres' },
  { id: 'franchise_assurance',      label: "Franchise d'assurance",              family: 'sinistres' },
  { id: 'reparation_non_couverte',  label: 'Réparation non couverte',            family: 'sinistres' },
  { id: 'petites_reparations',      label: 'Petites réparations après restitution', family: 'sinistres' },
  { id: 'bris_glace',               label: 'Bris de glace non refacturé',        family: 'sinistres' },
  // Commissions & frais commerciaux
  { id: 'commission_apporteur',     label: "Commission apporteur d'affaires",    family: 'commissions' },
  { id: 'commission_plateforme',    label: 'Commission plateforme de réservation', family: 'commissions' },
  { id: 'commission_commerciaux',   label: 'Commission commerciaux',             family: 'commissions' },
  // Frais de paiement
  { id: 'commission_cb',            label: 'Commission carte bancaire',          family: 'frais_paiement' },
  { id: 'frais_paiement_en_ligne',  label: 'Frais plateforme de paiement en ligne', family: 'frais_paiement' },
  // Marketing lié aux ventes
  { id: 'publicite',                label: 'Publicité & marketing (général)',    family: 'marketing' },
  { id: 'publicite_clic',           label: 'Publicité au clic (Google/Meta Ads)',family: 'marketing' },
  { id: 'cout_acquisition',         label: "Coût d'acquisition client",          family: 'marketing' },
  { id: 'campagnes_sponsorisees',   label: 'Campagnes sponsorisées',             family: 'marketing' },
  // Autres charges
  { id: 'amendes',                  label: 'Amendes & infractions',              family: 'autres' },
  { id: 'fournitures',              label: 'Fournitures',                        family: 'autres' },
  { id: 'autres_depenses',          label: 'Autres dépenses',                    family: 'autres' },
]

const FAMILY_BY_ID = new Map(EXPENSE_FAMILIES.map(f => [f.id, f]))
const EXPENSE_CAT_BY_ID = new Map(EXPENSE_CATEGORIES.map(c => [c.id, c]))

/** Famille (poste de regroupement) d'une catégorie de dépense. */
export function expenseFamily(categoryId: string): ExpenseFamily | undefined {
  const fam = EXPENSE_CAT_BY_ID.get(categoryId)?.family
  return fam ? FAMILY_BY_ID.get(fam) : undefined
}

/** Nature (fixe/variable) d'une catégorie de dépense — défaut variable. */
export function expenseNature(categoryId: string): CostNature {
  return expenseFamily(categoryId)?.nature ?? 'variable'
}

export function getFamilyLabel(familyId: string): string {
  return FAMILY_BY_ID.get(familyId)?.label ?? familyId
}

/** Catégories de dépense groupées par famille — pour les <optgroup> et l'export. */
export function expenseCategoriesByFamily(): { family: ExpenseFamily; categories: ExpenseCategory[] }[] {
  return EXPENSE_FAMILIES.map(family => ({
    family,
    categories: EXPENSE_CATEGORIES.filter(c => c.family === family.id),
  })).filter(g => g.categories.length > 0)
}

export const REVENUE_CATEGORIES = [
  { id: 'location', label: 'Location véhicule' },
  { id: 'caution_retenue', label: 'Retenue sur caution' },
  { id: 'frais_retard', label: 'Frais de retard' },
  { id: 'km_supplementaires', label: 'Km supplémentaires' },
  { id: 'mise_a_disposition_sortante', label: 'Mise à disposition sortante' },
  { id: 'facturation', label: 'Facturation (frais de restitution)' },
  { id: 'autres_recettes', label: 'Autres recettes' },
]

const ALL = [...EXPENSE_CATEGORIES, ...REVENUE_CATEGORIES]

export function getCategoryLabel(id: string) {
  return ALL.find(c => c.id === id)?.label ?? id
}

export const PAYMENT_METHODS = [
  { id: 'especes', label: 'Espèces' },
  { id: 'virement', label: 'Virement' },
  { id: 'carte', label: 'Carte bancaire' },
  { id: 'cheque', label: 'Chèque' },
  { id: 'prelevement', label: 'Prélèvement' },
  { id: 'autre', label: 'Autre' },
]

export function paymentMethodLabel(id: string): string {
  if (id === 'non_precise') return 'Non précisé'
  return PAYMENT_METHODS.find(m => m.id === id)?.label ?? id
}

// ─── Périodes ─────────────────────────────────────────────────────────────────
export function periodRange(period: string, ref = new Date()): { from: string; to: string; label: string } {
  const d = new Date(ref)
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  switch (period) {
    case 'today':
      return { from: iso(startOfDay), to: iso(startOfDay), label: "Aujourd'hui" }
    case 'week': {
      const day = (d.getDay() + 6) % 7 // lundi = 0
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
      return { from: iso(monday), to: iso(sunday), label: 'Cette semaine' }
    }
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3)
      const from = new Date(d.getFullYear(), q * 3, 1)
      const to = new Date(d.getFullYear(), q * 3 + 3, 0)
      return { from: iso(from), to: iso(to), label: 'Ce trimestre' }
    }
    case 'year':
      return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31`, label: 'Cette année' }
    case 'last_month': {
      const from = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      const to   = new Date(d.getFullYear(), d.getMonth(), 0)
      return { from: iso(from), to: iso(to), label: 'Mois précédent' }
    }
    case 'last_quarter': {
      const q    = Math.floor(d.getMonth() / 3)
      const pq   = (q + 3) % 4
      const yr   = q === 0 ? d.getFullYear() - 1 : d.getFullYear()
      const from = new Date(yr, pq * 3, 1)
      const to   = new Date(yr, pq * 3 + 3, 0)
      return { from: iso(from), to: iso(to), label: 'Trimestre précédent' }
    }
    case 'month':
    default: {
      const from = new Date(d.getFullYear(), d.getMonth(), 1)
      const to = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return { from: iso(from), to: iso(to), label: 'Ce mois' }
    }
  }
}
