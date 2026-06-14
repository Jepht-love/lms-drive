import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { ContractPDF } from '@/lib/pdf/contract-template'
import { createElement, type ReactElement } from 'react'
import type { InspectionPDFData } from '@/lib/pdf/contract-template'
import { getAgencySettings } from '@/lib/contracts/agency'
import { readFileSync } from 'fs'
import { join } from 'path'

function loadLogoDataUrl(): string | null {
  try {
    const buf = readFileSync(join(process.cwd(), 'public', 'logo.png'))
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

async function fetchPhotoAsDataUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
  bucket = 'vehicle-photos',
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath)
    if (error || !data) return null
    const buf = Buffer.from(await data.arrayBuffer())
    // Detect image type from path extension
    const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'jpeg'
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { contractId } = await request.json()
    if (!contractId) return NextResponse.json({ error: 'contractId manquant' }, { status: 400 })

    const { data: contract } = await supabase
      .from('contracts')
      .select('*, reservation:reservations(*, vehicle:vehicles(*), client:clients(*))')
      .eq('id', contractId)
      .single()

    if (!contract) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

    const r = contract.reservation as any
    const v = r?.vehicle
    const c = r?.client

    // Récupérer les états des lieux complets (départ + retour)
    const { data: rawInspections } = await supabase
      .from('inspections')
      .select('id, type, km_reading, fuel_level, exterior_cleanliness, interior_cleanliness, damaged_zones, client_signature_svg, agent_signature_svg, signed_at')
      .eq('contract_id', contractId)
      .in('type', ['depart', 'arrivee'])
      .order('signed_at')

    const inspectionData: InspectionPDFData[] = []

    for (const insp of rawInspections ?? []) {
      const { data: photos } = await supabase
        .from('inspection_photos')
        .select('storage_path, photo_type')
        .eq('inspection_id', insp.id)
        .limit(12)

      const photoUrls: { url: string; label: string }[] = []
      for (const p of (photos ?? []).slice(0, 8)) {
        const url = await fetchPhotoAsDataUrl(supabase, p.storage_path)
        if (url) photoUrls.push({ url, label: p.photo_type })
      }

      inspectionData.push({
        type: insp.type as 'depart' | 'arrivee',
        kmReading: insp.km_reading ?? 0,
        fuelLevel: insp.fuel_level ?? 0,
        exteriorCleanliness: insp.exterior_cleanliness ?? 3,
        interiorCleanliness: insp.interior_cleanliness ?? 3,
        damagedZones: (insp.damaged_zones as any[]) ?? [],
        clientSignature: insp.client_signature_svg ?? undefined,
        agentSignature: insp.agent_signature_svg ?? undefined,
        signedAt: insp.signed_at ?? undefined,
        photos: photoUrls,
      })
    }

    // Photos CNI + permis du client (bucket client-docs)
    const [idFrontUrl, idBackUrl, licFrontUrl, licBackUrl] = await Promise.all([
      c?.id_doc_front_path  ? fetchPhotoAsDataUrl(supabase, c.id_doc_front_path,  'client-docs') : Promise.resolve(null),
      c?.id_doc_back_path   ? fetchPhotoAsDataUrl(supabase, c.id_doc_back_path,   'client-docs') : Promise.resolve(null),
      c?.license_front_path ? fetchPhotoAsDataUrl(supabase, c.license_front_path, 'client-docs') : Promise.resolve(null),
      c?.license_back_path  ? fetchPhotoAsDataUrl(supabase, c.license_back_path,  'client-docs') : Promise.resolve(null),
    ])

    const clientDocs = [
      idFrontUrl  ? { url: idFrontUrl,  label: "CNI / Passeport — Recto" } : null,
      idBackUrl   ? { url: idBackUrl,   label: "CNI / Passeport — Verso" } : null,
      licFrontUrl ? { url: licFrontUrl, label: "Permis de conduire — Recto" } : null,
      licBackUrl  ? { url: licBackUrl,  label: "Permis de conduire — Verso" } : null,
    ].filter(Boolean) as { url: string; label: string }[]

    const agency = await getAgencySettings(supabase)
    const logoDataUrl = loadLogoDataUrl()

    const pdfData = {
      contractNumber: contract.contract_number,
      reservationNumber: r?.reservation_number ?? '',
      startDatetime: r?.start_datetime ?? '',
      endDatetime: r?.end_datetime ?? '',
      clientName: `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim(),
      clientPhone: c?.phone ?? '',
      clientEmail: c?.email ?? undefined,
      clientAddress: c?.address
        ? `${c.address}${c.postal_code ? ', ' + c.postal_code : ''}${c.city ? ' ' + c.city : ''}`
        : undefined,
      clientLicense: c?.license_number ?? undefined,
      vehiclePlate: v?.plate ?? '',
      vehicleBrand: v?.brand ?? '',
      vehicleModel: v?.model ?? '',
      vehicleVersion: v?.version ?? undefined,
      vehicleVin: v?.vin ?? undefined,
      vehicleColor: v?.color ?? undefined,
      vehicleCategory: v?.category ?? undefined,
      isSmartFortwo: v?.model?.toLowerCase().includes('smart') || v?.brand?.toLowerCase().includes('smart') || false,
      dailyPrice: r?.daily_price ?? 0,
      totalPrice: r?.total_price ?? 0,
      kmIncluded: r?.km_included ?? undefined,
      extraKmPrice: r?.extra_km_price ?? undefined,
      depositAmount: r?.deposit_amount ?? undefined,
      depositMethod: r?.deposit_method ?? undefined,
      lateFeeAmount: r?.late_fee_amount > 0 ? r.late_fee_amount : undefined,
      lateMinutes: r?.late_minutes > 0 ? r.late_minutes : undefined,
      extraKmCount: r?.extra_km_count > 0 ? r.extra_km_count : undefined,
      extraKmAmount: r?.extra_km_amount > 0 ? r.extra_km_amount : undefined,
      clientSignature: contract.client_signature_svg ?? undefined,
      agentSignature: contract.agent_signature_svg ?? undefined,
      signedAt: contract.signed_at ?? undefined,
      inspections: inspectionData,
      clientDocs,
      agency: {
        companyName: agency.company_name,
        siret: agency.siret,
        address: agency.address,
        phone: agency.phone,
        email: agency.email,
        logoUrl: logoDataUrl,
      },
    }

    const element = createElement(ContractPDF, { data: pdfData }) as ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)
    const bytes = new Uint8Array(buffer)

    const pdfPath = `contracts/${contractId}/${contract.contract_number}.pdf`
    await supabase.storage
      .from('contracts-pdf')
      .upload(pdfPath, bytes, { contentType: 'application/pdf', upsert: true })

    await supabase.from('contracts').update({ pdf_storage_path: pdfPath }).eq('id', contractId)

    // E1 — Archivage auto dans la bibliothèque documentaire
    const { data: { publicUrl: contractPublicUrl } } = supabase.storage
      .from('contracts-pdf')
      .getPublicUrl(pdfPath)
    const reservation = Array.isArray(pdfData) ? null : pdfData
    const clientName = reservation
      ? `${(reservation as any).client?.first_name ?? ''} ${(reservation as any).client?.last_name ?? ''}`.trim()
      : ''
    try {
      await supabase.from('documents').insert({
        category: 'client',
        subcategory: 'contrat_location',
        name: `Contrat ${contract.contract_number}${clientName ? ` — ${clientName}` : ''}`,
        file_url: contractPublicUrl,
        file_type: 'application/pdf',
        entity_id: (reservation as any)?.client_id ?? null,
        entity_type: 'client',
        reservation_id: contract.reservation_id,
        is_auto_generated: true,
      })
    } catch { /* archivage non bloquant */ }

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${contract.contract_number}.pdf"`,
      },
    })
  } catch (e: any) {
    console.error('PDF generation error:', e)
    return NextResponse.json({ error: e.message ?? 'Erreur génération PDF' }, { status: 500 })
  }
}
