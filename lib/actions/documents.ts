'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DocumentCategory } from '@/lib/documents/categories'
import { DOCUMENT_SUBCATEGORIES } from '@/lib/documents/categories'
import {
  PENDING_SUBCATEGORY,
  PENDING_TAG,
  buildTriageDocName,
  getTriageFamily,
} from '@/lib/documents/triage'
import { RESEND_FROM, resendTo } from '@/lib/email/config'
import { dateAgence } from '@/lib/format/heureAgence'

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

  const { error } = await supabase.from('documents').insert({
    category,
    subcategory,
    name,
    file_url: fileName,
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
 * Import en masse de documents pour un client (ex. lot de pièces reçu par le
 * gérant sur Telegram, téléchargé puis déposé d'un coup sur la fiche client).
 * Les fichiers sont déjà téléversés côté navigateur dans le bucket `documents`
 * (contourne la limite de payload Vercel — même pattern que les pièces client) ;
 * ici on ne fait qu'insérer les métadonnées, une ligne `documents` par fichier.
 */
export async function bulkCreateClientDocuments(
  clientId: string,
  docs: { name: string; subcategory: string; file_url: string; file_type?: string | null; file_size?: number | null; side?: string | null }[],
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')
  if (!clientId) return { error: 'Client requis' }

  // Sous-catégories client valides (repli sur « autres » si l'UI envoie autre chose).
  const allowed = new Set(DOCUMENT_SUBCATEGORIES.client.map(s => s.id))

  const rows = (docs ?? [])
    .filter(d => d?.file_url && d?.name)
    .map(d => ({
      category: 'client' as const,
      subcategory: allowed.has(d.subcategory) ? d.subcategory : 'autres',
      name: d.name.trim().slice(0, 200),
      file_url: d.file_url,
      file_type: d.file_type || null,
      file_size: typeof d.file_size === 'number' ? d.file_size : null,
      // Face de la pièce (recto/verso) stockée en tag — évite d'infler l'enum des
      // sous-catégories. Ignorée si la valeur n'est pas recto/verso.
      tags: d.side === 'recto' || d.side === 'verso' ? [d.side] : null,
      entity_id: clientId,
      entity_type: 'client' as const,
      is_auto_generated: false,
      created_by: user.id,
    }))

  if (rows.length === 0) return { error: 'Aucun document valide à importer' }

  const { error } = await supabase.from('documents').insert(rows)
  if (error) throw new Error(`Import échoué : ${error.message}`)

  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/documents')
  return { success: true, count: rows.length }
}

/**
 * Dépose un lot de pièces « à trier » dans la pile d'une famille (client,
 * véhicule, société, partenaire) : lignes `documents` marquées du tag `a-trier`,
 * donc invisibles dans la bibliothèque tant qu'elles n'ont pas reçu leur type et
 * leur cible. Les fichiers sont déjà téléversés côté navigateur dans le bucket
 * `documents` (contourne la limite de payload Vercel). Persister dès le dépôt
 * permet de reprendre le tri plus tard sans re-téléverser.
 * Étendu aux quatre familles le 29/07/2026 ; c'était réservé aux clients avant.
 */
export async function stageTriageDocuments(
  family: string,
  docs: { name: string; file_url: string; file_type?: string | null; file_size?: number | null }[],
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const fam = getTriageFamily(family)
  if (!fam) return { error: 'Famille de documents inconnue' }

  const rows = (docs ?? [])
    .filter(d => d?.file_url && d?.name)
    .map(d => ({
      category: fam.id,
      subcategory: PENDING_SUBCATEGORY,
      name: d.name.trim().slice(0, 200),
      file_url: d.file_url,
      file_type: d.file_type || null,
      file_size: typeof d.file_size === 'number' ? d.file_size : null,
      tags: [PENDING_TAG],
      entity_id: null,
      entity_type: fam.entityType,
      is_auto_generated: false,
      created_by: user.id,
    }))

  if (rows.length === 0) return { error: 'Aucun document valide à importer' }

  const { error } = await supabase.from('documents').insert(rows)
  if (error) throw new Error(`Import échoué : ${error.message}`)

  revalidatePath('/documents')
  revalidatePath('/documents/import')
  return { success: true, count: rows.length }
}

/**
 * Classe un lot de pièces « à trier » : même type, même cible, même date
 * d'expiration pour toutes celles qui sont cochées. C'est le geste central du
 * tri (on coche le recto, le verso et le justificatif d'un même client, on
 * rattache d'un coup). La pièce prend son nom canonique (« Carte grise
 * AB-123-CD ») et perd son tag `a-trier`, donc elle entre dans la bibliothèque
 * et apparaît aussitôt sur la fiche de la cible.
 *
 * `targetId` est obligatoire sauf pour la famille société, qui ne se rattache à
 * rien. Le garde-fou `.is('entity_id', null)` empêche de détacher par erreur un
 * document déjà classé sur une autre fiche.
 */
export async function assignTriageDocuments(
  documentIds: string[],
  opts: { family: string; targetId?: string | null; subcategory: string; expiryDate?: string | null },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const fam = getTriageFamily(opts.family)
  if (!fam) return { error: 'Famille de documents inconnue' }

  const ids = (documentIds ?? []).filter(Boolean)
  if (ids.length === 0) return { error: 'Aucune pièce sélectionnée' }

  const allowed = new Set((DOCUMENT_SUBCATEGORIES[fam.id] ?? []).map(s => s.id))
  if (!allowed.has(opts.subcategory)) return { error: 'Type de document invalide' }

  const targetId = opts.targetId || null
  if (fam.entityType && !targetId) return { error: `Choisissez un ${fam.targetLabel}` }

  // Libellé de la cible → nom automatique de la pièce.
  let targetLabel: string | null = null
  if (targetId) {
    if (fam.id === 'client') {
      const { data } = await supabase.from('clients').select('first_name, last_name').eq('id', targetId).single()
      targetLabel = data ? `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() : null
    } else if (fam.id === 'vehicule') {
      const { data } = await supabase.from('vehicles').select('plate').eq('id', targetId).single()
      targetLabel = data?.plate ?? null
    } else {
      const { data } = await supabase.from('partner_agencies').select('name').eq('id', targetId).single()
      targetLabel = data?.name ?? null
    }
    if (!targetLabel) return { error: `Ce ${fam.targetLabel} est introuvable` }
  }

  const { error } = await supabase
    .from('documents')
    .update({
      entity_id: targetId,
      entity_type: fam.entityType,
      category: fam.id,
      subcategory: opts.subcategory,
      expiry_date: opts.expiryDate || null,
      name: buildTriageDocName(fam.id, opts.subcategory, targetLabel),
      tags: null,
    })
    .in('id', ids)
    .is('entity_id', null)
  if (error) throw new Error(`Classement échoué : ${error.message}`)

  revalidatePath('/documents')
  revalidatePath('/documents/import')
  if (targetId && fam.id === 'client')   revalidatePath(`/clients/${targetId}`)
  if (targetId && fam.id === 'vehicule') revalidatePath(`/vehicles/${targetId}`)
  if (targetId && fam.id === 'partenaire') revalidatePath('/partnerships')
  return { success: true, count: ids.length }
}

/**
 * Déplace des pièces mal déposées d'une pile vers une autre (ex. une carte grise
 * tombée dans la pile Client). Rien n'est re-téléversé : seuls la famille et le
 * type de rattachement changent, le fichier reste où il est dans le bucket.
 */
export async function moveTriageDocuments(documentIds: string[], family: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const fam = getTriageFamily(family)
  if (!fam) return { error: 'Famille de documents inconnue' }

  const ids = (documentIds ?? []).filter(Boolean)
  if (ids.length === 0) return { error: 'Aucune pièce sélectionnée' }

  const { error } = await supabase
    .from('documents')
    .update({
      category: fam.id,
      entity_type: fam.entityType,
      subcategory: PENDING_SUBCATEGORY,
      tags: [PENDING_TAG],
    })
    .in('id', ids)
    .is('entity_id', null)
  if (error) throw new Error(`Déplacement échoué : ${error.message}`)

  revalidatePath('/documents/import')
  revalidatePath('/documents')
  return { success: true, count: ids.length }
}

/**
 * Supprime un document client depuis la fiche client (Système A). Retire le
 * fichier du bucket `documents` puis la ligne, et rafraîchit la fiche.
 * Distinct de `deleteDocument` (qui ne revalide que /documents).
 */
export async function deleteClientDocument(documentId: string, clientId?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_url')
    .eq('id', documentId)
    .single()
  if (!doc) return { error: 'Document introuvable' }

  const storagePath = doc.file_url.startsWith('http')
    ? (new URL(doc.file_url).pathname.split('/storage/v1/object/public/documents/')[1] ?? null)
    : doc.file_url
  if (storagePath) await supabase.storage.from('documents').remove([storagePath])

  await supabase.from('documents').delete().eq('id', documentId)

  if (clientId) revalidatePath(`/clients/${clientId}`)
  revalidatePath('/documents')
  revalidatePath('/documents/import')
  return { success: true }
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

  const { error: insertErr } = await supabase.from('documents').insert({
    category:     old.category,
    subcategory:  old.subcategory,
    name:         old.name,
    file_url:     fileName,
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
  // Les documents auto-générés (contrats, factures) sont désormais supprimables :
  // ils sont régénérables depuis la réservation, et le gérant doit pouvoir retirer
  // les doublons (ex. contrat listé deux fois). La confirmation UI protège du geste
  // accidentel.

  // Accepte l'ancien format URL public et le nouveau format chemin brut
  let storagePath: string | null = null
  if (doc.file_url.startsWith('http')) {
    const urlPath = new URL(doc.file_url).pathname
    storagePath = urlPath.split('/storage/v1/object/public/documents/')[1] ?? null
  } else {
    storagePath = doc.file_url
  }
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

  // Génère une URL signée temporaire (24h) — le bucket peut être privé
  let downloadUrl = doc.file_url as string
  const rawPath = downloadUrl.startsWith('http')
    ? (new URL(downloadUrl).pathname.split('/storage/v1/object/public/documents/')[1] ?? null)
    : downloadUrl
  if (rawPath) {
    const { data: signed } = await supabase.storage.from('documents').createSignedUrl(rawPath, 86400)
    if (signed?.signedUrl) downloadUrl = signed.signedUrl
  }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: RESEND_FROM,
    to: resendTo(recipientEmail),
    subject: `Document LMS Agency — ${doc.name}`,
    html: `
      <p>Bonjour,</p>
      ${message ? `<p>${message}</p>` : ''}
      <p>Vous trouverez ci-dessous le lien vers le document <strong>${doc.name}</strong> (valable 24h) :</p>
      <p><a href="${downloadUrl}">Télécharger le document</a></p>
      <p>Cordialement,<br>LMS Agency</p>
    `,
  })
}

/**
 * Appelé automatiquement après génération d'un PDF de contrat.
 * NB : plus aucun appelant aujourd'hui — l'archivage se fait en ligne dans
 * `app/api/contracts/generate-pdf/route.ts`. Conservé au cas où, mais gardé
 * derrière un contrôle d'authentification : une action serveur exportée est
 * appelable directement, y compris sans session.
 */
export async function archiveContractDocument(opts: {
  contractNumber: string
  reservationId: string
  clientId: string
  clientName: string
  fileUrl: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

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

/**
 * Appelé après création d'une infraction avec document.
 * NB : plus aucun appelant aujourd'hui (voir `lib/actions/incidents.ts`, qui
 * insère directement). Même garde d'authentification que ci-dessus.
 */
export async function archiveInfractionDocument(opts: {
  vehicleId: string
  vehiclePlate: string
  infractionDate: string
  documentUrl: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  await supabase.from('documents').insert({
    category: 'vehicule',
    subcategory: 'autres',
    name: `Infraction ${dateAgence(opts.infractionDate)} — ${opts.vehiclePlate}`,
    file_url: opts.documentUrl,
    entity_id: opts.vehicleId,
    entity_type: 'vehicle',
    is_auto_generated: false,
  })
}
