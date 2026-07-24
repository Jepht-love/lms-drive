// ─── Rôles — libellés partagés ────────────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  gerant: 'Gérant',
  associe: 'Associé',
  employe: 'Employé',
  prestataire: 'Prestataire',
}

export function roleLabel(role: string | null | undefined, isAdmin = false): string {
  // Un compte super-utilisateur (is_admin) est signé « Admin », prioritaire sur
  // son rôle technique (souvent « gerant ») — cohérent avec le Menu et l'Équipe.
  if (isAdmin) return 'Admin'
  if (!role) return '—'
  return ROLE_LABELS[role] ?? role
}
