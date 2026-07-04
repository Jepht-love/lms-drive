'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findDriverAtDate } from '@/lib/utils/findDriverAtDate'
import { logEmail } from '@/lib/email/log'
import { RESEND_FROM, resendTo } from '@/lib/email/config'

// Appelé depuis le formulaire client quand véhicule + date sont renseignés
export async function lookupDriver(vehicleId: string, date: string, time?: string) {
  if (!vehicleId || !date) return null
  return findDriverAtDate(vehicleId, date, time)
}

const num = (fd: FormData, k: string) => {
  const v = (fd.get(k) as string)?.trim()
  if (!v) return 0
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const int = (fd: FormData, k: string) => {
  const v = (fd.get(k) as string)?.trim()
  return v ? parseInt(v, 10) || 0 : 0
}
const str = (fd: FormData, k: string) => (fd.get(k) as string)?.trim() || null

export async function createInfraction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const vehicleId = str(formData, 'vehicle_id')
  const infractionDate = str(formData, 'infraction_date')
  if (!vehicleId || !infractionDate) return { error: 'Véhicule et date requis' }

  const payload = {
    vehicle_id:       vehicleId,
    infraction_date:  infractionDate,
    infraction_time:  str(formData, 'infraction_time'),
    type:             str(formData, 'type') || 'autre',
    amount:           num(formData, 'amount'),
    points_lost:      int(formData, 'points_lost'),
    reception_date:   str(formData, 'reception_date'),
    admin_fees:       num(formData, 'admin_fees'),
    reference:        str(formData, 'reference'),
    notes:            str(formData, 'notes'),
    client_id:        str(formData, 'client_id'),
    internal_user_id: str(formData, 'internal_user_id'),
    reservation_id:   str(formData, 'reservation_id'),
    status:           'en_attente',
  }

  const { data, error } = await supabase.from('infractions').insert(payload).select('id').single()
  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'infraction_created', entity_type: 'infractions', entity_id: data.id,
  })

  // E2 — Archivage auto si un document est joint
  const documentUrl = str(formData, 'document_url')
  if (documentUrl && vehicleId) {
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('plate')
      .eq('id', vehicleId)
      .single()
    try {
      await supabase.from('documents').insert({
        category: 'vehicule',
        subcategory: 'autres',
        name: `Infraction ${new Date(infractionDate).toLocaleDateString('fr-FR')} — ${vehicle?.plate ?? vehicleId}`,
        file_url: documentUrl,
        entity_id: vehicleId,
        entity_type: 'vehicle',
        is_auto_generated: false,
      })
    } catch { /* archivage non bloquant */ }
  }

  // Justificatif optionnel (avis, photo, scan…) → Documents › Véhicule
  const justificatif = formData.get('justificatif') as File | null
  if (justificatif && justificatif.size > 0) {
    const ext = justificatif.name.split('.').pop() || 'pdf'
    const path = `vehicule/infraction/${Date.now()}-${vehicleId}.${ext}`
    const ab = await justificatif.arrayBuffer()
    const { error: upErr } = await supabase.storage.from('documents').upload(path, ab, { contentType: justificatif.type })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      const { data: veh } = await supabase.from('vehicles').select('brand, model, plate').eq('id', vehicleId).single()
      const vehLabel = veh ? `${veh.brand} ${veh.model}${veh.plate ? ` (${veh.plate})` : ''}` : ''
      await supabase.from('documents').insert({
        category: 'vehicule',
        subcategory: 'infraction',
        name: `Infraction ${infractionDate} — ${vehLabel}`,
        file_url: publicUrl,
        file_type: justificatif.type,
        file_size: justificatif.size,
        entity_id: vehicleId,
        entity_type: 'vehicle',
        is_auto_generated: false,
        created_by: user.id,
      })
    }
  }

  revalidatePath('/incidents/infractions')
  return { success: true, id: data.id }
}

