'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCampaign(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('campaigns').insert({
    name:        (formData.get('name') as string)?.trim(),
    objective:   (formData.get('objective') as string)?.trim() || null,
    channel:     formData.get('channel') as string,
    responsible: (formData.get('responsible') as string)?.trim() || null,
    start_date:  formData.get('start_date') as string,
    end_date:    (formData.get('end_date') as string) || null,
    budget:       parseFloat(formData.get('budget') as string) || 0,
    observations: (formData.get('observations') as string)?.trim() || null,
    status:       'planifiee',
  })

  if (error) return { error: error.message }
  revalidatePath('/marketing')
  return { success: true }
}

export async function updateCampaignStatus(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('campaigns').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/marketing')
  revalidatePath(`/marketing/${id}`)
  return { success: true }
}

export async function closeCampaign(id: string, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('campaigns').update({
    status:              'terminee',
    prospects_count:     parseInt(formData.get('prospects_count') as string) || 0,
    reservations_count:  parseInt(formData.get('reservations_count') as string) || 0,
    revenue_generated:   parseFloat(formData.get('revenue_generated') as string) || 0,
    observations:        (formData.get('observations') as string)?.trim() || null,
    end_date:            (formData.get('end_date') as string) || null,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/marketing')
  revalidatePath(`/marketing/${id}`)
  return { success: true }
}
