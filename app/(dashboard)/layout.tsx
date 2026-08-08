import { createClient } from '@/lib/supabase/server'
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

  // Compte authentifié SANS profil : ne pas renvoyer vers /login (le proxy
  // renverrait aussitôt vers / puisqu'une session existe → boucle infinie
  // « Chargement… »). On l'envoie finaliser son espace, qui (re)crée le profil.
  if (!profile) return <ClientRedirect to="/auth/bienvenue" />

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
              // Deux rangées depuis le 08/08/2026 : bandeau puis contenu. La barre
              // d'onglets du bas (3e rangée « auto ») a été retirée, la navigation
              // passe par le hamburger du bandeau.
              gridTemplateRows: 'auto 1fr',
              overflow: 'hidden',
            }}
          >
            <PageHeader allowedTabs={allowedTabs} />
            <main style={{ overflowY: 'auto', overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch', minHeight: 0 } as React.CSSProperties}>
              <PageTransition>
                <ContentWrapper>{children}</ContentWrapper>
              </PageTransition>
            </main>
          </div>
          <SavButton />
        </SavProvider>
      </AlertCountProvider>
    </ToastProvider>
  )
}
