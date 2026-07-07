import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export function isManagerRole(role: string | null | undefined): boolean {
  return role === 'gerant' || role === 'associe'
}

/**
 * Garde pour server actions : renvoie un objet d'erreur si l'utilisateur n'est
 * pas gérant/associé, sinon null. Les server actions restent appelables
 * directement (hors UI), donc ce contrôle est indispensable en plus du garde
 * de page.
 */
export async function assertManager(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ error: string } | null> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (!isManagerRole(profile?.role)) return { error: 'Action réservée au gérant/associé' }
  return null
}

/**
 * Garde pour pages/layouts serveur : redirige vers l'accueil si l'utilisateur
 * n'est pas gérant/associé. Placé dans un layout, il couvre tout le sous-arbre
 * de routes (y compris les sous-pages), pas seulement la page racine.
 */
export async function requireManagerPage(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isManagerRole(profile?.role)) redirect('/')
}