export async function transmitInfractionToClient(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: inf } = await supabase
    .from('infractions')
    .select('*, clients(id, first_name, last_name, email), vehicles(plate, brand, model)')
    .eq('id', id).single()
  if (!inf) return { error: 'Infraction introuvable' }

  const client = Array.isArray(inf.clients) ? inf.clients[0] : inf.clients
  if (!client?.email) return { error: 'Aucun email pour ce client' }
  const v = Array.isArray(inf.vehicles) ? inf.vehicles[0] : inf.vehicles

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: RESEND_FROM,
      to: resendTo(client.email),
      subject: `Avis de contravention — véhicule ${v?.brand ?? ''} ${v?.model ?? ''} (${v?.plate ?? ''})`,
      html: `<p>Bonjour ${client.first_name},</p>
        <p>Une infraction a été constatée le <b>${inf.infraction_date}</b> avec le véhicule
        <b>${v?.brand} ${v?.model} (${v?.plate})</b> que vous aviez en location.</p>
        <p>Montant de l'amende : <b>${inf.amount} €</b>${inf.admin_fees ? ` (+ ${inf.admin_fees} € de frais de dossier)` : ''}.</p>
        ${inf.reference ? `<p>Référence de l'avis : <b>${inf.reference}</b></p>` : ''}
        ${inf.document_url ? `<p><a href="${inf.document_url}">Consulter l'avis de contravention</a></p>` : ''}
        <p>Merci de procéder à la régularisation.</p>
        <p>— LMS Drive</p>`,
    })
  } catch (e: any) {
    return { error: 'Échec de l\'envoi : ' + (e?.message ?? 'erreur inconnue') }
  }

  const { error: updateError } = await supabase.from('infractions')
    .update({ status: 'transmis_client', transmission_date: new Date().toISOString().slice(0, 10) })
    .eq('id', id)
  if (updateError) return { error: updateError.message }

  await logEmail({
    type: 'avis_infraction',
    recipient: client.email,
    subject: `Avis de contravention — véhicule ${v?.brand ?? ''} ${v?.model ?? ''} (${v?.plate ?? ''})`,
    status: 'envoye',
    referenceType: 'infraction',
    referenceId: id,
    clientId: client.id,
    sentBy: user.id,
  })
  revalidatePath(`/incidents/infractions/${id}`)
  return { success: true }
}

export async function markInfractionPaid(id: string, paidBy: 'client' | 'agence') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('infractions')
    .update({ status: 'regle', payment_date: today, paid_by: paidBy }).eq('id', id)
  if (error) return { error: error.message }

  // S6 — enregistrement automatique en comptabilité (catégorie « amendes »),
  // seulement si l'agence règle elle-même : si le client règle directement,
  // l'agence n'a aucune sortie de caisse à comptabiliser.
  const { data: inf } = await supabase
    .from('infractions').select('amount, admin_fees, vehicle_id, type, infraction_date').eq('id', id).single()
  const amount = (inf?.amount ?? 0) + (inf?.admin_fees ?? 0)
  if (inf && amount > 0 && paidBy === 'agence') {
    const { error: txError } = await createAdminClient().from('financial_transactions').insert({
      date: today, type: 'depense', category: 'amendes', amount,
      vehicle_id: inf.vehicle_id,
      notes: `Amende ${inf.type} — ${inf.infraction_date}`,
      reference: id, infraction_id: id, created_by: user.id,
    })
    if (txError) return { error: txError.message }
  }

  revalidatePath(`/incidents/infractions/${id}`)
  return { success: true }
}

export async function closeInfraction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('infractions').update({ status: 'cloture' }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/incidents/infractions/${id}`)
  return { success: true }
}

// ─── Sinistres (accidents) ────────────────────────────────────────────────────

