import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ImportTriageClient, { type StagedDoc, type ClientLite } from './ImportTriageClient'

export default async function DocumentsImportPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()
  const isManager = profile?.role === 'gerant' || profile?.role === 'associe' || !!profile?.is_admin
  if (!isManager) redirect('/documents')

  // Pièces « à trier » : importées en masse, pas encore rattachées à un client.
  const { data: docRows } = await supabase
    .from('documents')
    .select('id, name, file_url, file_type, created_at')
    .eq('category', 'client')
    .eq('entity_type', 'client')
    .is('entity_id', null)
    .eq('is_auto_generated', false)
    .order('created_at', { ascending: true })

  // URLs signées (miniatures) — chemins bruts stockés dans le bucket `documents`.
  const paths = (docRows ?? [])
    .map(d => (d.file_url?.startsWith('http')
      ? (d.file_url.split('/storage/v1/object/public/documents/')[1] ?? null)
      : d.file_url))
    .filter((p): p is string => !!p)

  const signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('documents').createSignedUrls(paths, 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl)
  }

  const staged: StagedDoc[] = (docRows ?? []).map(d => {
    const raw = d.file_url?.startsWith('http')
      ? (d.file_url.split('/storage/v1/object/public/documents/')[1] ?? '')
      : (d.file_url ?? '')
    return {
      id: d.id,
      name: d.name,
      url: signedByPath.get(raw) ?? null,
      fileType: d.file_type ?? null,
    }
  })

  const { data: clientRows } = await supabase
    .from('clients')
    .select('id, first_name, last_name, phone')
    .order('last_name')

  const clients: ClientLite[] = (clientRows ?? []).map(c => ({
    id: c.id,
    name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Client',
    phone: c.phone ?? null,
  }))

  return <ImportTriageClient staged={staged} clients={clients} />
}
