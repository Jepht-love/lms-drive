import { createClient } from '@/lib/supabase/server'
import BottomNav from '@/components/layout/BottomNav'
import PageHeader from '@/components/layout/PageHeader'
import ClientRedirect from '@/components/layout/ClientRedirect'
import PageTransition from '@/components/layout/PageTransition'
import ContentWrapper from '@/app/(dashboard)/ContentWrapper'
import AlertCountProvider from '@/components/layout/AlertCountProvider'
import { ToastProvider } from '@/components/Toast'
import { SavProvider } from '@/lib/sav/context'
import SavButton from '@/components/sav/SavButton'

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

  // Le compteur d'alertes est chargé côté client (AlertCountProvider) pour ne pas
  // bloquer le premier affichage sur ~10 requêtes Supabase à chaque démarrage.
  return (
    <ToastProvider>
      <AlertCountProvider>
        <SavProvider>
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
            <PageHeader />
            <main style={{ overflowY: 'auto', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch', minHeight: 0 } as React.CSSProperties}>
              <PageTransition>
                <ContentWrapper>{children}</ContentWrapper>
              </PageTransition>
            </main>
            <BottomNav allowedTabs={allowedTabs} />
          </div>
          <SavButton />
        </SavProvider>
      </AlertCountProvider>
    </ToastProvider>
  )
}
