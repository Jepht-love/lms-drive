// Onglets/sections de l'application — source unique pour le filtrage des
// permissions par membre (profiles.allowed_tabs) sur la page /menu.
// Les gérants/associés voient tout ; un employé ne voit que les sections de son
// allowed_tabs (null/vide = accès complet, rétro-compatible).
// Les modules « admin » (compta, marketing, équipe, paramètres) restent
// réservés aux managers et ne sont pas concernés par allowed_tabs.

export interface AppTab {
  key: string
  href: string
  label: string
}

export const APP_TABS: AppTab[] = [
  { key: 'dashboard',      href: '/',               label: 'Tableau de bord' },
  { key: 'calendrier',     href: '/calendrier',     label: 'Calendrier' },
  { key: 'reservations',   href: '/reservations',   label: 'Réservations' },
  { key: 'clients',        href: '/clients',        label: 'Clients' },
  { key: 'vehicles',       href: '/vehicles',       label: 'Véhicules' },
  { key: 'maintenance',    href: '/maintenance',    label: 'Entretien' },
  { key: 'contracts',      href: '/contracts',      label: 'Contrats' },
  { key: 'documents',      href: '/documents',      label: 'Documents' },
  { key: 'incidents',      href: '/incidents',      label: 'Incidents' },
  { key: 'internal-trips', href: '/internal-trips', label: 'Déplacements' },
  { key: 'partnerships',   href: '/partnerships',   label: 'Partenariats' },
]

export const ALL_TAB_KEYS = APP_TABS.map(t => t.key)

/** Ensemble des hrefs autorisés à partir des clés stockées. */
export function allowedHrefSet(keys: string[] | null | undefined): Set<string> {
  if (!keys || keys.length === 0) return new Set(APP_TABS.map(t => t.href))
  return new Set(APP_TABS.filter(t => keys.includes(t.key)).map(t => t.href))
}
