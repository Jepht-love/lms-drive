import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BienvenueForm from './BienvenueForm'

/**
 * Dernière marche du parcours d'invitation : l'invité arrive ici avec une
 * session déjà ouverte (posée par /auth/confirm) et choisit son mot de passe.
 * Le prénom est résolu côté serveur (metadata auth, sinon profil) pour être
 * affiché dès le premier rendu — pas de « Bienvenue » anonyme le temps du
 * chargement navigateur.
 */
export default async function BienvenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=lien_invalide')

  let fullName = (user.user_metadata?.full_name as string | undefined) ?? null
  if (!fullName) {
    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()
    fullName = profile?.full_name ?? null
  }

  return <BienvenueForm prenom={fullName?.split(' ')[0] ?? null} />
}
