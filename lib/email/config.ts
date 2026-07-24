/**
 * Configuration centralisée de l'envoi email (Resend).
 *
 * ── Routage des envois (mis à jour 24/07/2026, demande Jepht) ─────────────────
 *
 *  • Emails ÉQUIPE (invitation d'un membre, associés inclus) → envoyés en RÉEL au
 *    vrai destinataire, pour qu'il reçoive bien son lien d'accès.
 *      → resendTo(email, 'team')
 *
 *  • Emails CLIENTS (contrat de location/restitution, facture, avis d'infraction,
 *    relances, document partagé) → tant qu'on ne sert pas encore les vrais clients,
 *    ils sont TOUS redirigés vers le gérant (Marich Toulassi), qui reçoit ainsi une
 *    copie de tout. Aucun client n'est servi directement.
 *      → resendTo(email)   // kind 'client' par défaut
 *
 * ▶️ POUR SERVIR LES VRAIS CLIENTS plus tard : passer `CLIENT_EMAILS_LIVE` à `true`
 *    (une seule ligne). Les emails clients partiront alors au vrai destinataire
 *    (ou vers `RESEND_DEMO_TO` si cette variable est définie, pratique en démo).
 *
 * NB : les emails d'authentification Supabase (lien de réinitialisation de mot de
 * passe) partent du service Auth Supabase directement et ne transitent PAS par ici.
 */

/**
 * Expéditeur : adresse **no-reply** sur le domaine vérifié dans Resend
 * (`sas-financial-services.com`). Le domaine étant vérifié, n'importe quel
 * local-part (@ce-domaine) est délivrable — pas de vérification par adresse.
 * S'applique à TOUS les emails (contrat, invitation, reset, relances…).
 */
export const RESEND_FROM = 'LMS Drive <no-reply@sas-financial-services.com>'

/**
 * Boîte du gérant. Reçoit TOUS les emails clients tant que `CLIENT_EMAILS_LIVE`
 * est à `false` (le vrai client de l'email reste affiché dans le corps du message).
 */
const GERANT_INBOX = 'marich.toulassi.pro@gmail.com'

/**
 * ⛔️ Clients NON servis directement (24/07/2026, demande Jepht) : à `false`, tous
 * les emails clients sont redirigés vers `GERANT_INBOX`. Passer à `true` pour
 * envoyer aux vrais clients (fin de la redirection vers le gérant).
 */
const CLIENT_EMAILS_LIVE = false

/**
 * Destinataire effectif d'un envoi Resend.
 *  - `kind: 'team'`  → RÉEL : le membre invité (associé inclus) reçoit son lien.
 *  - `kind: 'client'` (défaut) → le gérant tant que `CLIENT_EMAILS_LIVE = false`,
 *    sinon le vrai client (ou `RESEND_DEMO_TO` en démo).
 */
export function resendTo(realRecipient: string, kind: 'client' | 'team' = 'client'): string {
  if (kind === 'team') return realRecipient
  if (CLIENT_EMAILS_LIVE) return process.env.RESEND_DEMO_TO || realRecipient
  return GERANT_INBOX
}
