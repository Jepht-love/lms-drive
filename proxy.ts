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

  if (!user && !pathname.startsWith('/login')) {
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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health|api/notifications|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
