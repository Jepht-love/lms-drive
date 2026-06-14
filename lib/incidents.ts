// ─── Incidents — constantes partagées (infractions + sinistres) ───────────────

export const INFRACTION_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  en_attente:      { label: 'En attente',      bg: 'bg-gray-100',  text: 'text-gray-600' },
  transmis_client: { label: 'Transmis client', bg: 'bg-blue-50',   text: 'text-blue-700' },
  conteste:        { label: 'Contesté',        bg: 'bg-orange-50', text: 'text-orange-700' },
  regle:           { label: 'Réglé',           bg: 'bg-green-50',  text: 'text-green-700' },
  cloture:         { label: 'Clôturé',         bg: 'bg-gray-50',   text: 'text-gray-400' },
}

export const INFRACTION_TYPES = [
  { id: 'exces_vitesse', label: 'Excès de vitesse' },
  { id: 'stationnement', label: 'Stationnement interdit' },
  { id: 'feu_rouge',     label: 'Feu rouge' },
  { id: 'telephone',     label: 'Téléphone au volant' },
  { id: 'autre',         label: 'Autre' },
]

export function infractionTypeLabel(id: string) {
  return INFRACTION_TYPES.find(t => t.id === id)?.label ?? id
}

export const SINISTRE_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  declare:                  { label: 'Déclaré',       bg: 'bg-yellow-50', text: 'text-yellow-700' },
  en_attente_traitement:    { label: 'En attente',    bg: 'bg-gray-100',  text: 'text-gray-600' },
  en_expertise:             { label: 'En expertise',  bg: 'bg-blue-50',   text: 'text-blue-700' },
  en_reparation:            { label: 'En réparation', bg: 'bg-orange-50', text: 'text-orange-700' },
  en_attente_remboursement: { label: 'Remboursement', bg: 'bg-purple-50', text: 'text-purple-700' },
  cloture:                  { label: 'Clôturé',       bg: 'bg-green-50',  text: 'text-green-700' },
}

// Workflow linéaire des sinistres
export const SINISTRE_FLOW = [
  'declare', 'en_attente_traitement', 'en_expertise', 'en_reparation', 'en_attente_remboursement', 'cloture',
]
