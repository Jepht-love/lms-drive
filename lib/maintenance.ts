// ─── Module Entretien — constantes & types partagés ───────────────────────────

export interface MaintenanceRecord {
  id: string
  vehicle_id: string
  type: string
  description: string | null
  date: string
  km_at_intervention: number | null
  amount: number | null
  provider: string | null
  invoice_url: string | null
  notes: string | null
  paid_at: string | null        // date de règlement → déclenche la dépense en compta
  paid_method: string | null    // mode de paiement du règlement
  created_at: string
  // ─── Le suivi du TRAVAIL, ajouté le 02/08/2026 (migration 074) ──────────────
  // Indépendant du suivi de l'argent au-dessus : une intervention peut être
  // terminée sans être réglée, et réglée sans que le garage ait fini.
  urgency?: UrgencyKey
  due_date?: string | null
  assigned_to?: string | null
  taken_by?: string | null
  taken_at?: string | null
  work_status?: WorkStatusKey
  closed_at?: string | null
  /** Prix de la main d'œuvre, à côté du prix des pièces (migration 075). */
  labor_cost?: number | null
  /** Rempli par les écrans qui joignent `profiles` : le nom, pas l'identifiant. */
  assignee?: { full_name: string | null } | null
  taker?: { full_name: string | null } | null
}

// ─── Le degré d'urgence ───────────────────────────────────────────────────────
// Trois niveaux SAISIS À LA MAIN, décidés par Jeff le 02/08/2026 : deux ne
// distinguaient pas « à faire vite » de « la voiture ne roule pas », et un calcul
// automatique interdisait de marquer une urgence immédiate.
//
// C'est ce niveau qui décide de l'entrée dans les alertes (lib/utils/alerts.ts) :
// `critique` en urgent, `haute` en important, `normale` n'alerte pas. Changer
// `alerte` ici change le tableau de bord de tout le monde.
export type UrgencyKey = 'normale' | 'haute' | 'critique'

export interface Urgency {
  key: UrgencyKey
  label: string
  /** Bloc d'alerte visé, ou null pour ne pas alerter du tout. */
  alerte: 'urgent' | 'important' | null
  dot: string
  badge: string
}

