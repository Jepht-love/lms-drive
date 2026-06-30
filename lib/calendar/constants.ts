import type { EventType, EventStatus, AlertType } from '@/types/calendar'

export const EVENT_COLORS: Record<EventType, string> = {
  reservation:      '#3B82F6',   // bleu
  depart_vehicule:  '#10B981',   // vert émeraude
  retour_vehicule:  '#F59E0B',   // amber
  rdv_client:       '#EC4899',   // rose
  rdv_garage:       '#06B6D4',   // cyan
  livraison:        '#84CC16',   // lime
  recuperation:     '#F97316',   // orange
  tache:               '#8B5CF6',   // violet
  disponibilite:       '#E2E8F0',   // gris clair (texte sombre)
  deplacement_interne: '#0EA5E9',   // bleu ciel
  marketing:           '#EC4899',   // rose vif
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  reservation:      'Réservation',
  depart_vehicule:  'Départ véhicule',
  retour_vehicule:  'Retour véhicule',
  rdv_client:       'RDV client',
  rdv_garage:       'RDV garage',
  livraison:        'Livraison',
  recuperation:     'Récupération',
  tache:               'Tâche',
  disponibilite:       'Disponibilité',
  deplacement_interne: 'Déplacement interne',
  marketing:           'Marketing',
}

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  a_faire:  'À faire',
  en_cours: 'En cours',
  termine:  'Terminé',
  reporte:  'Reporté',
  annule:   'Annulé',
}

export const STATUS_COLORS: Record<EventStatus, string> = {
  a_faire:  '#94A3B8',
  en_cours: '#3B82F6',
  termine:  '#10B981',
  reporte:  '#F59E0B',
  annule:   '#EF4444',
}

export const ALERT_RULES: Record<AlertType, {
  offsetMinutes: number
  label: string
  eventTypes: EventType[]
}> = {
  depart_1h:          { offsetMinutes: -60,  label: 'Départ véhicule dans 1 heure',         eventTypes: ['depart_vehicule'] },
  retour_today:       { offsetMinutes: -480, label: "Retour véhicule prévu aujourd'hui",    eventTypes: ['retour_vehicule'] },
  lavage_prerental:   { offsetMinutes: -120, label: 'Lavage à effectuer avant la location', eventTypes: ['depart_vehicule'] },
  rdv_client_30min:   { offsetMinutes: -30,  label: 'Rendez-vous client dans 30 minutes',   eventTypes: ['rdv_client'] },
  rdv_garage_today:   { offsetMinutes: -480, label: "Rendez-vous garage prévu aujourd'hui", eventTypes: ['rdv_garage'] },
  etat_lieux:         { offsetMinutes: -30,  label: 'Contrôle état des lieux à effectuer',  eventTypes: ['depart_vehicule', 'retour_vehicule'] },
  paiement_caution:   { offsetMinutes: -60,  label: 'Paiement ou caution à vérifier',       eventTypes: ['reservation'] },
  document_manquant:  { offsetMinutes: 0,    label: 'Document client manquant',             eventTypes: ['rdv_client', 'reservation'] },
}

// Palette de couleurs pour les colonnes ressources (attribution séquentielle)
export const RESOURCE_PALETTE = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
]

// Ressource virtuelle épinglée : événements sans assigné (ex. synchronisés
// depuis une réservation, avant attribution manuelle à un collaborateur/équipe).
export const UNASSIGNED_RESOURCE_ID = '__unassigned__'

// Plage horaire visible dans la grille — 07:00 jusqu'à 03:00 le lendemain
// (échelle continue, 27 = 24+3 ; chaque colonne représente une "journée
// métier" de 7h à 3h du matin suivant, pas une journée calendaire stricte).
export const CALENDAR_START_HOUR = 7
export const CALENDAR_END_HOUR   = 27

// IMPORTANT : ne jamais coder 64 en dur dans les composants — toujours importer cette constante
export const HOUR_HEIGHT_PX = 64
