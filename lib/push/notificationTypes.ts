// Catalogue unique des notifications push. Sert à la fois de source de vérité
// pour le filtrage à l'envoi (broadcastPushToManagers) et pour l'écran de
// réglages (NotificationSettings). La clé de chaque type correspond exactement
// à une colonne booléenne de `notification_settings`.

export type NotificationType =
  // Réservations
  | 'new_reservation_alert'
  | 'departure_alert'
  | 'return_alert'
  | 'late_return_alert'
  | 'contract_alert'
  | 'pickup_late_alert'
  // Flotte & entretien
  | 'wash_alert'
  | 'ct_alert'
  | 'insurance_alert'
  | 'service_alert'
  // Incidents
  | 'sinistre_alert'
  | 'infraction_alert'
  | 'document_alert'
  // Tâches & calendrier
  | 'new_task_alert'
  | 'task_late_alert'

export interface NotificationTypeDef {
  key: NotificationType
  label: string
  category: 'Réservations' | 'Flotte & entretien' | 'Incidents' | 'Tâches & calendrier'
}

export const NOTIFICATION_TYPES: NotificationTypeDef[] = [
  { key: 'new_reservation_alert', label: 'Nouvelle réservation',            category: 'Réservations' },
  { key: 'departure_alert',       label: 'Départ imminent',                 category: 'Réservations' },
  { key: 'return_alert',          label: 'Retour du jour',                  category: 'Réservations' },
  { key: 'late_return_alert',     label: 'Retour en retard',                category: 'Réservations' },
  { key: 'contract_alert',        label: 'Contrat à signer / clôturer',     category: 'Réservations' },
  { key: 'pickup_late_alert',     label: 'Récupération en retard',          category: 'Réservations' },

  { key: 'wash_alert',            label: 'Lavage avant location',           category: 'Flotte & entretien' },
  { key: 'ct_alert',              label: 'Contrôle technique à échéance',   category: 'Flotte & entretien' },
  { key: 'insurance_alert',       label: 'Assurance à échéance',            category: 'Flotte & entretien' },
  { key: 'service_alert',         label: 'Révision / entretien',            category: 'Flotte & entretien' },

  { key: 'sinistre_alert',        label: 'Nouveau sinistre',                category: 'Incidents' },
  { key: 'infraction_alert',      label: 'Infraction non réglée',           category: 'Incidents' },
  { key: 'document_alert',        label: 'Document expiré',                 category: 'Incidents' },

  { key: 'new_task_alert',        label: 'Nouvelle tâche',                  category: 'Tâches & calendrier' },
  { key: 'task_late_alert',       label: 'Tâche / RDV en retard',           category: 'Tâches & calendrier' },
]

export const NOTIFICATION_DEFAULTS: Record<NotificationType, boolean> = Object.fromEntries(
  NOTIFICATION_TYPES.map(t => [t.key, true]),
) as Record<NotificationType, boolean>

// Correspondance entre le `type` d'une alerte (fetchAllAlerts) et le type de
// notification push. Utilisé par le cron pour pousser les alertes flotte /
// incidents qui n'étaient jusqu'ici qu'affichées dans l'app.
export const ALERT_TYPE_TO_NOTIF: Record<string, NotificationType> = {
  contrat:             'contract_alert',
  recuperation_retard: 'pickup_late_alert',
  ct:                  'ct_alert',
  assurance:           'insurance_alert',
  revision:            'service_alert',
  lavage:              'wash_alert',
  sinistre:            'sinistre_alert',
  infraction:          'infraction_alert',
  document:            'document_alert',
}
