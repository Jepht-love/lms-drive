import type { UserRole } from '@/types/database'

export type CalendarView = 'day' | 'week_5d' | 'week_7d' | 'month'

export type EventType =
  | 'reservation' | 'depart_vehicule' | 'retour_vehicule'
  | 'rdv_client'  | 'rdv_garage'      | 'livraison'
  | 'recuperation'| 'tache'           | 'disponibilite'
  | 'deplacement_interne' | 'marketing'

export type EventStatus = 'a_faire' | 'en_cours' | 'termine' | 'reporte' | 'annule'

export type AlertType =
  | 'depart_1h' | 'retour_today' | 'lavage_prerental'
  | 'rdv_client_30min' | 'rdv_garage_today' | 'etat_lieux'
  | 'paiement_caution' | 'document_manquant'

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  event_type: EventType
  status: EventStatus
  start_at: string
  end_at: string
  all_day: boolean
  reservation_id: string | null
  vehicle_ids: string[] | null
  client_id: string | null
  assigned_to: string | null
  assigned_team_id: string | null
  created_by: string | null
  color_override: string | null
  notes: string | null
  // Joins enrichis (colonnes réelles : vehicles.brand/model, clients.first_name/last_name)
  vehicles?: { id: string; plate: string; brand: string; model: string }[]
  client?: { id: string; first_name: string; last_name: string } | null
  assigned_profile?: { id: string; full_name: string } | null
  team?: { id: string; name: string; color: string | null } | null
}

export interface CalendarResource {
  id: string
  full_name: string
  role: UserRole | null   // null pour une ressource de type 'team'
  type: 'profile' | 'team'
  color: string   // couleur attribuée pour la colonne dans la vue multi-ressources
  visible: boolean
}

export interface CalendarTeam {
  id: string
  name: string
  color: string | null
  is_active: boolean
}

export interface CalendarAlert {
  id: string
  event_id: string
  alert_type: AlertType
  trigger_at: string
  dismissed: boolean
  event?: CalendarEvent
}
