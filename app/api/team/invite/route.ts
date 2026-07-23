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

export async function POST(req: Request) {
  if (!process.env.RESEND_API_KEY) {
    // Sans clé d'envoi, l'invité ne recevrait jamais son lien : on refuse
    // avant de créer quoi que ce soit plutôt que de laisser un compte orphelin.
    return NextResponse.json(
      { error: "L'envoi d'email n'est pas configuré (clé API manquante). Contactez l'administrateur." },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: caller } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()

  if (caller?.role !== 'gerant' && caller?.role !== 'associe') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { email, full_name, role, phone, color, hire_date, allowed_tabs, allowed_doc_categories, can_view_fleet } = await req.json()

  if (!email || !full_name || !role) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  // Permissions : seulement pour un membre restreint (employé/prestataire) ;
  // gérants/associés = accès complet.
  const restricted = role === 'employe' || role === 'prestataire'
  const allowedTabs    = restricted && Array.isArray(allowed_tabs) ? allowed_tabs : null
  const allowedDocCats = restricted && Array.isArray(allowed_doc_categories) ? allowed_doc_categories : null
  const canViewFleet   = restricted ? can_view_fleet !== false : true

  const admin = createAdminClient()

  // Crée le compte et génère le lien d'invitation SANS l'email Supabase par
  // défaut (SMTP limité, template générique en anglais) : c'est Resend qui
  // envoie, avec notre modèle à la charte LMS Drive.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name, role } },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Upsert : crée ou met à jour le profil (le trigger peut avoir déjà créé une ligne)
  await admin.from('profiles').upsert({
    id: data.user.id,
    full_name,
    role,
    phone: phone || null,
    color: color || '#6366f1',
    hire_date: hire_date || null,
  }, { onConflict: 'id' })

  // Permissions par onglet — best-effort : tolère l'absence de la colonne tant que
  // la migration 017 n'est pas exécutée (n'empêche pas la création du membre).
  try {
    await admin.from('profiles').update({ allowed_tabs: allowedTabs }).eq('id', data.user.id)
  } catch { /* colonne allowed_tabs absente — ignoré */ }

  // Permissions fines (catégories documents + bloc flotte) — best-effort (migration 020).
  try {
    await admin.from('profiles')
      .update({ allowed_doc_categories: allowedDocCats, can_view_fleet: canViewFleet })
      .eq('id', data.user.id)
  } catch { /* colonnes absentes — ignoré */ }

  // Envoi de l'invitation via Resend. Le lien pointe directement sur notre
  // route /auth/confirm avec le token haché : vérification côté serveur
  // (verifyOtp) → session posée en cookies, sans passer par la redirection
  // Supabase qui renvoie les jetons en fragment d'URL (#…), invisibles du serveur.
  const confirmLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm` +
    `?token_hash=${data.properties.hashed_token}&type=invite`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const tpl = inviteEmail({
    inviterName: caller.full_name || 'Votre gérant',
    inviteeName: full_name,
    roleLabel: ROLE_LABELS[role] ?? role,
    actionLink: confirmLink,
  })

  const { error: sendError } = await resend.emails.send({
    from: RESEND_FROM,
    to: resendTo(email),
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
    referenceId: data.user.id,
    sentBy: user.id,
  })

  if (sendError) {
    // Le compte et le profil existent : on le dit clairement pour que le gérant
    // sache qu'il peut renvoyer l'invitation plutôt que recréer le membre.
    return NextResponse.json(
      { error: `Le membre a été créé mais l'email n'a pas pu être envoyé : ${sendError.message}` },
      { status: 502 }
    )
  }

  return NextResponse.json({ success: true, userId: data.user.id })
}
