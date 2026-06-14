import { createClient } from '@/lib/supabase/server'
import { fetchAllAlerts } from '@/lib/utils/alerts'
import BottomNav from '@/components/layout/BottomNav'
import PageHeader from '@/components/layout/PageHeader'
import ClientRedirect from '@/components/layout/ClientRedirect'
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

  const alerts     = await fetchAllAlerts()
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
          <div className="px-4 py-5 pb-6">
            {children}
          </div>
        </main>
        <BottomNav alertCount={alertCount} />
      </div>
    </ToastProvider>
  )
}
