// ─── Catalogue des dégâts : types et origines ─────────────────────────────────
//
// À quoi sert ce fichier : nommer ce qui peut arriver à un véhicule, et d'où ça
// vient. C'est la liste unique partagée par l'état des lieux de retour, la saisie
// manuelle depuis la fiche du véhicule (« Faits & interventions ») et, plus tard,
// les interventions chez le garagiste et la comptabilité.
//
// Deux familles de types, et la distinction n'est pas cosmétique :
//   · FACTURABLES — leurs libellés sont ceux du tableau des frais que le client
//     SIGNE (getFeesTable, lib/contracts/legal-articles.ts). Ne jamais en inventer
//     un ni en renommer un sans changer le contrat : le client doit retrouver mot
//     pour mot ce qu'on lui facture.
//   · PANNES MÉCANIQUES — jamais facturées au client. Sans cette famille, une
//     panne n'aurait aucune case où se ranger, et l'alerte « réparé sans avoir été
//     constaté » se déclencherait à tort à chaque intervention mécanique. Validées
//     par Jeff le 30/07/2026.
//
// Les ORIGINES disent qui paie. « Location » se remplit toute seule quand le dégât
// remonte d'un état des lieux ou d'un sinistre ; les trois autres se choisissent à
// la main. Une origine autre que « location » n'a aucune recette en face : en
// comptabilité, elle ne fait que baisser la marge.
//
// Ce qu'il ne faut pas casser : les identifiants (`id`) sont écrits en base dans
// `vehicles.maintenance_flags`. Les renommer rendrait illisibles les dégâts déjà
// enregistrés.

export interface DamageTypeOption {
  id: string
  label: string
  /** Facturable au client quand l'origine est « location ». */
  facturable: boolean
}

/** Dégâts facturables — libellés repris du tableau des frais du contrat signé. */
export const DAMAGE_TYPES_FACTURABLES: DamageTypeOption[] = [
  { id: 'rayure_legere',      label: 'Rayure légère',                                 facturable: true },
  { id: 'rayure_profonde',    label: 'Rayure profonde',                               facturable: true },
  { id: 'rayure_jantes',      label: 'Rayure par jantes',                             facturable: true },
  { id: 'fissure_jantes',     label: 'Fissure jantes',                                facturable: true },
  { id: 'vitrage_casse',      label: 'Pare-brise, vitre cassé',                       facturable: true },
  { id: 'dommage_carrosserie',label: 'Dommage carrosserie',                           facturable: true },
  { id: 'pneu_anormal',       label: 'Usure anormale pneu (crevaison, hernie, abîmé)',facturable: true },
  { id: 'freinage_anormal',   label: 'Usure anormale freinage',                       facturable: true },
  { id: 'nettoyage',          label: 'Nettoyage véhicule intérieur / extérieur',      facturable: true },
  { id: 'sellerie',           label: 'Déchirure et brûlure / tâches sièges / plafonnier', facturable: true },
  { id: 'odeur',              label: 'Odeur cigarette ou autre',                      facturable: true },
  { id: 'cles_perdues',       label: 'Perte clés du véhicule',                        facturable: true },
  { id: 'tapis_manquant',     label: 'Tapis manquant',                                facturable: true },
  { id: 'erreur_carburant',   label: 'Erreur carburant (Gazole, éthanol interdit)',   facturable: true },
  { id: 'usage_anormal',      label: 'Utilisation anormale du véhicule',              facturable: true },
  { id: 'casse_mecanique',    label: 'Casse anormale mécanique',                      facturable: true },
]

/** Pannes mécaniques — jamais facturées au client, quelle que soit l'origine. */
export const DAMAGE_TYPES_PANNES: DamageTypeOption[] = [
  { id: 'panne_moteur',        label: 'Moteur',                     facturable: false },
  { id: 'panne_embrayage',     label: 'Embrayage',                  facturable: false },
  { id: 'panne_boite',         label: 'Boîte de vitesses',          facturable: false },
  { id: 'panne_freins',        label: 'Freins',                     facturable: false },
  { id: 'panne_batterie',      label: 'Batterie et électricité',    facturable: false },
  { id: 'panne_pneumatiques',  label: 'Pneumatiques (usure)',       facturable: false },
  { id: 'panne_climatisation', label: 'Climatisation',              facturable: false },
  { id: 'panne_echappement',   label: 'Échappement',                facturable: false },
  { id: 'panne_direction',     label: 'Direction et suspension',    facturable: false },
  { id: 'panne_electronique',  label: 'Électronique et calculateur',facturable: false },
]

export const DAMAGE_TYPES_ALL: DamageTypeOption[] = [
  ...DAMAGE_TYPES_FACTURABLES,
  ...DAMAGE_TYPES_PANNES,
]

const TYPE_BY_ID = new Map(DAMAGE_TYPES_ALL.map(t => [t.id, t]))

export function damageTypeLabel(id: string | null | undefined): string {
  if (!id) return 'Type non précisé'
  return TYPE_BY_ID.get(id)?.label ?? id
}

export function isDamageTypeFacturable(id: string | null | undefined): boolean {
  return !!id && (TYPE_BY_ID.get(id)?.facturable ?? false)
}

// ─── Origines ─────────────────────────────────────────────────────────────────

export type DamageOrigin = 'location' | 'usure' | 'usage_interne' | 'non_communiquee'

