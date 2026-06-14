// ─── Partenariats — constantes partagées ──────────────────────────────────────

export const OPERATION_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  planifie: { label: 'Planifié', bg: 'bg-gray-100',  text: 'text-gray-600' },
  en_cours: { label: 'En cours', bg: 'bg-blue-50',   text: 'text-blue-700' },
  termine:  { label: 'Terminé',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  litige:   { label: 'Litige',   bg: 'bg-red-50',    text: 'text-red-700' },
  cloture:  { label: 'Clôturé',  bg: 'bg-green-50',  text: 'text-green-700' },
}

// Progression normale (hors litige)
export const OPERATION_FLOW = ['planifie', 'en_cours', 'termine', 'cloture']

export function directionLabel(d: string) {
  return d === 'out' ? '→ Sortant' : '← Entrant'
}
export function directionDesc(d: string) {
  return d === 'out'
    ? 'Un de nos véhicules part chez un partenaire'
    : 'On utilise un véhicule partenaire pour un client'
}
