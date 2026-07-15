import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { roleLabel } from '@/lib/roles'
import { sendSavTelegram } from '@/lib/sav/telegram'

const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024 // 10 Mo

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
  const screenshot = form.get('screenshot') as File | null

  const admin = createAdminClient()

  // Profil de l'auteur (nom + rôle) pour l'affichage.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()
  const reporterName = profile?.full_name ?? user.email ?? null
  const reporterRole = profile?.role ? roleLabel(profile.role) : null

  // Upload de la capture (optionnelle) dans le bucket privé.
  let screenshotPath: string | null = null
  let photoBytes: ArrayBuffer | null = null
  let photoType = 'image/jpeg'
  let photoName = 'capture.jpg'
  if (screenshot && screenshot.size > 0) {
    if (screenshot.size > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json({ error: 'capture trop volumineuse (max 10 Mo)' }, { status: 400 })
    }
    // La capture n'est PAS stockée dans Supabase : elle est uniquement transmise
    // à Telegram (visualisable là-bas). On garde juste un marqueur en base pour
    // indiquer qu'une capture accompagne le ticket.
    const ext = (screenshot.name.split('.').pop() || 'jpg').toLowerCase()
    photoBytes = await screenshot.arrayBuffer()
    photoType = screenshot.type || 'image/jpeg'
    photoName = screenshot.name || `capture.${ext}`
    screenshotPath = 'telegram'
  }

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
  const photo = photoBytes ? { bytes: photoBytes, filename: photoName, contentType: photoType } : null
  after(async () => {
    await sendSavTelegram(notif, photo)
  })

  return NextResponse.json({ ok: true })
}
