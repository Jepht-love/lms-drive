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

/**
 * Expéditeur : adresse **no-reply** sur le domaine vérifié dans Resend
 * (`sas-financial-services.com`). Le domaine étant vérifié, n'importe quel
 * local-part (@ce-domaine) est délivrable — pas de vérification par adresse.
 *
 * Valeur FIGÉE dans le code (ne lit plus `process.env.RESEND_FROM`) : demande de
 * Jepht d'avoir un expéditeur no-reply, sans dépendre d'une variable d'env qui
 * pointait sur `notifications@…`. Pour changer d'adresse/domaine à l'avenir,
 * éditer cette constante (et vérifier le nouveau domaine dans Resend au besoin).
 * S'applique à TOUS les emails (contrat, invitation, reset, relances…).
 */
export const RESEND_FROM = 'LMS Drive <no-reply@sas-financial-services.com>'

/**
 * Destinataire effectif : la boîte de démo si `RESEND_DEMO_TO` est définie,
 * sinon le vrai destinataire. Permet en mode test de garantir la délivrance
 * sans dépendre de l'adresse du client.
 */
export function resendTo(realRecipient: string): string {
  return process.env.RESEND_DEMO_TO || realRecipient
}
