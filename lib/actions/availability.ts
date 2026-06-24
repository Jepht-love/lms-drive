'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Remplace l'intégralité du planning hebdomadaire de l'utilisateur en une fois
 * (7 jours au plus) — plus simple côté UI qu'un CRUD par créneau pour un
 * planning qui change rarement. Un manager peut éditer le planning d'un
 * collaborateur (targetUserId) ; un employé ne peut éditer que le sien (la
 * RLS bloquerait sinon silencieusement les lignes des autres).
 */
export async function setWeeklyAvailability(
  targetUserId: string,
  days: { day_of_week: number; start_time: string; end_time: string; is_active: boolean }[],
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const rows = days
    .filter(d => d.is_active)
    .map(d => ({
      user_id: targetUserId,
      day_of_week: d.day_of_week,
      start_time: d.start_time,
      end_time: d.end_time,
      is_active: true,
      updated_at: new Date().toISOString(),
    }))

  const inactiveDays = days.filter(d => !d.is_active).map(d => d.day_of_week)

  if (inactiveDays.length > 0) {
    await supabase.from('availability_slots').delete()
      .eq('user_id', targetUserId).in('day_of_week', inactiveDays)
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('availability_slots')
      .upsert(rows, { onConflict: 'user_id,day_of_week' })
    if (error) return { error: error.message }
  }

  revalidatePath('/calendrier/disponibilites')
  return { success: true }
}
