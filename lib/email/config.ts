/**
 * Configuration centralisée de l'envoi email (Resend).
 *
 * ── Sans domaine vérifié (mode démo / test) ──────────────────────────────────
 * Resend n'autorise alors que l'expéditeur de test `onboarding@resend.dev`, et
 * il ne délivre QU'À l'adresse du compte Resend (celle de l'inscription).
 * Définir `RESEND_DEMO_TO=<email du compte Resend>` route tous les envois vers
 * cette boîte — l'email du vrai destinataire reste affiché dans le corps du
 * message. Idéal pour montrer « le contrat part bien par email » en démo.
 *
 * ── En production (une fois un domaine vérifié dans Resend) ───────────────────
 *   - RESEND_FROM="LMS Drive <noreply@ton-domaine.fr>"
 *   - supprimer RESEND_DEMO_TO
 * → aucune modification de code nécessaire, tout passe par ces variables.
 */

/** Expéditeur. Par défaut l'adresse de test Resend (marche sans domaine). */
export const RESEND_FROM =
  process.env.RESEND_FROM ?? 'LMS Drive <onboarding@resend.dev>'

/**
 * Destinataire effectif : la boîte de démo si `RESEND_DEMO_TO` est définie,
 * sinon le vrai destinataire. Permet en mode test de garantir la délivrance
 * sans dépendre de l'adresse du client.
 */
export function resendTo(realRecipient: string): string {
  return process.env.RESEND_DEMO_TO || realRecipient
}
