import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DocumentsClient from './DocumentsClient'

export default async function DocumentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role ?? 'employe'

  const [{ data: documents }, { data: vehicles }, { data: clients }, { data: partners }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, category, subcategory, name, file_url, file_type, file_size, entity_id, entity_type, is_auto_generated, expiry_date, created_at, tags')
      .order('created_at', { ascending: false }),
    supabase
      .from('vehicles')
      .select('id, plate, brand, model')
      .eq('is_active', true)
      .order('brand'),
    supabase
      .from('clients')
      .select('id, first_name, last_name')
      .order('last_name'),
    supabase
      .from('partner_agencies')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <DocumentsClient
      documents={documents ?? []}
      vehicles={vehicles ?? []}
      clients={clients ?? []}
      partners={partners ?? []}
      userRole={userRole}
    />
  )
}
