import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { getAgencySettings } from '@/lib/contracts/agency'
import { loadLogoDataUrl } from '@/lib/pdf/build-contract-data'
import { ConventionPDF, type ConventionData } from '@/lib/pdf/convention-template'
import { createElement, type ReactElement } from 'react'

// Génère (ou régénère) le PDF de la convention de mise à disposition inter-agences,
// l'archive dans la bibliothèque documentaire (catégorie « partenaire ») et le
// renvoie en téléchargement. Pendant physique du client contracts/generate-pdf.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { operationId } = await request.json()
    if (!operationId) return NextResponse.json({ error: 'operationId manquant' }, { status: 400 })

    const { data: op } = await supabase
      .from('inter_agency_rentals')
      .select('*, partner_agencies(name, contact_name, phone, email, address, siret), vehicles(*)')
      .eq('id', operationId)
      .single()

    if (!op) return NextResponse.json({ error: 'Opération introuvable' }, { status: 404 })

    const { data: contract } = await supabase
      .from('contracts')
      .select('*')
      .eq('inter_agency_rental_id', operationId)
      .limit(1)
      .maybeSingle()

    if (!contract) return NextResponse.json({ error: 'Convention introuvable — ouvrez d\'abord la convention' }, { status: 404 })

    const vehicle = Array.isArray(op.vehicles) ? op.vehicles[0] : op.vehicles
    const partner = Array.isArray(op.partner_agencies) ? op.partner_agencies[0] : op.partner_agencies
    const agency = await getAgencySettings(supabase)

    const pdfData: ConventionData = {
      contractNumber: contract.contract_number,
      ownerName: agency.company_name ?? 'LMS Drive',
      ownerSiret: agency.siret ?? null,
      ownerAddress: agency.address ?? null,
      ownerPhone: agency.phone ?? null,
      ownerEmail: agency.email ?? null,
      ownerLogoUrl: loadLogoDataUrl(),
      partnerName: partner?.name ?? 'Agence partenaire',
      partnerContact: partner?.contact_name ?? null,
      partnerPhone: partner?.phone ?? null,
      partnerSiret: partner?.siret ?? null,
      partnerAddress: partner?.address ?? null,
      vehicleBrand: vehicle?.brand ?? null,
      vehicleModel: vehicle?.model ?? null,
      vehicleVersion: vehicle?.version ?? null,
      vehiclePlate: vehicle?.plate ?? null,
      vehicleColor: vehicle?.color ?? null,
      startDate: op.start_date ?? null,
      endDateExpected: op.end_date_expected ?? null,
      rentalCost: op.rental_cost ?? null,
      depositAmount: op.deposit_amount ?? null,
      partnerSignature: contract.client_signature_svg ?? undefined,
      signedAt: contract.signed_at ?? undefined,
    }

    const element = createElement(ConventionPDF, { data: pdfData }) as ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)
    const bytes = new Uint8Array(buffer)

    const pdfPath = `conventions/${operationId}/${contract.contract_number}.pdf`
    await supabase.storage
      .from('contracts-pdf')
      .upload(pdfPath, bytes, { contentType: 'application/pdf', upsert: true })

    await supabase.from('contracts').update({ pdf_storage_path: pdfPath }).eq('id', contract.id)

    // Archivage auto dans la bibliothèque documentaire — visible dans « Tous »
    // et « Partenaires ». Anti-doublon : une convention régénérée remplace
    // l'entrée auto-générée précédente au lieu d'en empiler une nouvelle.
    const { data: { publicUrl } } = supabase.storage.from('contracts-pdf').getPublicUrl(pdfPath)
    try {
      await supabase.from('documents')
        .delete()
        .eq('entity_id', op.partner_agency_id)
        .eq('subcategory', 'convention_ia')
        .eq('is_auto_generated', true)
        .contains('tags', [operationId])
      await supabase.from('documents').insert({
        category: 'partenaire',
        subcategory: 'convention_ia',
        name: `Convention ${contract.contract_number} — ${partner?.name ?? 'Partenaire'}`,
        file_url: publicUrl,
        file_type: 'application/pdf',
        entity_id: op.partner_agency_id ?? null,
        entity_type: 'partner_agency',
        is_auto_generated: true,
        tags: [operationId],
      })
    } catch { /* archivage non bloquant */ }

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${contract.contract_number}.pdf"`,
      },
    })
  } catch (e: any) {
    console.error('Convention PDF generation error:', e)
    return NextResponse.json({ error: e.message ?? 'Erreur génération PDF' }, { status: 500 })
  }
}
