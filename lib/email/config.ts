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
 * ⛔️ COUPE-CIRCUIT TEST — envois clients SUSPENDUS (24/07/2026, demande Jepht).
 *
 * Tant que `EMAILS_TEST_MODE` est à `true`, TOUS les emails (contrat, facture,
 * relance, invitation, notifications…) sont redirigés vers `EMAILS_TEST_INBOX` :
 * AUCUN client ne reçoit quoi que ce soit, mais Jepht continue de voir passer les
 * emails pour vérifier le rendu et le flux pendant les tests.
 *
 * ▶️ POUR RÉACTIVER LES ENVOIS RÉELS : repasser `EMAILS_TEST_MODE` à `false`
 * (une seule ligne), commit + push. Rien d'autre à toucher.
 *
 * Ce garde-fou est central : les 7 points d'envoi passent tous par `resendTo()`.
 * NB : les emails d'authentification Supabase (lien d'invitation/reset) ne
 * transitent PAS par ici — ils partent du service Auth Supabase directement.
 */
const EMAILS_TEST_MODE = true
const EMAILS_TEST_INBOX = 'akpadjijepht@gmail.com'

/**
 * Destinataire effectif. En mode test → boîte de test unique (aucun client servi).
 * Sinon : la boîte de démo si `RESEND_DEMO_TO` est définie, sinon le vrai client.
 */
export function resendTo(realRecipient: string): string {
  if (EMAILS_TEST_MODE) return EMAILS_TEST_INBOX
  return process.env.RESEND_DEMO_TO || realRecipient
}
