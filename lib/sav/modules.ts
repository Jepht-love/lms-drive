// Traduit un chemin d'URL en nom de module lisible pour le pré-remplissage du
// formulaire SAV. Le plus long préfixe qui correspond gagne (ordre décroissant).
const MODULE_MAP: { prefix: string; label: string }[] = [
  { prefix: '/reservations',   label: 'Réservations' },
  { prefix: '/inspections',    label: 'États des lieux' },
  { prefix: '/calendrier',     label: 'Calendrier' },
  { prefix: '/clients',        label: 'Clients' },
  { prefix: '/vehicles',       label: 'Véhicules' },
  { prefix: '/suivi',          label: 'Suivi véhicule' },
  { prefix: '/maintenance',    label: 'Entretien' },
  { prefix: '/contracts',      label: 'Contrats' },
  { prefix: '/incidents',      label: 'Incidents' },
  { prefix: '/internal-trips', label: 'Déplacements' },
  { prefix: '/partnerships',   label: 'Partenariats' },
  { prefix: '/accounting',     label: 'Comptabilité' },
  { prefix: '/marketing',      label: 'Marketing' },
  { prefix: '/equipe',         label: 'Équipe' },
  { prefix: '/documents',      label: 'Documents' },
  { prefix: '/emails',         label: 'Emails' },
  { prefix: '/settings',       label: 'Paramètres' },
  { prefix: '/alerts',         label: 'Alertes' },
  { prefix: '/notifications',  label: 'Notifications' },
  { prefix: '/menu',           label: 'Menu' },
  { prefix: '/sav',            label: 'SAV' },
]

export function moduleFromPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Tableau de bord'
  const match = MODULE_MAP
    .filter(m => pathname === m.prefix || pathname.startsWith(m.prefix + '/'))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  return match?.label ?? 'Application'
}

// Sous-vue déduite automatiquement de l'URL pour les modules à sous-routes
// (ex. la comptabilité). Sert de pré-remplissage quand la page ne déclare pas
// elle-même de sous-vue via useSavSection.
const SECTION_MAP: { prefix: string; label: string }[] = [
  { prefix: '/accounting/kpi',       label: 'KPI' },
  { prefix: '/accounting/due-dates', label: 'Échéances' },
  { prefix: '/accounting/close',     label: 'Clôtures' },
  { prefix: '/accounting/analysis',  label: 'Analyse' },
  { prefix: '/accounting/report',    label: 'Rapport' },
  { prefix: '/accounting/export',    label: 'Export' },
  { prefix: '/accounting/new',       label: 'Nouveau mouvement' },
]

export function sectionFromPath(pathname: string): string | null {
  const match = SECTION_MAP
    .filter(m => pathname === m.prefix || pathname.startsWith(m.prefix + '/'))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  return match?.label ?? null
}
