'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: 'Email ou mot de passe incorrect' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Finalise l'onboarding d'un membre invité : enregistre le **nom visible**
 * choisi et GARANTIT l'existence de son profil.
 *
 * Le layout du dashboard renvoie vers /login (puis boucle avec le proxy →
 * « Chargement… » infini) lorsqu'un compte authentifié n'a pas de ligne
 * `profiles`. Cela arrivait aux comptes créés avant l'upsert du profil (ou si
 * un trigger a manqué). On répare ici, côté serveur (service role), au moment
 * où le membre définit son mot de passe.
 *
 * Sécurité : si le profil existe déjà, on ne touche QU'AU nom (jamais au rôle,
 * pour empêcher toute escalade via user_metadata). On ne crée un profil depuis
 * les metadata que lorsqu'il est réellement absent — cas d'un premier accès.
 */
export async function completeOnboarding(fullName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expirée. Rouvrez votre lien d’invitation.' }

  const trimmed = (fullName ?? '').trim().replace(/\s+/g, ' ')
  if (trimmed.length < 2) return { error: 'Indiquez le nom qui sera affiché dans l’application.' }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('profiles').select('id').eq('id', user.id).maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('profiles').update({ full_name: trimmed }).eq('id', user.id)
    if (error) return { error: error.message }
  } else {
    const role = (user.user_metadata?.role as string) || 'employe'
    const { error } = await admin
      .from('profiles').insert({ id: user.id, full_name: trimmed, role })
    if (error) return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data
}
