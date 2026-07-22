'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { recomputeVehicleStatus } from '@/lib/vehicles/vehicleStatus'
import type { ClientStatus } from '@/types/database'

async function uploadClientDoc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
  clientId: string,
  slot: string,
): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `clients/${clientId}/${slot}.${ext}`
  const { error } = await supabase.storage
    .from('client-documents')
    .upload(path, bytes, { contentType: file.type || 'image/jpeg', upsert: true })
  return error ? null : path
}

const CLIENT_PHOTO_SLOTS = ['id_doc_front', 'id_doc_back', 'license_front', 'license_back', 'proof_of_address'] as const

/**
 * Récupère les chemins Storage des pièces client à écrire dans `clients.*_path`.
 * Source principale : les champs `<slot>_path` (chaînes) que ClientForm produit
 * après un téléversement direct côté navigateur. Repli : un `File` brut encore
 * transmis est téléversé ici. Les slots absents sont omis (jamais écrasés).
 */
async function collectPhotoPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  clientId: string,
): Promise<Record<string, string>> {
  const validPaths: Record<string, string> = {}
  for (const slot of CLIENT_PHOTO_SLOTS) {
    const pathKey = `${slot}_path`
    const sentPath = formData.get(pathKey)
    if (typeof sentPath === 'string' && sentPath.trim()) {
      validPaths[pathKey] = sentPath.trim()
      continue
    }
    const file = formData.get(slot) as File | null
    if (file && file.size > 0) {
      const uploaded = await uploadClientDoc(supabase, file, clientId, slot)
      if (uploaded) validPaths[pathKey] = uploaded
    }
  }
  return validPaths
}

// Remise % (0–100). Renvoie null si champ vide/invalide → pas de mise à jour.
function parseDiscount(raw: FormDataEntryValue | null): number | null {
  const v = (raw as string)?.trim()
  if (!v) return null
  const n = parseFloat(v.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, n))
}

// Mise à jour best-effort de la remise — séparée du payload principal pour rester
// tolérante à l'absence de la colonne discount_percent avant la migration 019.
async function applyDiscount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  raw: FormDataEntryValue | null,
) {
  const discount = parseDiscount(raw)
  if (discount == null) return
  try {
    await supabase.from('clients').update({ discount_percent: discount }).eq('id', clientId)
  } catch { /* colonne absente avant migration → ignoré */ }
}

// Avantages commerciaux ciblés (texte libre) — best-effort séparé, tolérant à
// l'absence de la colonne commercial_perks avant sa migration.
async function applyCommercialPerks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  raw: FormDataEntryValue | null,
) {
  const perks = (raw as string | null)?.trim() || null
  try {
    await supabase.from('clients').update({ commercial_perks: perks }).eq('id', clientId)
  } catch { /* colonne absente avant migration → ignoré */ }
}

function buildBasePayload(formData: FormData) {
  return {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    phone: formData.get('phone') as string,
    email: (formData.get('email') as string) || null,
    birth_date: (formData.get('birth_date') as string) || null,
    address: (formData.get('address') as string) || null,
    postal_code: (formData.get('postal_code') as string) || null,
    city: (formData.get('city') as string) || null,
    license_number: (formData.get('license_number') as string) || null,
    license_expiry: (formData.get('license_expiry') as string) || null,
    id_doc_type: (formData.get('id_doc_type') as string) || null,
    id_doc_number: (formData.get('id_doc_number') as string) || null,
    usual_payment_method: (formData.get('usual_payment_method') as string) || null,
    usual_deposit: formData.get('usual_deposit') ? Number(formData.get('usual_deposit')) : null,
    internal_notes: (formData.get('internal_notes') as string) || null,
    acquisition_channel: (formData.get('acquisition_channel') as string) || null,
  }
}

export async function createClientAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const payload = { ...buildBasePayload(formData), created_by: user.id }

  const { data, error } = await supabase.from('clients').insert(payload).select('id').single()
  if (error) return { error: error.message }

  // Photos : ClientForm téléverse directement vers Storage (contournement de la
  // limite de taille des requêtes Vercel) et transmet les CHEMINS via des champs
  // `<slot>_path`. Repli défensif : si un File brut arrive, on le téléverse ici.
  const photoPaths = await collectPhotoPaths(supabase, formData, data.id)
  if (Object.keys(photoPaths).length > 0) {
    await supabase.from('clients').update(photoPaths).eq('id', data.id)
  }

  await applyDiscount(supabase, data.id, formData.get('discount_percent'))
  await applyCommercialPerks(supabase, data.id, formData.get('commercial_perks'))

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'client_created',
    entity_type: 'clients',
    entity_id: data.id,
    metadata: {},
  })

  revalidatePath('/clients')
  redirect(`/clients/${data.id}`)
}

export async function updateClientAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const payload = buildBasePayload(formData)

  // Photos : chemins pré-téléversés par ClientForm (champs `<slot>_path`), avec
  // repli File. Les chemins absents ne sont pas écrits → les photos existantes
  // ne sont jamais effacées par une mise à jour sans nouvelle photo.
  const validPaths = await collectPhotoPaths(supabase, formData, id)
  const { error } = await supabase.from('clients').update({ ...payload, ...validPaths }).eq('id', id)
  if (error) return { error: error.message }

  await applyDiscount(supabase, id, formData.get('discount_percent'))
  await applyCommercialPerks(supabase, id, formData.get('commercial_perks'))

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'client_updated',
    entity_type: 'clients',
    entity_id: id,
  })

  revalidatePath(`/clients/${id}`)
  revalidatePath('/clients')
  redirect(`/clients/${id}`)
}

export async function updateClientNotes(id: string, notes: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('clients').update({ internal_notes: notes || null }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/clients/${id}`)
  return { ok: true }
}

export async function updateClientStatus(id: string, status: ClientStatus, blacklist_reason?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('clients').update({
    status,
    blacklist_reason: status === 'blackliste' ? (blacklist_reason ?? null) : null,
  }).eq('id', id)

  if (error) return { error: error.message }

  // Blacklist → annuler les réservations en attente + libérer les véhicules
  if (status === 'blackliste') {
    const { data: pendingRes } = await supabase
      .from('reservations')
      .select('id, vehicle_id')
      .eq('client_id', id)
      .in('status', ['option', 'confirmee'])

    if (pendingRes && pendingRes.length > 0) {
      await supabase.from('reservations')
        .update({ status: 'annulee' })
        .in('id', pendingRes.map(r => r.id))

      const vehicleIds = [...new Set(pendingRes.map(r => r.vehicle_id).filter(Boolean))] as string[]
      for (const vid of vehicleIds) await recomputeVehicleStatus(supabase, vid)

      revalidatePath('/reservations')
      revalidatePath('/calendrier')
      revalidatePath('/vehicles')
    }
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: 'client_status_changed',
    entity_type: 'clients',
    entity_id: id,
    metadata: { status, blacklist_reason },
  })

  revalidatePath(`/clients/${id}`)
  revalidatePath('/clients')
  return { success: true }
}
