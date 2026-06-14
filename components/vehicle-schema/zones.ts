export const VEHICLE_ZONES = [
  { id: 'pare_chocs_av', label: 'Pare-chocs avant', group: 'exterieur' },
  { id: 'capot', label: 'Capot', group: 'exterieur' },
  { id: 'aile_av_g', label: 'Aile avant gauche', group: 'exterieur' },
  { id: 'aile_av_d', label: 'Aile avant droite', group: 'exterieur' },
  { id: 'portiere_av_g', label: 'Portière avant gauche', group: 'exterieur' },
  { id: 'portiere_av_d', label: 'Portière avant droite', group: 'exterieur' },
  { id: 'portiere_ar_g', label: 'Portière arrière gauche', group: 'exterieur' },
  { id: 'portiere_ar_d', label: 'Portière arrière droite', group: 'exterieur' },
  { id: 'aile_ar_g', label: 'Aile arrière gauche', group: 'exterieur' },
  { id: 'aile_ar_d', label: 'Aile arrière droite', group: 'exterieur' },
  { id: 'pare_chocs_ar', label: 'Pare-chocs arrière', group: 'exterieur' },
  { id: 'hayon', label: 'Hayon / Malle', group: 'exterieur' },
  { id: 'toit', label: 'Toit', group: 'exterieur' },
  { id: 'jante_avg', label: 'Jante AV gauche', group: 'jantes' },
  { id: 'jante_avd', label: 'Jante AV droite', group: 'jantes' },
  { id: 'jante_arg', label: 'Jante AR gauche', group: 'jantes' },
  { id: 'jante_ard', label: 'Jante AR droite', group: 'jantes' },
  { id: 'interieur', label: 'Intérieur général', group: 'interieur' },
] as const

export type ZoneId = typeof VEHICLE_ZONES[number]['id']

export interface DamagedZone {
  id: ZoneId
  label: string
  severity: 'rayure' | 'dommage' | 'attention'
  description: string
  photos: string[]
}

export const MANDATORY_PHOTOS = [
  { type: 'face_avant', label: 'Face avant' },
  { type: 'arriere', label: 'Arrière' },
  { type: 'flanc_gauche', label: 'Flanc gauche' },
  { type: 'flanc_droit', label: 'Flanc droit' },
  { type: 'tableau_bord', label: 'Tableau de bord' },
  { type: 'jauge_carburant', label: 'Jauge carburant' },
  { type: 'interieur_avant', label: 'Intérieur avant' },
  { type: 'interieur_arriere', label: 'Intérieur arrière' },
  { type: 'coffre', label: 'Coffre' },
  { type: 'toit', label: 'Toit' },
  { type: 'jante_avg', label: 'Jante AV gauche' },
  { type: 'jante_avd', label: 'Jante AV droite' },
  { type: 'jante_arg', label: 'Jante AR gauche' },
  { type: 'jante_ard', label: 'Jante AR droite' },
] as const
