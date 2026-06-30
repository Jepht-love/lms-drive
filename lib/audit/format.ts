import { formatPrice } from '@/lib/utils'

// Traduction du journal d'audit en français lisible par tous (demandé par le
// gérant : remplacer « contract_validated · contracts » par une phrase claire).
// Le détail riche (client, véhicule…) est stocké à l'écriture dans
// metadata.summary ; sinon on reconstruit une phrase à partir des autres champs.

export type AuditTone = 'create' | 'update' | 'delete' | 'payment' | 'send' | 'status' | 'neutral'

interface ActionMeta { label: string; tone: AuditTone }

const ACTIONS: Record<string, ActionMeta> = {
  // Contrats
  contract_validated:        { label: 'Contrat validé',              tone: 'create' },
  contract_signed:           { label: 'Contrat signé',               tone: 'create' },
  contract_email_sent:       { label: 'Contrat envoyé par email',    tone: 'send' },
  contract_deleted:          { label: 'Contrat supprimé',            tone: 'delete' },
  // Réservations
  reservation_created:       { label: 'Réservation créée',           tone: 'create' },
  reservation_status_changed:{ label: 'Statut de réservation modifié', tone: 'status' },
  reservation_dates_updated: { label: 'Dates de réservation modifiées', tone: 'update' },
  reservation_prolonged:     { label: 'Réservation prolongée',       tone: 'update' },
  reservation_deleted:       { label: 'Réservation supprimée',       tone: 'delete' },
  deposit_status_updated:    { label: 'Statut de caution modifié',   tone: 'status' },
  // Véhicules
  vehicle_created:           { label: 'Véhicule ajouté',             tone: 'create' },
  vehicle_updated:           { label: 'Véhicule modifié',            tone: 'update' },
  vehicle_deleted:           { label: 'Véhicule supprimé',           tone: 'delete' },
  vehicle_status_changed:    { label: 'Statut du véhicule modifié',  tone: 'status' },
  vehicle_damage_flagged:    { label: 'Dommage signalé sur véhicule',tone: 'update' },
  vehicle_issue_resolved:    { label: 'Problème véhicule résolu',    tone: 'update' },
  // Clients
  client_created:            { label: 'Client créé',                 tone: 'create' },
  client_updated:            { label: 'Client modifié',              tone: 'update' },
  client_deleted:            { label: 'Client supprimé',             tone: 'delete' },
  client_status_changed:     { label: 'Statut client modifié',       tone: 'status' },
  // Entretien / interventions
  maintenance_created:       { label: 'Intervention enregistrée',    tone: 'create' },
  maintenance_paid:          { label: 'Intervention réglée',         tone: 'payment' },
  // Incidents
  accident_created:          { label: 'Sinistre déclaré',            tone: 'create' },
  accident_closed:           { label: 'Sinistre clôturé',            tone: 'status' },
  infraction_created:        { label: 'Infraction enregistrée',      tone: 'create' },
  // Déplacements internes
  internal_trip_started:     { label: 'Déplacement interne démarré', tone: 'create' },
  internal_trip_ended:       { label: 'Déplacement interne terminé', tone: 'update' },
  // États des lieux (EDL)
  inspection_depart_created:  { label: 'État des lieux de départ',  tone: 'create' },
  inspection_arrivee_created: { label: 'État des lieux de retour',  tone: 'create' },
  inspection_reset:          { label: 'État des lieux réinitialisé', tone: 'update' },
  // Divers
  invoice_sent:              { label: 'Facture envoyée',             tone: 'send' },
  agency_settings_updated:   { label: 'Paramètres agence modifiés',  tone: 'update' },
}

const ENTITIES: Record<string, string> = {
  contracts: 'contrat',
  reservations: 'réservation',
  vehicles: 'véhicule',
  clients: 'client',
  maintenance_records: 'intervention',
  accidents: 'sinistre',
  infractions: 'infraction',
  internal_trips: 'déplacement interne',
  financial_transactions: 'mouvement comptable',
  agency_settings: 'agence',
  inspections: 'état des lieux',
}

export function auditActionLabel(action: string): string {
  return ACTIONS[action]?.label ?? action.replace(/_/g, ' ')
}

export function auditActionTone(action: string): AuditTone {
  return ACTIONS[action]?.tone ?? 'neutral'
}

export function auditEntityLabel(entityType: string | null | undefined): string {
  if (!entityType) return ''
  return ENTITIES[entityType] ?? entityType
}

const STATUS_LABELS: Record<string, string> = {
  option: 'option', confirmee: 'confirmée', en_cours: 'en cours', terminee: 'terminée',
  annulee: 'annulée', en_retard: 'en retard', cloture: 'clôturé', declare: 'déclaré',
  disponible: 'disponible', maintenance: 'maintenance', loue: 'loué', reserve: 'réservé',
}
const human = (v: unknown) => {
  const s = String(v)
  return STATUS_LABELS[s] ?? s
}

type AuditLog = {
  action: string
  entity_type?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Détail lisible d'une entrée d'audit. Priorité au résumé pré-calculé
 * (metadata.summary, qui contient client + véhicule) ; sinon, on reconstruit
 * une phrase à partir des champs utiles du metadata (montant, statut, type…).
 */
export function formatAuditDetail(log: AuditLog): string {
  const m = log.metadata ?? {}
  if (typeof m.summary === 'string' && m.summary.trim()) return m.summary

  const parts: string[] = []
  const entity = auditEntityLabel(log.entity_type)
  if (entity) parts.push(entity)

  if (m.reservation_number) parts.push(String(m.reservation_number))
  if (m.plate) parts.push(String(m.plate))
  if (m.type) parts.push(human(m.type))
  if (m.new_status || m.status) parts.push(`→ ${human(m.new_status ?? m.status)}`)
  if (typeof m.amount === 'number' && m.amount > 0) parts.push(formatPrice(m.amount))
  if (m.method) parts.push(human(m.method))
  if (typeof m.km_reading === 'number') parts.push(`${m.km_reading.toLocaleString('fr-FR')} km`)

  return parts.join(' · ')
}
