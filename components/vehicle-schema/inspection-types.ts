export type VehicleView = 'top' | 'front' | 'rear' | 'left' | 'right'

export type DamageSeverity = 'rayure' | 'dommage' | 'attention'

export interface DamageEntry {
  severity: DamageSeverity   // = gravité (voir GRAVITES) — pilote couleurs + flags maintenance
  type?: string              // type de dommage (voir DAMAGE_TYPES)
  comment: string
  photos: string[]
}

// Types de dommage proposés à la saisie
export const DAMAGE_TYPES: { id: string; label: string }[] = [
  { id: 'rayure',          label: 'Rayure' },
  { id: 'rayure_profonde', label: 'Rayure profonde' },
  { id: 'bosse',           label: 'Bosse / Enfoncement' },
  { id: 'impact',          label: 'Impact / Éclat' },
  { id: 'fissure',         label: 'Fissure' },
  { id: 'casse',           label: 'Élément cassé' },
  { id: 'manquant',        label: 'Manquant' },
  { id: 'crevaison',       label: 'Crevaison' },
  { id: 'usure',           label: 'Usure (pneu)' },
  { id: 'salissure',       label: 'Salissure' },
]

export function damageTypeLabel(id?: string): string {
  if (!id) return ''
  return DAMAGE_TYPES.find(t => t.id === id)?.label ?? id
}

// ─── Tarification des dommages à l'EDL retour ─────────────────────────────────
// LA SEULE SOURCE DES MONTANTS EST LE CONTRAT SIGNÉ PAR LE CLIENT, c'est-à-dire
// `getFeesTable()` dans lib/contracts/legal-articles.ts (tableau « Montant des
// frais pouvant être facturés », 27 lignes, citadine et sportif).
//
// Corrigé le 30/07/2026. Avant, ce fichier portait ses propres montants, sans
// rapport avec le contrat et identiques pour toutes les catégories : une rayure
// légère y valait 50 € alors que le client signait 300 € en citadine et 500 € en
// sportif. L'agent qui validait ce qu'on lui proposait facturait donc six à dix
// fois trop peu. Ne jamais réintroduire de montant ici : toute évolution passe
// par la grille contractuelle, sinon le logiciel facture autre chose que ce qui
// a été signé.
//
// Le montant reste modifiable au cas par cas à l'écran : c'est une proposition,
// pas une facturation automatique.

/** Zones vitrées : leur casse relève de la ligne « Pare-brise, vitre cassé ». */
const ZONES_VITRAGE = new Set([
  'pare-brise', 'lunette-arriere',
  'vitre-avant-gauche', 'vitre-arriere-gauche', 'vitre-laterale-gauche',
  'vitre-avant-droite', 'vitre-arriere-droite', 'vitre-laterale-droite',
])

/** Zones de jante : le contrat les tarife à part de la carrosserie. */
const ZONES_JANTE = new Set([
  'jante-av-gauche', 'jante-av-droite', 'jante-ar-gauche', 'jante-ar-droite',
])

export interface TarifDommage {
  /** Montant proposé. `null` quand le contrat renvoie à un devis. */
  montant: number | null
  /** Ligne du contrat appliquée, à montrer à l'agent pour qu'il sache d'où vient le prix. */
  ligne: string
  /** Ce qu'il faut afficher quand il n'y a pas de montant à proposer. */
  mention?: string
}

/**
 * Tarif contractuel d'un dommage constaté au retour.
 *
 * Attend le type de dommage saisi, la zone touchée (elle décide entre vitrage,
 * jante et carrosserie) et la catégorie du véhicule loué. Rend le montant du
 * contrat, ou `null` quand le contrat dit « sur devis » — dans ce cas l'agent
 * saisit le montant du devis, aucun chiffre n'est inventé à sa place.
 *
 * Utilisé par InspectionFlow (proposition de prix par zone à l'EDL retour).
 * Les dégradations INTÉRIEURES ne passent pas par ici : leur montant est saisi
 * librement (voir INTERIOR_DAMAGE_ITEMS).
 */
