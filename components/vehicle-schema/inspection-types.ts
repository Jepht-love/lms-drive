export type VehicleView = 'top' | 'front' | 'rear' | 'left' | 'right'

export interface DamageEntry {
  severity: 'rayure' | 'dommage' | 'attention'
  comment: string
  photos: string[]
}

export type DamageZone = {
  id: string
  label: string
  views: VehicleView[]
}

export const VEHICLE_ZONES: DamageZone[] = [
  { id: 'capot',                label: 'Capot',                 views: ['top', 'front'] },
  { id: 'pare-brise',           label: 'Pare-brise',            views: ['top', 'front'] },
  { id: 'toit',                 label: 'Toit',                  views: ['top'] },
  { id: 'lunette-arriere',      label: 'Lunette arrière',       views: ['top', 'rear'] },
  { id: 'coffre',               label: 'Coffre',                views: ['top', 'rear'] },
  { id: 'retroviseur-gauche',   label: 'Rétroviseur gauche',    views: ['top', 'left'] },
  { id: 'retroviseur-droit',    label: 'Rétroviseur droit',     views: ['top', 'right'] },
  { id: 'jante-av-gauche',      label: 'Jante avant gauche',    views: ['top', 'front', 'left'] },
  { id: 'jante-av-droite',      label: 'Jante avant droite',    views: ['top', 'front', 'right'] },
  { id: 'jante-ar-gauche',      label: 'Jante arrière gauche',  views: ['top', 'rear', 'left'] },
  { id: 'jante-ar-droite',      label: 'Jante arrière droite',  views: ['top', 'rear', 'right'] },
  { id: 'phare-gauche',         label: 'Phare gauche',          views: ['front'] },
  { id: 'phare-droit',          label: 'Phare droit',           views: ['front'] },
  { id: 'calandre',             label: 'Calandre',              views: ['front'] },
  { id: 'pare-chocs-avant',     label: 'Pare-chocs avant',      views: ['front'] },
  { id: 'plaque-avant',         label: 'Plaque avant',          views: ['front'] },
  { id: 'aile-avant-gauche',    label: 'Aile avant gauche',     views: ['front', 'left'] },
  { id: 'aile-avant-droite',    label: 'Aile avant droite',     views: ['front', 'right'] },
  { id: 'feu-arriere-gauche',   label: 'Feu arrière gauche',    views: ['rear'] },
  { id: 'feu-arriere-droit',    label: 'Feu arrière droit',     views: ['rear'] },
  { id: 'pare-chocs-arriere',   label: 'Pare-chocs arrière',    views: ['rear'] },
  { id: 'plaque-arriere',       label: 'Plaque arrière',        views: ['rear'] },
  { id: 'aile-arriere-gauche',  label: 'Aile arrière gauche',   views: ['rear', 'left'] },
  { id: 'aile-arriere-droite',  label: 'Aile arrière droite',   views: ['rear', 'right'] },
  { id: 'porte-avant-gauche',   label: 'Porte avant gauche',    views: ['left'] },
  { id: 'vitre-avant-gauche',   label: 'Vitre avant gauche',    views: ['left'] },
  { id: 'porte-arriere-gauche', label: 'Porte arrière gauche',  views: ['left'] },
  { id: 'vitre-arriere-gauche', label: 'Vitre arrière gauche',  views: ['left'] },
  { id: 'bas-de-caisse-gauche', label: 'Bas de caisse gauche',  views: ['left'] },
  { id: 'porte-avant-droite',   label: 'Porte avant droite',    views: ['right'] },
  { id: 'vitre-avant-droite',   label: 'Vitre avant droite',    views: ['right'] },
  { id: 'porte-arriere-droite', label: 'Porte arrière droite',  views: ['right'] },
  { id: 'vitre-arriere-droite', label: 'Vitre arrière droite',  views: ['right'] },
  { id: 'bas-de-caisse-droite', label: 'Bas de caisse droite',  views: ['right'] },
]

export const VIEW_LABELS: Record<VehicleView, string> = {
  top:   'Dessus',
  front: 'Avant',
  rear:  'Arrière',
  left:  'Profil gauche',
  right: 'Profil droit',
}
