import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { roleLabel } from '@/lib/roles'
import { sendSavTelegram } from '@/lib/sav/telegram'

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024 // 10 Mo (par photo)
const MAX_SCREENSHOTS = 10 // limite album Telegram

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'non authentifié' }, { status: 401 })

  const form = await req.formData()
  const description = (form.get('description') as string | null)?.trim()
  if (!description) {
    return NextResponse.json({ error: 'description requise' }, { status: 400 })
  }

  const moduleName = (form.get('module') as string | null)?.trim() || null
  const section = (form.get('section') as string | null)?.trim() || null
  const pagePath = (form.get('page_path') as string | null)?.trim() || null
  const userAgent = (form.get('user_agent') as string | null)?.trim() || null
  // Plusieurs captures possibles : toutes envoyées sous la même clé `screenshot`.
  const screenshots = (form.getAll('screenshot') as unknown[])
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_SCREENSHOTS)

  const admin = createAdminClient()

  // Profil de l'auteur (nom + rôle) pour l'affichage.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, is_admin')
    .eq('id', user.id)
    .single()
  const reporterName = profile?.full_name ?? user.email ?? null
  // Un compte admin (concepteur) est fonctionnellement gérant mais doit être
  // désigné « Admin » dans le SAV, jamais « Gérant » (demande Jepht 24/07).
  const reporterRole = profile?.is_admin
    ? 'Admin'
    : profile?.role ? roleLabel(profile.role) : null

  // Captures (optionnelles). Elles ne sont PAS stockées dans Supabase : elles sont
  // uniquement transmises à Telegram (visualisables là-bas). On garde juste un
  // marqueur en base pour indiquer qu'au moins une capture accompagne le ticket.
  const photos: { bytes: ArrayBuffer; filename: string; contentType: string }[] = []
  for (const [i, shot] of screenshots.entries()) {
    if (shot.size > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ error: 'capture trop volumineuse (max 10 Mo)' }, { status: 400 })
    }
    const ext = (shot.name.split('.').pop() || 'jpg').toLowerCase()
    photos.push({
      bytes: await shot.arrayBuffer(),
      contentType: shot.type || 'image/jpeg',
      filename: shot.name || `capture-${i + 1}.${ext}`,
    })
  }
  const screenshotPath: string | null = photos.length > 0 ? 'telegram' : null

  // Enregistrement du ticket.
  const { error: insErr } = await admin.from('sav_tickets').insert({
    reporter_id: user.id,
    reporter_name: reporterName,
    reporter_role: reporterRole,
    module: moduleName,
    section,
    page_path: pagePath,
    description,
    screenshot_url: screenshotPath,
    user_agent: userAgent,
    status: 'nouveau',
  })
  if (insErr) {
    console.error('[SAV] insert ticket échec:', insErr.message)
    return NextResponse.json({ error: 'enregistrement impossible' }, { status: 500 })
  }

  // Notification Telegram envoyée APRÈS la réponse HTTP (after) : le client reçoit
  // ok immédiatement (bouton libéré) pendant que l'upload de la capture vers
  // Telegram se poursuit en arrière-plan, sans figer l'interface.
  const notif = { module: moduleName, section, pagePath, reporterName, reporterRole, description }
  after(async () => {
    await sendSavTelegram(notif, photos)
  })

  return NextResponse.json({ ok: true })
}
