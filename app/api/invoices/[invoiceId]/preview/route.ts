import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAgencySettings } from '@/lib/contracts/agency'
import { InvoicePDF, type InvoiceLineItem } from '@/lib/pdf/invoice-template'
import { loadLogoDataUrl } from '@/lib/pdf/build-contract-data'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'

/**
 * Prévisualisation du PDF de la facture de restitution AVANT envoi : rend le
 * document tel qu'il sera envoyé, sans rien figer (pas d'email, pas d'archivage,
 * pas d'échéance). Le gérant peut ainsi vérifier la mise en page et les montants,
 * revenir ajuster les lignes, puis envoyer. Lecture seule via le client
 * utilisateur (fonctionne même sans clé service).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, vehicles(plate, brand, model), clients(first_name, last_name, address, postal_code, city), reservations(end_datetime)')
    .eq('id', invoiceId)
    .single()
  if (!invoice) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const v = Array.isArray(invoice.vehicles) ? invoice.vehicles[0] : invoice.vehicles
  const c = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients
  const res = Array.isArray(invoice.reservations) ? invoice.reservations[0] : invoice.reservations

  const agency = await getAgencySettings(supabase)

  const pdfData = {
    invoiceNumber: invoice.invoice_number,
    issueDate: new Date().toISOString(),
    vehiclePlate: v?.plate ?? '',
    vehicleBrand: v?.brand ?? '',
    vehicleModel: v?.model ?? '',
    returnDatetime: res?.end_datetime ?? new Date().toISOString(),
    clientName: `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim(),
    clientAddress: c?.address ? `${c.address}${c.postal_code ? ', ' + c.postal_code : ''}${c.city ? ' ' + c.city : ''}` : undefined,
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

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="apercu-${invoice.invoice_number}.pdf"`,
    },
  })
}
