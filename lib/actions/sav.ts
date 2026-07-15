'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSavAdmin, type SavStatus } from '@/lib/sav/admin'

const VALID: SavStatus[] = ['nouveau', 'en_cours', 'resolu']

export async function updateSavStatus(id: string, status: SavStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isSavAdmin(user?.email)) throw new Error('non autorisé')
  if (!VALID.includes(status)) throw new Error('statut invalide')

  const admin = createAdminClient()
  const { error } = await admin
    .from('sav_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/sav')
}
