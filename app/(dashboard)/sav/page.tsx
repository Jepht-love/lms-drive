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

  // URLs signées pour les captures (bucket privé), valides 1 h.
  const withUrls = await Promise.all(
    tickets.map(async (t) => {
      let signedUrl: string | null = null
      if (t.screenshot_url) {
        const { data } = await admin.storage
          .from('sav-screenshots')
          .createSignedUrl(t.screenshot_url, 3600)
        signedUrl = data?.signedUrl ?? null
      }
      return { ...t, signedUrl }
    }),
  )

  return <SavList tickets={withUrls} />
}
