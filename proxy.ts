import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { APP_TABS } from '@/lib/navigation/tabs'

/** Onglet-module correspondant au chemin (dashboard uniquement sur '/' exact). */
function matchTab(pathname: string) {
  for (const t of APP_TABS) {
    if (t.href === '/') {
      if (pathname === '/') return t
      continue
    }
    if (pathname === t.href || pathname.startsWith(t.href + '/')) return t
  }
  return null
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() tente de rafraîchir le jeton si expiré. Si le refresh token a déjà
  // été consommé (requêtes concurrentes, onglet laissé ouvert), Supabase lève une
  // AuthApiError « Invalid Refresh Token: Already Used ». On la capture et on
  // traite la session comme expirée (→ redirection /login) au lieu de faire
  // planter la requête et polluer les logs.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  const { pathname } = request.nextUrl

  // /auth/* : routes des liens email (confirmation d'invitation, bienvenue…) —
  // accessibles sans session, c'est justement là que la session se crée.
  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/auth/')) {
    // Routes API : renvoyer un 401 JSON plutôt qu'une redirection HTML vers /login.
    // Sinon un fetch() côté client (ex : recherche typeahead /api/search) reçoit la
    // page de login en HTML, res.json() échoue silencieusement, et le menu de
    // suggestions ne s'ouvre jamais — d'où « la recherche ne marche que sur Entrée ».
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    // Let the exact root through — the layout handles the client-side redirect.
    // This allows the preview tool's health check to see 200.
    if (pathname === '/') return supabaseResponse
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Permissions par onglet : un membre restreint (employé/prestataire) ne peut pas
  // accéder en direct à une section non cochée. FAIL-OPEN : la requête profil n'est
  // faite que si le chemin correspond à un onglet-module, et toute erreur (ou colonne
  // allowed_tabs absente avant migration 017) laisse passer.
  if (user) {
    const tab = matchTab(pathname)
    if (tab) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role, allowed_tabs')
          .eq('id', user.id)
          .maybeSingle()
        const role = (prof as { role?: string } | null)?.role
        const allowed = (prof as { allowed_tabs?: string[] | null } | null)?.allowed_tabs
        const restricted = role === 'employe' || role === 'prestataire'
        if (restricted && Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(tab.key)) {
          return NextResponse.redirect(new URL('/menu', request.url))
        }
      } catch { /* fail-open : accès autorisé en cas d'erreur */ }
    }
  }

  return supabaseResponse
}

// `simulateur.html` et `simulateur.js` sont laissés passer sans session : c'est
// l'outil de test de Jeff, qui ouvre l'application dans un cadre de la taille
// d'un téléphone. Sans cette exception, l'adresse partait sur /login, la
// connexion ramenait à l'accueil, et l'outil ne s'ouvrait jamais (constaté le
// 30/07/2026 sur son navigateur de test). Rien n'est exposé pour autant :
// l'application affichée DANS le cadre reste protégée, et ces deux fichiers ne
// sont pas suivis par git — ils ne partent donc sur aucun déploiement client.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sw.js|offline|apple-touch-icon.png|simulateur\\.html|simulateur\\.js|api/health|api/notifications|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