export const URGENCIES: Urgency[] = [
  { key: 'normale',  label: 'Normale',  alerte: null,        dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-600' },
  { key: 'haute',    label: 'Haute',    alerte: 'important', dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700' },
  { key: 'critique', label: 'Critique', alerte: 'urgent',    dot: 'bg-red-600',    badge: 'bg-red-600 text-white' },
]

const URGENCY_MAP: Record<string, Urgency> = Object.fromEntries(URGENCIES.map(u => [u.key, u]))

export function urgency(key: string | null | undefined): Urgency {
  return URGENCY_MAP[key ?? 'normale'] ?? URGENCIES[0]
}

// ─── Les six statuts de suivi ─────────────────────────────────────────────────
// Demandés tels quels par le gérant le 02/08/2026, dans l'ordre du parcours réel :
// on signale, quelqu'un se met dessus, le rendez-vous est pris, le garage
// travaille, c'est fini. « Annulée » sort du parcours à tout moment.
//
// `ouvert: false` veut dire « ne compte plus » : plus d'alerte, plus de véhicule
// immobilisé de ce fait.
export type WorkStatusKey =
  'a_traiter' | 'prise_en_charge' | 'rdv_programme' | 'en_cours' | 'terminee' | 'annulee'

export interface WorkStatus {
  key: WorkStatusKey
  label: string
  ouvert: boolean
  badge: string
}

export const WORK_STATUSES: WorkStatus[] = [
  { key: 'a_traiter',       label: 'À traiter',           ouvert: true,  badge: 'bg-gray-100 text-gray-600' },
  { key: 'prise_en_charge', label: 'Prise en charge',     ouvert: true,  badge: 'bg-blue-50 text-blue-700' },
  { key: 'rdv_programme',   label: 'Rendez-vous programmé', ouvert: true, badge: 'bg-indigo-50 text-indigo-700' },
  { key: 'en_cours',        label: 'En cours',            ouvert: true,  badge: 'bg-violet-50 text-violet-700' },
  { key: 'terminee',        label: 'Terminée',            ouvert: false, badge: 'bg-green-50 text-green-700' },
  { key: 'annulee',         label: 'Annulée',             ouvert: false, badge: 'bg-gray-100 text-gray-400' },
]

const WORK_STATUS_MAP: Record<string, WorkStatus> = Object.fromEntries(
  WORK_STATUSES.map(s => [s.key, s]),
)

export function workStatus(key: string | null | undefined): WorkStatus {
  return WORK_STATUS_MAP[key ?? 'a_traiter'] ?? WORK_STATUSES[0]
}

/** Les statuts qui ferment le dossier : plus d'alerte, plus rien à faire. */
export const WORK_STATUSES_CLOS: WorkStatusKey[] = ['terminee', 'annulee']

// ─── Le détail d'une facture de garage (migration 075, 02/08/2026) ───────────

/** Une pièce remplacée : ce que c'est, combien, à quel prix l'unité. */
export interface MaintenancePart {
  id?: string
  maintenance_id?: string
  label: string
  quantity: number
  unit_price: number
}

/** Ce que coûtent les pièces d'une intervention, hors main d'œuvre. */
export function totalPieces(parts: { quantity: number; unit_price: number }[]): number {
  return parts.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0)
}

// ─── Le contrôle des corrections de montant ──────────────────────────────────
//
// Voulu par Jeff le 01/08/2026 contre les faux justificatifs qui gonflent les
// factures. Le seuil est le PLUS PETIT des deux : 20 % de l'ancien montant, ou
// 20 €. Sur une facture de 500 €, une correction de 25 € déclenche donc déjà le
// contrôle, parce que 20 € est plus petit que les 100 € que ferait 20 %.
//
// Ne s'applique que si l'agence a allumé l'interrupteur
// (`agency_settings.require_amount_validation`, éteint par défaut) : chez un
// client où personne d'autre ne peut valider, la correction passe seule.
export const ECART_POURCENT = 0.2
export const ECART_EUROS = 20

export function correctionSoumiseAControle(ancien: number, nouveau: number): boolean {
  const ecart = Math.abs((Number(nouveau) || 0) - (Number(ancien) || 0))
  if (ecart === 0) return false
  const seuil = Math.min(Math.abs(Number(ancien) || 0) * ECART_POURCENT, ECART_EUROS)
  return ecart >= seuil
}

export interface MaintenanceType {
  key: string
  label: string
  dot: string
}

export const MAINTENANCE_TYPES: MaintenanceType[] = [
  { key: 'carburant',          label: 'Carburant',          dot: 'bg-blue-500' },
  { key: 'lavage',             label: 'Lavage',             dot: 'bg-cyan-500' },
  { key: 'revision',           label: 'Révision',           dot: 'bg-amber-500' },
  { key: 'vidange',            label: 'Vidange',            dot: 'bg-orange-500' },
  { key: 'pneus',              label: 'Pneus',              dot: 'bg-gray-500' },
  { key: 'freins',             label: 'Freins',             dot: 'bg-red-500' },
  { key: 'reparation',         label: 'Réparation',         dot: 'bg-purple-500' },
  { key: 'carrosserie',        label: 'Carrosserie',        dot: 'bg-indigo-500' },
  { key: 'controle_technique', label: 'Contrôle technique', dot: 'bg-green-600' },
  { key: 'autre',              label: 'Autre',              dot: 'bg-gray-400' },
]

const TYPE_MAP: Record<string, MaintenanceType> = Object.fromEntries(
  MAINTENANCE_TYPES.map(t => [t.key, t])
)

export function maintenanceType(key: string): MaintenanceType {
  return TYPE_MAP[key] ?? MAINTENANCE_TYPES[MAINTENANCE_TYPES.length - 1]
}

// ─── Angles d'entretien ───────────────────────────────────────────────────────
// Le gérant veut voir l'entretien sous 3 angles regroupant les types, classés
// par ordre de priorité (Réparation la plus urgente en tête). « Budget réparation »
// = le total de l'angle Réparation. Chaque type appartient à exactement un angle.
export type MaintenanceAngleId = 'reparation' | 'usure' | 'entretien' | 'autre'

export interface MaintenanceAngle {
  id: MaintenanceAngleId
  label: string
  types: string[]
  dot: string
}

export const MAINTENANCE_ANGLES: MaintenanceAngle[] = [
  { id: 'reparation', label: 'Réparation', types: ['reparation', 'carrosserie'], dot: 'bg-purple-500' },
  { id: 'usure',      label: 'Usure',      types: ['pneus', 'freins'], dot: 'bg-red-500' },
  { id: 'entretien',  label: 'Entretien',  types: ['revision', 'vidange', 'controle_technique', 'lavage'], dot: 'bg-amber-500' },
  { id: 'autre',      label: 'Autre',      types: ['carburant', 'autre'], dot: 'bg-gray-400' },
]

const ANGLE_OF_TYPE: Record<string, MaintenanceAngleId> = Object.fromEntries(
  MAINTENANCE_ANGLES.flatMap(a => a.types.map(t => [t, a.id] as const))
)

export function angleOfType(typeKey: string): MaintenanceAngleId {
  return ANGLE_OF_TYPE[typeKey] ?? 'autre'
}
