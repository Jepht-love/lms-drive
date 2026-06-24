import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { ContractPDF } from '@/lib/pdf/contract-template'
import { buildContractPdfData } from '@/lib/pdf/build-contract-data'
import { createElement, type ReactElement } from 'react'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { contractId } = await request.json()
    if (!contractId) return NextResponse.json({ error: 'contractId manquant' }, { status: 400 })

    const built = await buildContractPdfData(supabase, contractId)
    if (!built) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

    const { pdfData, contract, client } = built

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
    const clientName = `${client?.first_name ?? ''} ${client?.last_name ?? ''}`.trim()
    try {
      await supabase.from('documents').insert({
        category: 'client',
        subcategory: 'contrat_location',
        name: `Contrat ${contract.contract_number}${clientName ? ` — ${clientName}` : ''}`,
        file_url: contractPublicUrl,
        file_type: 'application/pdf',
        entity_id: client?.id ?? null,
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
