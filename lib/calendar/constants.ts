import type { EventType, EventStatus, AlertType } from '@/types/calendar'

export const EVENT_COLORS: Record<EventType, string> = {
  reservation:      '#3B82F6',   // bleu
  depart_vehicule:  '#10B981',   // vert émeraude
  retour_vehicule:  '#F59E0B',   // amber
  rdv_client:       '#EC4899',   // rose
  rdv_garage:       '#06B6D4',   // cyan
  rdv_autre:        '#6366F1',   // indigo
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
  rdv_autre:        'RDV autre',
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
/**
 * Couleurs proposées aux profils et aux équipes.
 *
 * **Jamais de noir ni de gris foncé ici** (règle de Jeff du 01/08/2026) : le noir
 * appartient au « Non attribué », pastille et libellé. Un profil qui le prendrait
 * se confondrait avec les missions que personne n'a prises.
 */
export const RESOURCE_PALETTE = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899',
]

// Ressource virtuelle épinglée : événements sans assigné (ex. synchronisés
// depuis une réservation, avant attribution manuelle à un collaborateur/équipe).
export const UNASSIGNED_RESOURCE_ID = '__unassigned__'

/** Gris des missions que personne n'a prises. Même valeur que la colonne « Non attribué ». */
export const UNASSIGNED_COLOR = '#94A3B8'

/**
 * Couleur d'un événement du calendrier. **La seule règle, partagée par tous les
 * affichages** : vue mois, vue jour, grille, panneau du jour, mini calendrier.
 *
 * Une mission que personne n'a prise s'affiche en GRIS, quel que soit son type
 * (demande de Jeff du 01/08/2026). Avant, elle prenait la couleur de son type et
 * se confondait avec une mission attribuée : impossible de repérer d'un coup d'œil
 * ce qui n'a pas encore de responsable.
 *
 * Une couleur choisie à la main sur l'événement (`color_override`) l'emporte
 * toujours : c'est une décision explicite de l'utilisateur.
 *
 * Ne pas contourner cette fonction en lisant EVENT_COLORS directement, sinon un
 * écran affichera une couleur et son voisin une autre pour le même événement.
 */
export function couleurEvenement(ev: {
  event_type: EventType
  color_override?: string | null
  assigned_to?: string | null
  assigned_team_id?: string | null
}): string {
  if (ev.color_override) return ev.color_override
  if (!ev.assigned_to && !ev.assigned_team_id) return UNASSIGNED_COLOR
  return EVENT_COLORS[ev.event_type] ?? UNASSIGNED_COLOR
}

// Plage horaire visible dans la grille — 07:00 jusqu'à 03:00 le lendemain
// (échelle continue, 27 = 24+3 ; chaque colonne représente une "journée
// métier" de 7h à 3h du matin suivant, pas une journée calendaire stricte).
export const CALENDAR_START_HOUR = 7
export const CALENDAR_END_HOUR   = 27

// Fuseau d'exploitation de l'agence. Les heures de départ/retour sont saisies et
// stockées naïvement dans ce fuseau. Les calculs "journée du jour" côté serveur
// (tableau de bord — exécuté en UTC sur Vercel) DOIVENT s'y référer via
// businessNow() : sinon "aujourd'hui" est calculé en UTC et, selon l'heure de
// consultation, un départ du jour bascule à tort dans "à venir".
export const BUSINESS_TZ = process.env.BUSINESS_TZ || 'Europe/Paris'

// IMPORTANT : ne jamais coder 64 en dur dans les composants — toujours importer cette constante
export const HOUR_HEIGHT_PX = 64
