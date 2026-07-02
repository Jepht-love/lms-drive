'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgencySettings } from '@/lib/contracts/agency'
import { graviteLabel } from '@/components/vehicle-schema/inspection-types'
import { InvoicePDF, type InvoiceLineItem } from '@/lib/pdf/invoice-template'
import { loadLogoDataUrl } from '@/lib/pdf/build-contract-data'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { Resend } from 'resend'
import { logEmail } from '@/lib/email/log'
import { RESEND_FROM, resendTo } from '@/lib/email/config'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

async function nextInvoiceNumber(supabase: SupabaseServer): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`)
  const seq = String((count ?? 0) + 1).padStart(2, '0')
  return `FR-${today}-${seq}`
}

/**
 * Brouillon généré automatiquement à la clôture du contrat (validateContract) :
 * reprend les frais déjà calculés de façon fiable par l'app (retard, km
 * supplémentaires, dommages). Le prix de chaque dommage est celui choisi par
 * l'agent à l'EDL retour (grille par type de dommage, ajustée au cas par cas
 * dans InspectionFlow) — pas recalculé ici. Ne crée rien s'il n'y a aucun frais
 * à facturer.
 */
export async function generateInvoiceDraft(contractId: string): Promise<{ invoiceId?: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, reservation:reservations(id, vehicle_id, client_id, end_datetime, late_fee_amount, late_minutes, extra_km_count, extra_km_amount, extra_km_price)')
    .eq('id', contractId)
    .single()
  if (!contract) return { error: 'Contrat introuvable' }

  const r = (contract as any).reservation
  if (!r) return { error: 'Réservation introuvable' }

  const { data: existing } = await supabase.from('invoices').select('id').eq('contract_id', contractId).maybeSingle()
  if (existing) return { invoiceId: existing.id }

  const [{ data: depInsp }, { data: arrInsp }] = await Promise.all([
    supabase.from('inspections').select('damaged_zones').eq('contract_id', contractId).eq('type', 'depart').maybeSingle(),
    supabase.from('inspections').select('damaged_zones').eq('contract_id', contractId).eq('type', 'arrivee').maybeSingle(),
  ])

  const previousZoneIds = new Set(((depInsp?.damaged_zones as any[]) ?? []).map(z => z.id))
  const newDamages = ((arrInsp?.damaged_zones as any[]) ?? []).filter(z => !previousZoneIds.has(z.id))

  const lineItems: InvoiceLineItem[] = []

  if ((r.late_fee_amount ?? 0) > 0) {
    lineItems.push({
      description: `Frais de retard (${r.late_minutes} min)`,
      quantity: 1,
      unit_price: r.late_fee_amount,
      total: r.late_fee_amount,
    })
  }
  if ((r.extra_km_amount ?? 0) > 0) {
    lineItems.push({
      description: 'Dépassement kilométrique',
      quantity: r.extra_km_count,
      unit_price: r.extra_km_price ?? Math.round((r.extra_km_amount / Math.max(1, r.extra_km_count)) * 100) / 100,
      total: r.extra_km_amount,
    })
  }
  for (const z of newDamages) {
    const price = z.price ?? 0
    if (price <= 0) continue
    const description = z.kind === 'interieur'
      ? `Dégât intérieur — ${z.label}`
      : `Dommage constaté — ${z.label} (${graviteLabel(z.severity)})`
    lineItems.push({
      description,
      quantity: 1,
      unit_price: price,
      total: price,
    })
  }

  if (lineItems.length === 0) return {}

  const totalAmount = lineItems.reduce((s, l) => s + l.total, 0)
  const invoiceNumber = await nextInvoiceNumber(supabase)

  const { data: invoice, error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    contract_id: contractId,
    reservation_id: r.id,
    client_id: r.client_id,
    vehicle_id: r.vehicle_id,
    line_items: lineItems,
    total_amount: totalAmount,
    created_by: user.id,
  }).select('id').single()
  if (error) return { error: error.message }

  revalidatePath(`/reservations/${r.id}`)
  return { invoiceId: invoice.id }
}

export async function updateInvoiceLines(invoiceId: string, lineItems: InvoiceLineItem[], paymentTermDays?: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const totalAmount = lineItems.reduce((s, l) => s + l.total, 0)
  const { data: invoice, error } = await supabase
    .from('invoices')
    .update({
      line_items: lineItems,
      total_amount: totalAmount,
      ...(paymentTermDays != null ? { payment_term_days: paymentTermDays } : {}),
    })
    .eq('id', invoiceId)
    .select('reservation_id')
    .single()
  if (error) return { error: error.message }

  revalidatePath(`/reservations/${invoice.reservation_id}`)
  return { success: true }
}

/**
 * Génère le PDF final (mis en page exacte fournie par le gérant), l'archive,
 * l'envoie par email, et fige sent_at. Client admin car le rendu PDF/l'envoi
 * email se font hors contexte de requête HTTP classique (cohérent avec le
 * pattern déjà utilisé pour les contrats).
 */
export async function sendInvoice(invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('*, vehicles(plate, brand, model), clients(first_name, last_name, email, address, postal_code, city), reservations(end_datetime)')
    .eq('id', invoiceId)
    .single()
  if (!invoice) return { error: 'Facture introuvable' }
  if (invoice.sent_at) return { error: 'Facture déjà envoyée' }
  if ((invoice.line_items as InvoiceLineItem[]).some(l => l.total <= 0)) {
    return { error: 'Au moins une ligne a un montant à 0 — complète le tarif avant envoi.' }
  }

  const v = Array.isArray(invoice.vehicles) ? invoice.vehicles[0] : invoice.vehicles
  const c = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
  const res = Array.isArray(invoice.reservations) ? invoice.reservations[0] : invoice.reservations
  if (!c?.email) return { error: "Le client n'a pas d'email" }

  const agency = await getAgencySettings(admin)

  const pdfData = {
    invoiceNumber: invoice.invoice_number,
    issueDate: new Date().toISOString(),
    vehiclePlate: v?.plate ?? '',
    vehicleBrand: v?.brand ?? '',
    vehicleModel: v?.model ?? '',
    returnDatetime: res?.end_datetime ?? new Date().toISOString(),
    clientName: `${c.first_name} ${c.last_name}`.trim(),
    clientAddress: c.address ? `${c.address}${c.postal_code ? ', ' + c.postal_code : ''}${c.city ? ' ' + c.city : ''}` : undefined,
    lineItems: invoice.line_items as InvoiceLineItem[],
    totalAmount: invoice.total_amount,
    agency: {
      companyName: agency.company_name,
      siret: agency.siret,
      address: agency.address,
      logoUrl: loadLogoDataUrl(),
    },
  }

  const buffer = await renderToBuffer(createElement(InvoicePDF, { data: pdfData }) as any)
  const pdfPath = `invoices/${invoiceId}/${invoice.invoice_number}.pdf`
  await admin.storage.from('contracts-pdf').upload(pdfPath, new Uint8Array(buffer), {
    contentType: 'application/pdf', upsert: true,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    await resend.emails.send({
      from: RESEND_FROM,
      to: resendTo(c.email),
      subject: `Facture de restitution ${invoice.invoice_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">LMS Drive — Facture de restitution</h2>
          <p>Bonjour ${c.first_name} ${c.last_name},</p>
          <p>Veuillez trouver ci-joint la facture <strong>${invoice.invoice_number}</strong> relative aux frais complémentaires constatés lors de la restitution du véhicule <strong>${v?.brand} ${v?.model} — ${v?.plate}</strong>.</p>
          <p><strong>Montant total :</strong> ${invoice.total_amount.toLocaleString('fr-FR')} €</p>
          <p style="color: #64748b; font-size: 12px;">— LMS Drive</p>
        </div>
      `,
      attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(buffer) }],
    })
  } catch (e: any) {
    return { error: "Échec de l'envoi : " + (e?.message ?? 'erreur inconnue') }
  }

  const { data: { publicUrl } } = admin.storage.from('contracts-pdf').getPublicUrl(pdfPath)
  await admin.from('documents').insert({
    category: 'client',
    subcategory: 'facture_restitution',
    name: `Facture ${invoice.invoice_number} — ${c.first_name} ${c.last_name}`,
    file_url: publicUrl,
    file_type: 'application/pdf',
    entity_id: c.id,
    entity_type: 'client',
    reservation_id: invoice.reservation_id,
    is_auto_generated: true,
  })

  // Échéance figée à l'envoi (pas avant : le délai/montant peuvent encore
  // changer pendant que la facture est en brouillon) — remontée dans le
  // système d'échéances générique pour un suivi unifié (lib/actions/dueDates.ts).
  const termDays = invoice.payment_term_days ?? 30
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + termDays)
  const dueDateStr = dueDate.toISOString().slice(0, 10)

  await admin.from('invoices').update({
    pdf_storage_path: pdfPath,
    sent_at: new Date().toISOString(),
    due_date: dueDateStr,
  }).eq('id', invoiceId)

  await admin.from('financial_due_dates').insert({
    description: `Facture ${invoice.invoice_number} — ${c.first_name} ${c.last_name}`,
    type: 'recette',
    category: 'facturation',
    amount: invoice.total_amount,
    due_date: dueDateStr,
    vehicle_id: invoice.vehicle_id,
    invoice_id: invoiceId,
    created_by: user.id,
  })

  await admin.from('audit_logs').insert({
    user_id: user.id,
    action: 'invoice_sent',
    entity_type: 'invoices',
    entity_id: invoiceId,
    metadata: { recipient: c.email, total: invoice.total_amount },
  })
  await logEmail({
    type: 'facture_restitution',
    recipient: c.email,
    subject: `Facture de restitution ${invoice.invoice_number}`,
    status: 'envoye',
    referenceType: 'invoice',
    referenceId: invoiceId,
    clientId: invoice.client_id ?? undefined,
    sentBy: user.id,
  })

  revalidatePath(`/reservations/${invoice.reservation_id}`)
  return { success: true }
}

/**
 * Prépare la facture de restitution d'un contrat pour l'ATTACHER à l'email du
 * contrat signé — la facture part au client EN MÊME TEMPS que le contrat qui
 * détaille l'état des lieux et les éléments facturés. Rend uniquement le PDF,
 * sans aucune mutation : la facture n'est marquée « envoyée » qu'une fois l'email
 * du contrat réellement parti (markRestitutionInvoiceSent), pour ne jamais figer
 * l'envoi si l'email échoue. Renvoie `skipped` (silencieux, le contrat part seul)
 * quand il n'y a rien à joindre ou que la facture n'est pas prête.
 */
export async function renderContractInvoiceAttachment(contractId: string): Promise<
  | { attachment: { filename: string; content: Buffer }; invoiceId: string; totalAmount: number }
  | { skipped: 'none' | 'already_sent' | 'unpriced' }
> {
  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('*, vehicles(plate, brand, model), clients(first_name, last_name, address, postal_code, city), reservations(end_datetime)')
    .eq('contract_id', contractId)
    .maybeSingle()
  if (!invoice) return { skipped: 'none' }
  if (invoice.sent_at) return { skipped: 'already_sent' }
  const lines = (invoice.line_items as InvoiceLineItem[]) ?? []
  if (lines.length === 0 || lines.some(l => l.total <= 0)) return { skipped: 'unpriced' }

  const v = Array.isArray(invoice.vehicles) ? invoice.vehicles[0] : invoice.vehicles
  const c = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
  const res = Array.isArray(invoice.reservations) ? invoice.reservations[0] : invoice.reservations
  const agency = await getAgencySettings(admin)

  const pdfData = {
    invoiceNumber: invoice.invoice_number,
    issueDate: new Date().toISOString(),
    vehiclePlate: v?.plate ?? '',
    vehicleBrand: v?.brand ?? '',
    vehicleModel: v?.model ?? '',
    returnDatetime: res?.end_datetime ?? new Date().toISOString(),
    clientName: `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim(),
    clientAddress: c?.address ? `${c.address}${c.postal_code ? ', ' + c.postal_code : ''}${c.city ? ' ' + c.city : ''}` : undefined,
    lineItems: lines,
    totalAmount: invoice.total_amount,
    agency: {
      companyName: agency.company_name,
      siret: agency.siret,
      address: agency.address,
      logoUrl: loadLogoDataUrl(),
    },
  }

  const buffer = await renderToBuffer(createElement(InvoicePDF, { data: pdfData }) as any)
  return {
    attachment: { filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(buffer) },
    invoiceId: invoice.id,
    totalAmount: invoice.total_amount,
  }
}

