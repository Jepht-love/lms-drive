import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Atterrissage des liens email d'authentification (invitation, récupération…).
 * Vérifie le token haché côté serveur : la session est posée en cookies par
 * le client SSR, puis l'utilisateur est redirigé selon le type de lien.
 *
 * Lien attendu : /auth/confirm?token_hash=<hash>&type=invite
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (!error) {
      // Invité : pas encore de mot de passe → page de bienvenue pour le créer.
      // Autres types (recovery…) : directement dans l'app.
      const dest = type === 'invite' ? '/auth/bienvenue' : '/'
      return NextResponse.redirect(new URL(dest, origin))
    }
  }

  // Token absent, invalide ou expiré (24 h) : retour au login avec un message
  // clair ; le gérant peut renvoyer une invitation depuis /equipe.
  return NextResponse.redirect(new URL('/login?error=lien_invalide', origin))
}