export const DAMAGE_ORIGINS: { id: DamageOrigin; label: string; hint: string }[] = [
  { id: 'location',        label: 'Location',         hint: "Constaté au retour d'une location ou dans un sinistre" },
  { id: 'usure',           label: 'Usure du temps',   hint: "Vieillissement normal, aucun responsable" },
  { id: 'usage_interne',   label: 'Usage interne',    hint: "Causé par un membre de l'équipe" },
  { id: 'non_communiquee', label: 'Non communiquée',  hint: "Constaté sans qu'on sache d'où ça vient" },
]

/** Les origines proposées à la saisie manuelle : « location » ne s'y choisit pas,
 *  elle est posée automatiquement par l'état des lieux ou le sinistre. */
export const DAMAGE_ORIGINS_MANUELLES = DAMAGE_ORIGINS.filter(o => o.id !== 'location')

export function damageOriginLabel(id: string | null | undefined): string {
  if (!id) return 'Non communiquée'
  return DAMAGE_ORIGINS.find(o => o.id === id)?.label ?? id
}

// ─── Non facturé : pourquoi ───────────────────────────────────────────────────
// Un dégât constaté pendant une location n'est pas toujours facturé. Garder la
// raison permet de distinguer un geste commercial d'un oubli de facturation, et
// de lire en comptabilité une réparation à payer sans recette en face.

export type NotBilledReason = 'geste_commercial' | 'assurance' | 'client_non_responsable'

export const NOT_BILLED_REASONS: { id: NotBilledReason; label: string }[] = [
  { id: 'geste_commercial',       label: 'Geste commercial' },
  { id: 'assurance',              label: "Pris en charge par l'assurance" },
  { id: 'client_non_responsable', label: 'Client non responsable' },
]

export function notBilledReasonLabel(id: string | null | undefined): string {
  if (!id) return 'Non facturé'
  return NOT_BILLED_REASONS.find(r => r.id === id)?.label ?? id
}

// ─── Poste comptable d'une réparation ─────────────────────────────────────────
// Le coût d'une réparation doit atterrir dans le bon poste de dépense
// (lib/accounting/categories.ts). Avant le 30/07/2026, ce poste était DEVINÉ en
// cherchant des mots dans le libellé du dégât (« jante », « pare-brise »…) : si le
// mot attendu n'y était pas, tout tombait dans « Réparations mécaniques ». Le type
// du catalogue le dit maintenant sans ambiguïté.

const EXPENSE_BY_DAMAGE_TYPE: Record<string, string> = {
  rayure_legere:       'carrosserie',
  rayure_profonde:     'carrosserie',
  rayure_jantes:       'carrosserie',
  fissure_jantes:      'carrosserie',
  dommage_carrosserie: 'carrosserie',
  usage_anormal:       'carrosserie',
  vitrage_casse:       'bris_glace',
  pneu_anormal:        'pneumatiques',
  panne_pneumatiques:  'pneumatiques',
  freinage_anormal:    'freins',
  panne_freins:        'freins',
  panne_batterie:      'batteries',
  nettoyage:           'lavage',
  odeur:               'lavage',
  sellerie:            'lavage',
  tapis_manquant:      'lavage',
  cles_perdues:        'petites_reparations',
  erreur_carburant:    'reparations',
  casse_mecanique:     'reparations',
  panne_moteur:        'reparations',
  panne_embrayage:     'reparations',
  panne_boite:         'reparations',
  panne_echappement:   'reparations',
  panne_direction:     'reparations',
  panne_electronique:  'reparations',
  panne_climatisation: 'reparations',
}

/** Poste de dépense d'une réparation. Défaut : réparations mécaniques. */
export function expenseCategoryForDamageType(typeId: string | null | undefined): string {
  if (!typeId) return 'reparations'
  return EXPENSE_BY_DAMAGE_TYPE[typeId] ?? 'reparations'
}

// ─── Rubrique de l'historique d'entretien ─────────────────────────────────────
// Réparer un dégât laisse une ligne dans l'historique d'entretien du véhicule
// (MAINTENANCE_TYPES, lib/maintenance.ts). Sans elle, la réparation n'existait que
// dans la comptabilité et le véhicule n'en gardait aucune trace visible, alors que
// c'est justement là qu'on va lire son passé (constaté avec Jeff le 31/07/2026).

const MAINTENANCE_BY_DAMAGE_TYPE: Record<string, string> = {
  rayure_legere:       'carrosserie',
  rayure_profonde:     'carrosserie',
  rayure_jantes:       'carrosserie',
  fissure_jantes:      'carrosserie',
  dommage_carrosserie: 'carrosserie',
  usage_anormal:       'carrosserie',
  vitrage_casse:       'reparation',
  pneu_anormal:        'pneus',
  panne_pneumatiques:  'pneus',
  freinage_anormal:    'freins',
  panne_freins:        'freins',
  nettoyage:           'lavage',
  odeur:               'lavage',
  sellerie:            'lavage',
  tapis_manquant:      'lavage',
  erreur_carburant:    'carburant',
  cles_perdues:        'autre',
  casse_mecanique:     'reparation',
  panne_moteur:        'reparation',
  panne_embrayage:     'reparation',
  panne_boite:         'reparation',
  panne_batterie:      'reparation',
  panne_echappement:   'reparation',
  panne_direction:     'reparation',
  panne_electronique:  'reparation',
  panne_climatisation: 'reparation',
}

/** Rubrique de l'historique d'entretien. Défaut : réparation. */
export function maintenanceTypeForDamageType(typeId: string | null | undefined): string {
  if (!typeId) return 'reparation'
  return MAINTENANCE_BY_DAMAGE_TYPE[typeId] ?? 'reparation'
}
