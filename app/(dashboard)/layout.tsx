import { createClient } from '@/lib/supabase/server'
import { fetchAllAlerts } from '@/lib/utils/alerts'
import BottomNav from '@/components/layout/BottomNav'
import PageHeader from '@/components/layout/PageHeader'
import ClientRedirect from '@/components/layout/ClientRedirect'
import PageTransition from '@/components/layout/PageTransition'
import { ToastProvider } from '@/components/Toast'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <ClientRedirect to="/login" />

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return <ClientRedirect to="/login" />

  // Permissions par onglet — requête séparée tolérante à l'absence de la colonne.
  // Appliquée seulement aux membres restreints (les managers voient tout).
  const restricted = profile.role === 'employe' || profile.role === 'prestataire'
  let allowedTabs: string[] | null = null
  if (restricted) {
    const { data: perm } = await supabase
      .from('profiles')
      .select('allowed_tabs')
      .eq('id', user.id)
      .maybeSingle()
    allowedTabs = (perm as { allowed_tabs?: string[] | null } | null)?.allowed_tabs ?? null
  }

  const alerts     = await fetchAllAlerts(supabase)
  const alertCount = alerts.length

  return (
    <ToastProvider>
      <div
        className="bg-[#F2F2F7]"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          overflow: 'hidden',
        }}
      >
        <PageHeader alertCount={alertCount} />
        <main style={{
          overflowY: 'auto',
          overscrollBehavior: 'none',
          WebkitOverflowScrolling: 'touch',
          minHeight: 0,
        } as React.CSSProperties}>
          <PageTransition>
            <div className="px-4 py-5 pb-6">
              {children}
            </div>
          </PageTransition>
        </main>
        <BottomNav alertCount={alertCount} allowedTabs={allowedTabs} />
      </div>
    </ToastProvider>
  )
}
