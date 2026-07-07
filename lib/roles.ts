// ─── Rôles — libellés partagés ────────────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  gerant: 'Gérant',
  associe: 'Associé',
  employe: 'Employé',
  prestataire: 'Prestataire',
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  return ROLE_LABELS[role] ?? role
}
