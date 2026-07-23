import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Atterrissage des liens email/WhatsApp d'authentification (invitation,
 * récupération…). Le token est à usage unique : les robots d'aperçu
 * (WhatsApp, scanners Gmail…) font un GET sur l'URL et consommeraient le
 * lien avant le destinataire. Le GET n'est donc qu'une page interstitielle
 * avec un bouton — seul le POST (vrai clic humain) vérifie le token.
 *
 * Lien attendu : /auth/confirm?token_hash=<hash>&type=invite|recovery
 */

const SAFE = /^[A-Za-z0-9_-]+$/

function confirmPage(tokenHash: string, type: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>LMS Drive — Accéder à mon espace</title>
<style>
  body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center;
         justify-content:center; background:#0A0A0A; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; padding:24px; box-sizing:border-box; }
  img.logo { width:150px; margin-bottom:48px; }
  .card { width:100%; max-width:384px; text-align:left; }
  h1 { color:#fff; font-size:24px; font-weight:600; margin:0 0 8px; }
  p  { color:#9A9A98; font-size:14px; margin:0 0 40px; line-height:1.5; }
  button { width:100%; padding:14px; border:none; border-radius:12px; font-size:14px; font-weight:600;
           letter-spacing:.02em; cursor:pointer; color:#0A0A0A;
           background:linear-gradient(135deg,#C4A35A,#D4B870); }
  .note { color:#5A5A58; font-size:12px; margin-top:24px; }
</style>
</head>
<body>
  <img class="logo" src="/logo-white.png" alt="LMS Drive">
  <div class="card">
    <h1>Votre espace vous attend</h1>
    <p>Cliquez sur le bouton pour confirmer que c'est bien vous et accéder à LMS Drive.</p>
    <form method="POST" action="/auth/confirm">
      <input type="hidden" name="token_hash" value="${tokenHash}">
      <input type="hidden" name="type" value="${type}">
      <button type="submit">Continuer</button>
    </form>
    <p class="note">Lien personnel à usage unique, valable 24 h.</p>
  </div>
</body>
</html>`
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  // Token absent ou malformé : retour au login avec un message clair.
  if (!tokenHash || !type || !SAFE.test(tokenHash) || !SAFE.test(type)) {
    return NextResponse.redirect(new URL('/login?error=lien_invalide', origin))
  }

  // Page interstitielle — ne consomme PAS le token.
  return new NextResponse(confirmPage(tokenHash, type), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url)
  const form = await request.formData()
  const tokenHash = String(form.get('token_hash') ?? '')
  const type = String(form.get('type') ?? '') as EmailOtpType

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (!error) {
      // Invitation ou récupération : l'utilisateur doit (re)définir son mot de
      // passe → page de bienvenue. Autres types : directement dans l'app.
      const dest = type === 'invite' || type === 'recovery' ? '/auth/bienvenue' : '/'
      return NextResponse.redirect(new URL(dest, origin), 303)
    }
  }

  // Token invalide ou expiré (24 h) : retour au login avec un message clair ;
  // le gérant peut renvoyer une invitation depuis /equipe.
  return NextResponse.redirect(new URL('/login?error=lien_invalide', origin), 303)
}
