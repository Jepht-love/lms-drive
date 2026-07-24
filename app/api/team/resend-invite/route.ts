import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { RESEND_FROM, resendTo } from '@/lib/email/config'
import { inviteEmail } from '@/lib/email/templates'
import { logEmail } from '@/lib/email/log'

const ROLE_LABELS: Record<string, string> = {
  gerant: 'Gérant',
  associe: 'Associé',
  employe: 'Employé',
  prestataire: 'Prestataire',
}

/**
 * Renvoi manuel du lien d'accès à un membre existant (sans script).
 *
 * Choix automatique du type de lien selon l'état du compte auth :
 *  • compte JAMAIS confirmé  → lien d'INVITATION (type=invite) — l'invité n'a
 *    encore ni mot de passe ni session (cas des associés qui n'ont jamais reçu
 *    leur lien).
 *  • compte DÉJÀ confirmé    → lien de RÉINITIALISATION (type=recovery) — permet
 *    de redéfinir le mot de passe / réaccéder sans recréer le compte.
 *
 * Les deux retombent sur /auth/confirm puis la page « Nom affiché » (mot de passe).
 * L'envoi passe par Resend (charte LMS Drive), jamais par le SMTP Supabase.
 */
export async function POST(req: Request) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "L'envoi d'email n'est pas configuré (clé API manquante). Contactez l'administrateur." },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles').select('role, full_name, is_admin').eq('id', user.id).single()

  // Autorisé : gérant, associé, ou super-utilisateur (admin).
  const allowed = caller?.role === 'gerant' || caller?.role === 'associe' || caller?.is_admin
  if (!allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Membre non précisé' }, { status: 400 })

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('profiles').select('id, full_name, role').eq('id', userId).single()
  if (!target) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })

  // Email réel + statut de confirmation lus côté auth (source de vérité).
  const { data: authData, error: authErr } = await admin.auth.admin.getUserById(userId)
  if (authErr || !authData?.user?.email) {
    return NextResponse.json({ error: "Compte d'authentification introuvable" }, { status: 404 })
  }
  const email = authData.user.email
  const confirmed = !!authData.user.email_confirmed_at
  const type: 'recovery' | 'invite' = confirmed ? 'recovery' : 'invite'

  // Pour une invitation, on (re)pose les métadonnées (nom + rôle) que la page
  // de bienvenue lit pour préremplir. Inutile en recovery (compte déjà établi).
  // generateLink attend une union discriminée sur `type` → on branche.
  const { data: linkData, error: linkErr } = type === 'invite'
    ? await admin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { data: { full_name: target.full_name, role: target.role } },
      })
    : await admin.auth.admin.generateLink({ type: 'recovery', email })
  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: linkErr?.message ?? 'Génération du lien impossible' }, { status: 400 })
  }

  const confirmLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm` +
    `?token_hash=${linkData.properties.hashed_token}&type=${type}`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const tpl = inviteEmail({
    inviterName: caller?.full_name || 'Votre gérant',
    inviteeName: target.full_name,
    roleLabel: ROLE_LABELS[target.role] ?? target.role,
    actionLink: confirmLink,
  })

  const { error: sendError } = await resend.emails.send({
    from: RESEND_FROM,
    to: resendTo(email, 'team'), // membre → envoi RÉEL au vrai destinataire
    subject: tpl.subject,
    html: tpl.html,
  })

  await logEmail({
    type: 'autre',
    recipient: email,
    subject: tpl.subject,
    status: sendError ? 'echec' : 'envoye',
    error: sendError?.message,
    referenceType: 'invitation',
    referenceId: userId,
    sentBy: user.id,
  })

  if (sendError) {
    return NextResponse.json(
      { error: `L'email n'a pas pu être envoyé : ${sendError.message}` },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, email, alreadyConfirmed: confirmed })
}