/**
 * Fige l'état « envoyée » de la facture (archive PDF, sent_at, due_date, échéance
 * financière, audit, log email) APRÈS que l'email contrat + facture est réellement
 * parti. Mêmes effets de bord que sendInvoice, sans réenvoyer d'email (l'email a
 * déjà été envoyé par la route du contrat avec la facture en pièce jointe).
 */
export async function markRestitutionInvoiceSent(invoiceId: string, buffer: Buffer, sentBy: string) {
  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, invoice_number, total_amount, reservation_id, vehicle_id, client_id, payment_term_days, sent_at, clients(first_name, last_name, email)')
    .eq('id', invoiceId)
    .single()
  if (!invoice || invoice.sent_at) return

  const c = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients

  const pdfPath = `invoices/${invoiceId}/${invoice.invoice_number}.pdf`
  await admin.storage.from('contracts-pdf').upload(pdfPath, new Uint8Array(buffer), {
    contentType: 'application/pdf', upsert: true,
  })

  const { data: { publicUrl } } = admin.storage.from('contracts-pdf').getPublicUrl(pdfPath)
  await admin.from('documents').insert({
    category: 'client',
    subcategory: 'facture_restitution',
    name: `Facture ${invoice.invoice_number} — ${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim(),
    file_url: publicUrl,
    file_type: 'application/pdf',
    entity_id: invoice.client_id,
    entity_type: 'client',
    reservation_id: invoice.reservation_id,
    is_auto_generated: true,
  })

  const termDays = invoice.payment_term_days ?? 30
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + termDays)
  const dueDateStr = dueDate.toISOString().slice(0, 10)

  await admin.from('invoices').update({
    pdf_storage_path: pdfPath,
    sent_at: new Date().toISOString(),
    due_date: dueDateStr,
  }).eq('id', invoiceId)

  await admin.from('financial_due_dates').insert({
    description: `Facture ${invoice.invoice_number} — ${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim(),
    type: 'recette',
    category: 'facturation',
    amount: invoice.total_amount,
    due_date: dueDateStr,
    vehicle_id: invoice.vehicle_id,
    invoice_id: invoiceId,
    created_by: sentBy,
  })

  await admin.from('audit_logs').insert({
    user_id: sentBy,
    action: 'invoice_sent',
    entity_type: 'invoices',
    entity_id: invoiceId,
    metadata: { recipient: c?.email, total: invoice.total_amount, via: 'contract_email' },
  })
  if (c?.email) {
    await logEmail({
      type: 'facture_restitution',
      recipient: c.email,
      subject: `Facture de restitution ${invoice.invoice_number}`,
      status: 'envoye',
      referenceType: 'invoice',
      referenceId: invoiceId,
      clientId: invoice.client_id ?? undefined,
      sentBy,
    })
  }

  revalidatePath(`/reservations/${invoice.reservation_id}`)
}
