/**
 * Modèles d'emails clients façon « agence » (inspiré des confirmations Avis) :
 * bandeau en-tête à la charte LMS Drive (noir + accent doré), corps soigné,
 * pied de page avec coordonnées de l'agence et mention RGPD. Deux messages :
 *  - contrat de location signé au DÉPART (confirmation) ;
 *  - contrat de restitution au RETOUR (+ estimation des frais si facturés).
 *
 * Tables HTML + styles inline : c'est la seule mise en forme fiable dans les
 * clients de messagerie (Gmail, Outlook, Apple Mail…). Aucune image distante
 * n'est requise (l'en-tête est typographique), pour un rendu identique même
 * quand le client bloque le chargement des images.
 */
import type { ContractData } from '@/lib/pdf/contract-template'

type Agency = ContractData['agency']

// ── Charte LMS Drive ─────────────────────────────────────────────────────────
const NOIR = '#0A0A0A'
const OR = '#C4A35A'
const OR_CLAIR = '#D4B870'
const CREME = '#FAF7F0'
const INK = '#111111'
const MUTE = '#6B7280'
const BORDER = '#E5E7EB'

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDateTime(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
}

function fmtPrix(n?: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

/** Ligne « label / valeur » du bloc récapitulatif. */
function ligneDetail(label: string, valeur: string): string {
  return `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid ${BORDER}; color:${MUTE}; font-size:13px; white-space:nowrap;">${esc(label)}</td>
      <td style="padding:10px 0 10px 16px; border-bottom:1px solid ${BORDER}; color:${INK}; font-size:14px; font-weight:600; text-align:right;">${valeur}</td>
    </tr>`
}

/** Coordonnées de contact non vides, façon « au 01 23 … · email ». */
function contactInline(agency: Agency): string {
  const bits = [agency?.phone, agency?.email].filter(Boolean)
  return bits.map(b => esc(b)).join(' · ')
}

/** Enveloppe commune : en-tête, corps injecté, pied de page + RGPD. */
function layout(opts: {
  preheader: string
  refLabel: string
  refValue: string
  body: string
  agency: Agency
}): string {
  const { preheader, refLabel, refValue, body, agency } = opts
  const contact = contactInline(agency)
  const adresse = esc(agency?.address)
  return `
<!-- preheader (aperçu masqué) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

      <!-- En-tête -->
      <tr><td style="background:${NOIR};padding:30px 32px;text-align:center;">
        <div style="font-size:26px;font-weight:800;letter-spacing:4px;color:${OR};">LMS DRIVE</div>
        <div style="font-size:11px;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;margin-top:6px;">Location de véhicules</div>
      </td></tr>
      <tr><td style="height:4px;background:${OR};background:linear-gradient(90deg,${OR},${OR_CLAIR});font-size:0;line-height:0;">&nbsp;</td></tr>

      <!-- Référence du document -->
      <tr><td style="background:${CREME};padding:16px 32px;">
        <div style="font-size:12px;color:${MUTE};text-transform:uppercase;letter-spacing:1px;">${esc(refLabel)}</div>
        <div style="font-size:18px;font-weight:700;color:${INK};margin-top:2px;">${esc(refValue)}</div>
      </td></tr>

      <!-- Corps -->
      <tr><td style="padding:28px 32px;color:${INK};font-size:15px;line-height:1.65;">
        ${body}
      </td></tr>

      <!-- Pied de page -->
      <tr><td style="background:${NOIR};padding:24px 32px;text-align:center;">
        <div style="font-size:15px;font-weight:700;letter-spacing:3px;color:${OR};">LMS DRIVE</div>
        ${agency?.companyName ? `<div style="color:#D1D5DB;font-size:12px;margin-top:8px;">${esc(agency.companyName)}</div>` : ''}
        ${contact ? `<div style="color:#9CA3AF;font-size:12px;margin-top:4px;">${contact}</div>` : ''}
        ${adresse ? `<div style="color:#9CA3AF;font-size:12px;margin-top:4px;">${adresse}</div>` : ''}
      </td></tr>

      <!-- Mention RGPD -->
      <tr><td style="padding:16px 32px 24px;">
        <p style="color:#9CA3AF;font-size:11px;line-height:1.5;margin:0;">
          Vos données personnelles (nom, coordonnées, pièce d'identité, permis de conduire) sont traitées par
          ${esc(agency?.companyName || 'LMS Drive')} dans le cadre de l'exécution du contrat de location (Art. 6.1.b RGPD).
          Elles sont conservées 5 ans à compter de la fin du contrat. Vous disposez d'un droit d'accès, de
          rectification, d'effacement et de portabilité ; pour les exercer, contactez-nous par email.
          Ceci est un message automatique, merci de ne pas y répondre.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>`
}

interface Partie {
  client: { firstName?: string | null; lastName?: string | null }
  vehicle: { brand?: string | null; model?: string | null; plate?: string | null }
  contractNumber: string
  startDatetime?: string | null
  endDatetime?: string | null
  agency: Agency
}

/** Contrat de location signé au départ (confirmation). */
export function contractDepartEmail(p: Partie & { totalPrice?: number | null }): {
  subject: string
  html: string
} {
  const prenom = esc(p.client.firstName)
  const vehicule = `${esc(p.vehicle.brand)} ${esc(p.vehicle.model)}`.trim()
  const plaque = esc(p.vehicle.plate)
  const contact = contactInline(p.agency)

  const body = `
    <p style="margin:0 0 16px;">Bonjour ${prenom},</p>
    <p style="margin:0 0 16px;">
      Merci d'avoir choisi <strong>LMS Drive</strong> pour votre location. Votre contrat est signé et confirmé.
    </p>
    <p style="margin:0 0 20px;">
      Vous trouverez <strong>ci-joint votre contrat de location</strong> pour le véhicule
      <strong>${vehicule}${plaque ? ` (${plaque})` : ''}</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREME};border-radius:10px;padding:6px 18px;margin:0 0 22px;">
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${ligneDetail('Véhicule', `${vehicule}${plaque ? ` — ${plaque}` : ''}`)}
          ${ligneDetail('Départ', fmtDateTime(p.startDatetime))}
          ${ligneDetail('Retour prévu', fmtDateTime(p.endDatetime))}
          ${p.totalPrice != null ? ligneDetail('Montant total', fmtPrix(p.totalPrice)) : ''}
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 16px;">
      Conservez précieusement ce document : il détaille les conditions de location ainsi que l'état des lieux
      du véhicule au départ.
    </p>
    ${contact ? `<p style="margin:0 0 16px;">Pour toute question, n'hésitez pas à nous contacter (${contact}).</p>` : ''}
    <p style="margin:0 0 4px;">Nous vous souhaitons une excellente route.</p>
    <p style="margin:0;color:${MUTE};">Cordialement,<br><strong style="color:${INK};">L'équipe LMS Drive</strong></p>`

  return {
    subject: `Votre contrat de location ${p.contractNumber}`,
    html: layout({
      preheader: `Votre contrat de location ${p.contractNumber} est confirmé — LMS Drive`,
      refLabel: 'Contrat de location',
      refValue: `N° ${p.contractNumber}`,
      body,
      agency: p.agency,
    }),
  }
}

/** Contrat de restitution au retour (+ estimation des frais si facturés). */
export function contractRetourEmail(p: Partie & { hasInvoice: boolean }): {
  subject: string
  html: string
} {
  const prenom = esc(p.client.firstName)
  const vehicule = `${esc(p.vehicle.brand)} ${esc(p.vehicle.model)}`.trim()
  const plaque = esc(p.vehicle.plate)
  const contact = contactInline(p.agency)

  const body = `
    <p style="margin:0 0 16px;">Bonjour ${prenom},</p>
    <p style="margin:0 0 16px;">
      Merci d'avoir restitué votre véhicule chez <strong>LMS Drive</strong>.
    </p>
    <p style="margin:0 0 20px;">
      Vous trouverez <strong>ci-joint votre contrat de restitution</strong>, comprenant les états des lieux
      de départ et de retour${p.hasInvoice ? `, ainsi qu'une <strong>estimation des frais de location</strong>` : ''}.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREME};border-radius:10px;padding:6px 18px;margin:0 0 22px;">
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${ligneDetail('Véhicule', `${vehicule}${plaque ? ` — ${plaque}` : ''}`)}
          ${ligneDetail('Départ', fmtDateTime(p.startDatetime))}
          ${ligneDetail('Retour', fmtDateTime(p.endDatetime))}
        </table>
      </td></tr>
    </table>
    ${p.hasInvoice ? `<p style="margin:0 0 16px;">Le détail des éléments facturés lors de la restitution figure dans l'estimation jointe.</p>` : ''}
    ${contact ? `<p style="margin:0 0 16px;">En cas de question, n'hésitez pas à nous contacter (${contact}).</p>` : ''}
    <p style="margin:0 0 4px;">Nous espérons vous revoir très bientôt chez LMS Drive.</p>
    <p style="margin:0;color:${MUTE};">Cordialement,<br><strong style="color:${INK};">L'équipe LMS Drive</strong></p>`

  return {
    subject: `Votre contrat de restitution ${p.contractNumber}`,
    html: layout({
      preheader: `Votre contrat de restitution${p.hasInvoice ? ' et l\'estimation des frais' : ''} — LMS Drive`,
      refLabel: 'Contrat de restitution',
      refValue: `N° ${p.contractNumber}`,
      body,
      agency: p.agency,
    }),
  }
}

/**
 * Invitation d'un membre de l'équipe (gérant, associé, employé, prestataire).
 * Email interne : charte noir & blanc LMS Drive (logo blanc sur bandeau noir),
 * enveloppe dédiée — pas de coordonnées d'agence ni de mention RGPD « contrat
 * de location », remplacée par une note propre au compte collaborateur.
 */

/** Logo hébergé sur la prod (les clients mail exigent une URL publique ;
 *  jamais localhost, même pour un envoi depuis l'environnement de dev). */
const LOGO_BLANC = 'https://lms-drive.vercel.app/logo-white.png'
export function inviteEmail(p: {
  /** Nom de la personne qui invite (ex. le gérant). */
  inviterName: string
  /** Nom complet de l'invité, tel que saisi dans le formulaire. */
  inviteeName: string
  /** Libellé du rôle attribué (« Employé », « Associé »…). */
  roleLabel: string
  /** Lien d'activation Supabase (action_link) vers /auth/confirm. */
  actionLink: string
}): { subject: string; html: string } {
  const invitant = esc(p.inviterName)
  const prenom = esc(p.inviteeName.split(' ')[0])
  const role = esc(p.roleLabel)
  const lien = esc(p.actionLink)

  const preheader = `${p.inviterName} vous a créé un espace ${p.roleLabel} sur LMS Drive`

  const html = `
<!-- preheader (aperçu masqué) -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

      <!-- En-tête : logo blanc sur fond noir (alt typographique si images bloquées) -->
      <tr><td style="background:${NOIR};padding:26px 32px;text-align:center;">
        <img src="${LOGO_BLANC}" alt="LMS DRIVE" width="150"
             style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
        <div style="font-size:11px;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;margin-top:8px;">Plateforme de gestion</div>
      </td></tr>

      <!-- Bandeau invitation -->
      <tr><td style="background:#F5F5F5;border-bottom:1px solid ${BORDER};padding:16px 32px;">
        <div style="font-size:12px;color:${MUTE};text-transform:uppercase;letter-spacing:1px;">Invitation</div>
        <div style="font-size:18px;font-weight:700;color:${INK};margin-top:2px;">Votre espace ${role}</div>
      </td></tr>

      <!-- Corps -->
      <tr><td style="padding:28px 32px;color:${INK};font-size:15px;line-height:1.65;">
        <p style="margin:0 0 16px;">Bonjour ${prenom},</p>
        <p style="margin:0 0 16px;">
          <strong>${invitant}</strong> vous a créé un espace <strong>${role}</strong> sur
          <strong>LMS Drive</strong>, la plateforme de gestion de l'agence : véhicules,
          réservations, calendrier, documents et équipe.
        </p>
        <p style="margin:0 0 24px;">
          Votre espace est déjà configuré. Il ne vous reste qu'à choisir votre mot de passe
          pour y accéder.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td align="center">
            <a href="${lien}"
               style="display:inline-block;background:${NOIR};color:#FFFFFF;font-size:15px;font-weight:700;letter-spacing:1px;text-decoration:none;padding:15px 36px;border-radius:10px;">
              CRÉER MON ESPACE
            </a>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;color:${MUTE};font-size:13px;">
          Ce lien est personnel et valable 24&nbsp;heures. S'il a expiré, demandez à
          ${invitant} de renvoyer l'invitation.
        </p>
        <p style="margin:0 0 16px;color:${MUTE};font-size:12px;word-break:break-all;">
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br>
          <a href="${lien}" style="color:${MUTE};">${lien}</a>
        </p>
        <p style="margin:0;color:${MUTE};">À très vite,<br><strong style="color:${INK};">L'équipe LMS Drive</strong></p>
      </td></tr>

      <!-- Pied de page -->
      <tr><td style="background:${NOIR};padding:20px 32px;text-align:center;">
        <img src="${LOGO_BLANC}" alt="LMS DRIVE" width="90"
             style="display:inline-block;width:90px;height:auto;border:0;" />
      </td></tr>

      <!-- Mention compte -->
      <tr><td style="padding:16px 32px 24px;">
        <p style="color:#9CA3AF;font-size:11px;line-height:1.5;margin:0;">
          Vous recevez cet email car un compte collaborateur a été créé à votre adresse sur
          LMS Drive. Si vous n'êtes pas concerné, ignorez simplement ce message — aucun accès
          ne sera activé sans ce lien. Message automatique, merci de ne pas y répondre.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>`

  return {
    subject: `${p.inviterName} vous invite à rejoindre LMS Drive`,
    html,
  }
}
