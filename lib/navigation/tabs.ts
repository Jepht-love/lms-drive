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
  { key: 'suivi',          href: '/suivi',          label: 'Suivi véhicule' },
  { key: 'contracts',      href: '/contracts',      label: 'Contrats' },
  { key: 'documents',      href: '/documents',      label: 'Documents' },
  { key: 'internal-trips', href: '/internal-trips', label: 'Déplacements' },
  { key: 'partnerships',   href: '/partnerships',   label: 'Partenariats' },
]

export const ALL_TAB_KEYS = APP_TABS.map(t => t.key)

// Clés d'onglets historiques fusionnées dans « suivi » (ex-Entretien / Incidents).
// Permet aux permissions déjà stockées (profiles.allowed_tabs) de continuer à
// donner accès à la page unifiée sans migration de données.
const LEGACY_TAB_KEYS: Record<string, string> = {
  maintenance: 'suivi',
  incidents: 'suivi',
}

/** Normalise une liste de clés stockées : remappe les clés historiques. */
export function normalizeTabKeys(keys: string[]): string[] {
  return keys.map(k => LEGACY_TAB_KEYS[k] ?? k)
}

/** Ensemble des hrefs autorisés à partir des clés stockées. */
export function allowedHrefSet(keys: string[] | null | undefined): Set<string> {
  if (!keys || keys.length === 0) return new Set(APP_TABS.map(t => t.href))
  const normalized = normalizeTabKeys(keys)
  return new Set(APP_TABS.filter(t => normalized.includes(t.key)).map(t => t.href))
}
