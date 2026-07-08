'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { broadcastPushToManagers } from '@/lib/push/broadcastPush'

// Libellés lisibles des statuts (repris dans la notif push).
const TASK_STATUS_LABELS: Record<string, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
  reporte: 'Reporté',
  annule: 'Annulé',
}

// Change le statut d'une tâche (+ completed_at si terminée) et prévient les
// managers par push, en précisant le nouveau statut dans le message.
export async function updateTaskStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autorisé' }

  const { data: task, error } = await supabase
    .from('tasks')
    .update({
      status,
      completed_at: status === 'termine' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('title')
    .single()

  if (error) return { error: error.message }

  const label = TASK_STATUS_LABELS[status] ?? status
  await broadcastPushToManagers({
    title: `Tâche · ${label}`,
    body: `${task?.title ?? 'Tâche'} — statut : ${label}`,
    url: '/calendar/tasks',
  })

  revalidatePath('/calendar/tasks')
  return { success: true }
}
