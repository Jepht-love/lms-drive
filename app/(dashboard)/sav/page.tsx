import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isSavAdmin, type SavTicket } from '@/lib/sav/admin'
import SavList from './SavList'

export const dynamic = 'force-dynamic'

export default async function SavPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // Onglet strictement réservé au super-admin.
  if (!isSavAdmin(user.email)) redirect('/')

  const admin = createAdminClient()
  const { data: rows } = await admin
    .from('sav_tickets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const tickets = (rows ?? []) as SavTicket[]

  // Les nouvelles captures ne sont plus stockées (marqueur 'telegram') : elles
  // sont visualisables sur Telegram. Pour les anciens tickets (chemin réel dans
  // le bucket), on génère encore un lien signé valide 1 h.
  const withUrls = await Promise.all(
    tickets.map(async (t) => {
      let signedUrl: string | null = null
      const onTelegram = t.screenshot_url === 'telegram'
      if (t.screenshot_url && !onTelegram) {
        const { data } = await admin.storage
          .from('sav-screenshots')
          .createSignedUrl(t.screenshot_url, 3600)
        signedUrl = data?.signedUrl ?? null
      }
      return { ...t, signedUrl, onTelegram }
    }),
  )

  return <SavList tickets={withUrls} />
}
