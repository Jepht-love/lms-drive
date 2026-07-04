'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DocumentCategory } from '@/lib/documents/categories'
import { RESEND_FROM, resendTo } from '@/lib/email/config'

export async function uploadDocument(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const file        = formData.get('file') as File
  const category    = formData.get('category') as DocumentCategory
  const subcategory = formData.get('subcategory') as string
  const name        = formData.get('name') as string
  const entityId    = formData.get('entityId') as string | null
  const entityType  = formData.get('entityType') as string | null
  const expiryDate  = formData.get('expiryDate') as string | null

  if (!file || !category || !subcategory || !name) throw new Error('Champs requis manquants')

  const fileExt  = file.name.split('.').pop()
  const fileName = `${category}/${subcategory}/${Date.now()}-${entityId ?? 'global'}.${fileExt}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, arrayBuffer, { contentType: file.type })

  if (uploadError) throw new Error(`Upload échoué : ${uploadError.message}`)

  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)

  const { error } = await supabase.from('documents').insert({
    category,
    subcategory,
    name,
    file_url: publicUrl,
    file_type: file.type,
    file_size: file.size,
    entity_id:   entityId   || null,
    entity_type: entityType || null,
    expiry_date: expiryDate || null,
    is_auto_generated: false,
    created_by: user.id,
  })

  if (error) throw new Error(`Enregistrement échoué : ${error.message}`)

  revalidatePath('/documents')
}

/**
 * Remplace un document par une nouvelle version : téléverse le nouveau fichier,
 * crée une ligne v(n+1) liée à l'ancienne (supersedes_id) marquée courante, et
 * archive l'ancienne (is_current=false, status='archive') sans la supprimer.
 * Nécessite la migration 050 (colonnes version / supersedes_id / is_current).
 */
export async function replaceDocument(existingId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const file       = formData.get('file') as File
  const expiryDate = formData.get('expiryDate') as string | null
  if (!file) throw new Error('Fichier requis')

  const { data: old, error: fetchErr } = await supabase
    .from('documents')
    .select('*')
    .eq('id', existingId)
    .single()
  if (fetchErr || !old) throw new Error('Document introuvable')
  if (old.is_auto_generated) throw new Error('Un document auto-généré ne peut pas être versionné')

  const fileExt  = file.name.split('.').pop()
  const fileName = `${old.category}/${old.subcategory}/${Date.now()}-${old.entity_id ?? 'global'}.${fileExt}`
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, arrayBuffer, { contentType: file.type })
  if (uploadError) throw new Error(`Upload échoué : ${uploadError.message}`)

  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(fileName)

  const { error: insertErr } = await supabase.from('documents').insert({
    category:     old.category,
    subcategory:  old.subcategory,
    name:         old.name,
    file_url:     publicUrl,
    file_type:    file.type,
    file_size:    file.size,
    entity_id:    old.entity_id,
    entity_type:  old.entity_type,
    reservation_id: old.reservation_id,
    tags:         old.tags,
    expiry_date:  expiryDate || old.expiry_date,
    is_auto_generated: false,
    created_by:   user.id,
    version:      (old.version ?? 1) + 1,
    supersedes_id: old.id,
    is_current:   true,
    status:       'valide',
  })
  if (insertErr) throw new Error(`Nouvelle version échouée : ${insertErr.message}`)

  // Ancienne version conservée mais retirée de la liste courante.
  await supabase.from('documents')
    .update({ is_current: false, status: 'archive' })
    .eq('id', old.id)

  revalidatePath('/documents')
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id, file_url, is_auto_generated')
    .eq('id', documentId)
    .single()

  if (fetchErr || !doc) throw new Error('Document introuvable')
  if (doc.is_auto_generated) throw new Error('Impossible de supprimer un document auto-généré')

  // Extraire le path storage depuis l'URL publique
  const urlPath = new URL(doc.file_url).pathname
  const storagePath = urlPath.split('/storage/v1/object/public/documents/')[1]
  if (storagePath) {
    await supabase.storage.from('documents').remove([storagePath])
  }

  await supabase.from('documents').delete().eq('id', documentId)
  revalidatePath('/documents')
}

export async function sendDocumentByEmail(
  documentId: string,
  recipientEmail: string,
  message?: string,
) {
  const supabase = await createClient()
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (error || !doc) throw new Error('Document introuvable')

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: RESEND_FROM,
    to: resendTo(recipientEmail),
    subject: `Document LMS Agency — ${doc.name}`,
    html: `
      <p>Bonjour,</p>
      ${message ? `<p>${message}</p>` : ''}
      <p>Vous trouverez ci-dessous le lien vers le document <strong>${doc.name}</strong> :</p>
      <p><a href="${doc.file_url}">Télécharger le document</a></p>
      <p>Cordialement,<br>LMS Agency</p>
    `,
  })
}

/** Appelé automatiquement après génération d'un PDF de contrat */
export async function archiveContractDocument(opts: {
  contractNumber: string
  reservationId: string
  clientId: string
  clientName: string
  fileUrl: string
}) {
  const supabase = await createClient()
  await supabase.from('documents').insert({
    category: 'client',
    subcategory: 'contrat_location',
    name: `Contrat ${opts.contractNumber} — ${opts.clientName}`,
    file_url: opts.fileUrl,
    file_type: 'application/pdf',
    entity_id: opts.clientId,
    entity_type: 'client',
    reservation_id: opts.reservationId,
    is_auto_generated: true,
  })
}

/** Appelé après création d'une infraction avec document */
export async function archiveInfractionDocument(opts: {
  vehicleId: string
  vehiclePlate: string
  infractionDate: string
  documentUrl: string
}) {
  const supabase = await createClient()
  await supabase.from('documents').insert({
    category: 'vehicule',
    subcategory: 'autres',
    name: `Infraction ${new Date(opts.infractionDate).toLocaleDateString('fr-FR')} — ${opts.vehiclePlate}`,
    file_url: opts.documentUrl,
    entity_id: opts.vehicleId,
    entity_type: 'vehicle',
    is_auto_generated: false,
  })
}