export async function createAccident(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const vehicleId = str(formData, 'vehicle_id')
  const accidentDate = str(formData, 'accident_date')
  const description = str(formData, 'description')
  if (!vehicleId || !accidentDate || !description) return { error: 'Véhicule, date et description requis' }

  const payload = {
    vehicle_id:            vehicleId,
    accident_date:         accidentDate,
    description,
    dossier_number:        str(formData, 'dossier_number'),
    repair_cost:           num(formData, 'repair_cost'),
    insurance_covered:     formData.get('insurance_covered') === 'on',
    insurance_amount:      num(formData, 'insurance_amount'),
    deposit_retained:      num(formData, 'deposit_retained'),
    client_responsibility: formData.get('client_responsibility') !== 'off',
    notes:                 str(formData, 'notes'),
    client_id:             str(formData, 'client_id'),
    internal_user_id:      str(formData, 'internal_user_id'),
    reservation_id:        str(formData, 'reservation_id'),
    status:                'declare',
  }

  const { data, error } = await supabase.from('accidents').insert(payload).select('id').single()
  if (error) return { error: error.message }

  // B4 — passer le véhicule « en vérification » (admin : vehicles.status est RLS gérant)
  await createAdminClient().from('vehicles').update({ status: 'en_verification' }).eq('id', vehicleId)

  // Justificatif optionnel (constat, PV d'expertise, photos) → Documents › Véhicule
  // si un fichier est réellement joint (même logique que l'entretien).
  const justificatif = formData.get('justificatif') as File | null
  if (justificatif && justificatif.size > 0) {
    const ext = justificatif.name.split('.').pop() || 'pdf'
    const path = `vehicule/pv_expertise/${Date.now()}-${vehicleId}.${ext}`
    const ab = await justificatif.arrayBuffer()
    const { error: upErr } = await supabase.storage.from('documents').upload(path, ab, { contentType: justificatif.type })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      const { data: veh } = await supabase.from('vehicles').select('brand, model, plate').eq('id', vehicleId).single()
      const vehLabel = veh ? `${veh.brand} ${veh.model}${veh.plate ? ` (${veh.plate})` : ''}` : ''
      await supabase.from('documents').insert({
        category: 'vehicule',
        subcategory: 'pv_expertise',
        name: `Sinistre ${accidentDate} — ${vehLabel}`,
        file_url: publicUrl,
        file_type: justificatif.type,
        file_size: justificatif.size,
        entity_id: vehicleId,
        entity_type: 'vehicle',
        is_auto_generated: false,
        created_by: user.id,
      })
    }
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id, action: 'accident_created', entity_type: 'accidents', entity_id: data.id,
  })
  revalidatePath('/incidents/sinistres')
  return { success: true, id: data.id }
}

export async function updateAccidentStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.from('accidents').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  // À la clôture : remettre le véhicule disponible + comptabiliser le coût NET
  // restant à la charge de l'agence (choix gérant : coût net à la clôture =
  // réparation − remboursement assurance − caution retenue). Anti-doublon par
  // `reference = accident:<id>` → une re-clôture ne recrée pas la charge.
  if (status === 'cloture') {
    const { data: acc } = await supabase.from('accidents')
      .select('vehicle_id, repair_cost, insurance_covered, insurance_amount, deposit_retained, accident_date, dossier_number')
      .eq('id', id).single()
    if (acc?.vehicle_id) {
      const admin = createAdminClient()
      const { error: vehicleError } = await admin.from('vehicles').update({ status: 'disponible' }).eq('id', acc.vehicle_id)
      if (vehicleError) return { error: vehicleError.message }

      const insurance = acc.insurance_covered ? (acc.insurance_amount ?? 0) : 0
      const net = Math.max(0, (acc.repair_cost ?? 0) - insurance - (acc.deposit_retained ?? 0))
      const reference = `accident:${id}`
      if (net > 0) {
        const { data: dup } = await admin
          .from('financial_transactions').select('id').eq('reference', reference).maybeSingle()
        if (!dup) {
          const { error: txError } = await admin.from('financial_transactions').insert({
            date: new Date().toISOString().slice(0, 10),
            type: 'depense', category: 'sinistre', amount: net,
            vehicle_id: acc.vehicle_id, reference,
            notes: `Sinistre${acc.dossier_number ? ` (dossier ${acc.dossier_number})` : ''} — coût net agence (${acc.accident_date})`,
            created_by: user.id,
          })
          if (txError) return { error: txError.message }
        }
      }
    }
    await supabase.from('audit_logs').insert({
      user_id: user.id, action: 'accident_closed', entity_type: 'accidents', entity_id: id,
      metadata: { status },
    })
  }
  revalidatePath(`/incidents/sinistres/${id}`)
  return { success: true }
}

export async function addAccidentToVehicle(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: acc } = await supabase.from('accidents').select('*').eq('id', id).single()
  if (!acc) return { error: 'Sinistre introuvable' }

  const { error } = await supabase.from('maintenance_records').insert({
    vehicle_id:  acc.vehicle_id,
    type:        'reparation',
    description: `Réparation sinistre${acc.dossier_number ? ` (dossier ${acc.dossier_number})` : ''} — ${(acc.description ?? '').slice(0, 80)}`,
    date:        new Date().toISOString().slice(0, 10),
    amount:      acc.repair_cost ?? 0,
    notes:       `Sinistre du ${acc.accident_date}`,
  })
  if (error) return { error: error.message }

  revalidatePath(`/incidents/sinistres/${id}`)
  return { success: true }
}