export function tarifDommage(
  type: string | undefined,
  zoneId: string | undefined,
  vehicleCategory: string | undefined,
): TarifDommage {
  const sport = vehicleCategory === 'sportif'
  const surDevis = (ligne: string): TarifDommage => ({
    montant: null,
    ligne,
    mention: sport ? 'Sur devis + 50 % de frais' : 'Sur devis + 30 % de frais',
  })

  if (!type) return { montant: null, ligne: '' }

  const vitrage = !!zoneId && ZONES_VITRAGE.has(zoneId)
  const jante = !!zoneId && ZONES_JANTE.has(zoneId)

  switch (type) {
    case 'rayure':
      return jante
        ? { montant: sport ? 500 : 300, ligne: 'Rayure par jantes' }
        : { montant: sport ? 500 : 300, ligne: 'Rayure légère' }

    case 'rayure_profonde':
      return { montant: sport ? 800 : 500, ligne: 'Rayure profonde' }

    case 'fissure':
      if (jante) return { montant: sport ? 800 : 500, ligne: 'Fissure jantes' }
      if (vitrage) return { montant: sport ? 5000 : 1000, ligne: 'Pare-brise, vitre cassé' }
      return surDevis('Dommage carrosserie')

    // Un éclat sur une vitre prend le tarif de remplacement : arbitré par Jeff le
    // 30/07/2026, l'agent baisse à la main s'il juge le vitrage réparable.
    case 'impact':
    case 'casse':
      if (vitrage) return { montant: sport ? 5000 : 1000, ligne: 'Pare-brise, vitre cassé' }
      return surDevis('Dommage carrosserie')

    case 'bosse':
      return surDevis('Dommage carrosserie')

    case 'crevaison':
    case 'usure':
      return { montant: sport ? 700 : 400, ligne: 'Usure anormale pneu (crevaison, hernie, abîmé)' }

    case 'salissure':
      return { montant: sport ? 100 : 50, ligne: 'Nettoyage véhicule intérieur / extérieur' }

    // Le contrat ne chiffre que le tapis et les clés, qui ne sont pas des zones du
    // schéma de carrosserie. Tout autre élément manquant se saisit à la main.
    case 'manquant':
      return { montant: null, ligne: 'Élément manquant', mention: 'Montant à saisir' }

    default:
      return { montant: null, ligne: '' }
  }
}

// Postes de dégradation intérieure proposés à l'EDL retour. Contrairement aux
// dommages carrosserie, le montant est saisi librement par l'agent (pas de
// tarif par défaut) et facturé au client sur la facture de restitution.
export const INTERIOR_DAMAGE_ITEMS: { id: string; label: string }[] = [
  { id: 'int_sieges',       label: 'Sièges / assises' },
  { id: 'int_sellerie',     label: 'Sellerie / tissus' },
  { id: 'int_tableau_bord', label: 'Tableau de bord / console' },
  { id: 'int_ciel_toit',    label: 'Ciel de toit / plafonnier' },
  { id: 'int_sol',          label: 'Tapis / moquette / sol' },
  { id: 'int_nettoyage',    label: 'Nettoyage approfondi' },
  { id: 'int_odeur',        label: 'Désodorisation (tabac, animaux)' },
  { id: 'int_equipement',   label: 'Équipement manquant / cassé' },
]

// Gravité — réutilise les valeurs `severity` historiques comme identifiants
export const GRAVITES: { id: DamageSeverity; label: string; dot: string; chip: string; active: string }[] = [
  { id: 'rayure',    label: 'Léger',     dot: 'bg-yellow-400', chip: 'bg-yellow-50 text-yellow-700 border-yellow-200', active: 'bg-yellow-400 text-yellow-900 border-yellow-400' },
  { id: 'attention', label: 'Moyen',     dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 border-orange-200', active: 'bg-orange-500 text-white border-orange-500' },
  { id: 'dommage',   label: 'Important', dot: 'bg-red-600',    chip: 'bg-red-50 text-red-700 border-red-200',          active: 'bg-red-600 text-white border-red-600' },
]

export function graviteLabel(severity: DamageSeverity): string {
  return GRAVITES.find(g => g.id === severity)?.label ?? severity
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
  { id: 'pneu-av-gauche',       label: 'Pneu avant gauche',     views: ['front', 'left'] },
  { id: 'pneu-av-droite',       label: 'Pneu avant droite',     views: ['front', 'right'] },
  { id: 'pneu-ar-gauche',       label: 'Pneu arrière gauche',   views: ['rear', 'left'] },
  { id: 'pneu-ar-droite',       label: 'Pneu arrière droite',   views: ['rear', 'right'] },
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
  { id: 'vitre-laterale-gauche', label: 'Vitre arrière latérale gauche', views: ['left'] },
  { id: 'bas-de-caisse-gauche', label: 'Bas de caisse gauche',  views: ['left'] },
  { id: 'porte-avant-droite',   label: 'Porte avant droite',    views: ['right'] },
  { id: 'vitre-avant-droite',   label: 'Vitre avant droite',    views: ['right'] },
  { id: 'porte-arriere-droite', label: 'Porte arrière droite',  views: ['right'] },
  { id: 'vitre-arriere-droite', label: 'Vitre arrière droite',  views: ['right'] },
  { id: 'vitre-laterale-droite', label: 'Vitre arrière latérale droite', views: ['right'] },
  { id: 'bas-de-caisse-droite', label: 'Bas de caisse droite',  views: ['right'] },
]

export const VIEW_LABELS: Record<VehicleView, string> = {
  top:   'Dessus',
  front: 'Avant',
  rear:  'Arrière',
  left:  'Profil gauche',
  right: 'Profil droit',
}
