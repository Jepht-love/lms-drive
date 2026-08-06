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

/**
 * Qui peut créer/modifier un véhicule et ses prix : le gérant et le
 * super-administrateur, personne d'autre (décision de Jeff du 06/08/2026).
 * L'associé voit tout mais ne touche pas aux véhicules ; pour changer un prix, il
 * en parle au gérant. **Doit dire exactement la même chose que la règle d'accès
 * de la base** (`vehicles_write_managers`, migration 080) : si l'une change,
 * l'autre aussi. Sert à griser les boutons d'écriture côté écran.
 */
export function peutEcrireVehicules(
  profile: { role?: string | null; is_admin?: boolean | null } | null | undefined,
): boolean {
  return Boolean(profile?.is_admin || profile?.role === 'gerant')
}
