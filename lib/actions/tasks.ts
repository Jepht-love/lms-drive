'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Change le statut d'une tâche, et rien d'autre.
 *
 * PLUS DE NOTIFICATION ICI depuis le 30/07/2026, sur décision de Jeff. Elle
 * envoyait « Tâche · Terminé — Lavage avant location — statut : Terminé »,
 * c'est-à-dire exactement ce que dit déjà « Marich Toulassi a terminé une
 * tâche » (app/api/calendar/events/[id]/status/route.ts), en moins clair : ni
 * qui, ni quelle voiture. Deux messages pour un seul événement.
 */
export async function updateTaskStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autorisé' }

  const { error } = await supabase
    .from('tasks')
    .update({
      status,
      completed_at: status === 'termine' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/calendar/tasks')
  return { success: true }
}
