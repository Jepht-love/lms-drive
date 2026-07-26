// Renvoi des liens d'accès aux 2 associés — à lancer depuis TA session :
//   node --env-file=.env.local scripts/renvoyer-invitations.mjs
//
// Lanani (compte non confirmé)      → lien d'INVITATION (type=invite)
// Fillebeen (compte déjà confirmé)  → lien de RÉINITIALISATION (type=recovery)
// Les deux liens retombent sur la page « Nom affiché » (choix du mot de passe).
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const PROD = 'https://lms-drive.vercel.app'
const FROM = 'LMS Drive <no-reply@sas-financial-services.com>'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)
const resend = new Resend(process.env.RESEND_API_KEY)

const CIBLES = [
  { email: 'lanani-sami@hotmail.com',     nom: 'Lanani sami',      type: 'invite'   },
  { email: 'fillebeen.alexis@gmail.com',  nom: 'Fillebeen Alexis', type: 'recovery' },
]

function emailHtml(prenom, link) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#fff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#0A0A0A;padding:26px 32px;text-align:center;">
          <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:3px;">LMS DRIVE</div>
          <div style="font-size:11px;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;margin-top:6px;">Plateforme de gestion</div>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#111827;font-size:15px;line-height:1.65;">
          <p style="margin:0 0 16px;">Bonjour ${prenom},</p>
          <p style="margin:0 0 16px;">Votre espace <strong>Associé</strong> sur <strong>LMS Drive</strong> est prêt. Il ne vous reste qu'à choisir votre nom affiché et votre mot de passe pour y accéder.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
            <tr><td align="center">
              <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#C4A35A,#D4B870);color:#0A0A0A;font-size:15px;font-weight:700;letter-spacing:1px;text-decoration:none;padding:15px 36px;border-radius:10px;">CRÉER MON ESPACE</a>
            </td></tr>
          </table>
          <p style="margin:0;color:#6B7280;font-size:13px;">Lien personnel valable 24 heures. Si vous n'êtes pas concerné, ignorez cet email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>`
}

for (const c of CIBLES) {
  const options = c.type === 'invite'
    ? { data: { full_name: c.nom, role: 'associe' } }
    : undefined
  const { data, error } = await admin.auth.admin.generateLink({ type: c.type, email: c.email, options })
  if (error) { console.log(`❌ ${c.email} — génération lien: ${error.message}`); continue }

  const link = `${PROD}/auth/confirm?token_hash=${data.properties.hashed_token}&type=${c.type}`
  const prenom = c.nom.split(' ')[0]
  const { data: sent, error: sendErr } = await resend.emails.send({
    from: FROM, to: c.email,
    subject: 'Votre espace Associé sur LMS Drive',
    html: emailHtml(prenom, link),
  })
  console.log(sendErr
    ? `❌ ${c.email} — envoi: ${JSON.stringify(sendErr)}`
    : `✅ ${c.email} — envoyé (${sent?.id})`)
}
